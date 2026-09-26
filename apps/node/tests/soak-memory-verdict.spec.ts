// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
	IExtendDecisionState,
	IMemorySample,
	IMemoryVerdictOptions
} from "../soak/memory-verdict.d.mts";
import { evaluateMemory, shouldExtendForDisambiguation } from "../soak/memory-verdict.mjs";
import {
	generateFlatSeries,
	generateLeakSeries,
	generateShortBorderlineSeries,
	generateSlowSettlingSeries,
	generateWarmupOnlySeries
} from "./fixtures/soak/syntheticSeries.js";

/**
 * The shipped defaults (run-soak.mjs cfg): 2m warm-up discard, 10m minimum window,
 * 150 MB/hr breach limit - both signals must independently exceed it to breach.
 */
const SHIPPED_DEFAULTS: IMemoryVerdictOptions = {
	warmupDiscardMs: 120_000,
	memMinWindowMs: 600_000,
	memGrowthLimitMbPerHr: 150
};

async function loadFixtureSeries(fileName: string): Promise<IMemorySample[]> {
	const raw = await readFile(path.resolve("./tests/fixtures/soak", fileName), "utf8");
	const report = JSON.parse(raw) as { series: IMemorySample[] };
	return report.series;
}

describe("soak memory verdict", () => {
	test("issue #367: two 30m runs of identical code (next.16, 2026-08-21) agree", async () => {
		const run1 = await loadFixtureSeries("next16-run1-dirty-db.json");
		const run2 = await loadFixtureSeries("next16-run2-clean-db.json");

		const verdict1 = evaluateMemory(run1, SHIPPED_DEFAULTS);
		const verdict2 = evaluateMemory(run2, SHIPPED_DEFAULTS);

		// The exact regression the issue reports: under the previous tail-restricted design,
		// run1 read -933.1 MB/hr (pass) and run2 read +434.7 MB/hr (breach), on identical code.
		expect(verdict1.verdict).toEqual("pass");
		expect(verdict2.verdict).toEqual("pass");
	});

	test("an empty series (cloud runs, no local process to sample) is insufficient, not a breach", () => {
		const verdict = evaluateMemory([], SHIPPED_DEFAULTS);

		expect(verdict.verdict).toEqual("insufficient");
	});

	test("a genuine sustained leak breaches - the positive control no archived run provides", () => {
		const verdict = evaluateMemory(generateLeakSeries(3, 300), SHIPPED_DEFAULTS);

		expect(verdict.verdict).toEqual("breach");
	});

	test("flat series across independent noise seeds all pass, including the one that flips the previous design", () => {
		// Seed 20 is a genuinely flat series that false-breached under the tail-restricted
		// design during Phase 2 candidate scoring - kept as a named regression case.
		for (const seed of [1, 2, 20]) {
			const verdict = evaluateMemory(generateFlatSeries(seed), SHIPPED_DEFAULTS);

			expect(verdict.verdict).toEqual("pass");
		}
	});

	test("a rise that plateaus well before the run ends passes - settling is not a leak", () => {
		const verdict = evaluateMemory(generateWarmupOnlySeries(4), SHIPPED_DEFAULTS);

		expect(verdict.verdict).toEqual("pass");
	});
});

describe("soak memory verdict - auto-extend trigger", () => {
	const cases: { name: string; state: IExtendDecisionState; expected: boolean }[] = [
		{
			name: "breach, k6 passed, not yet extended, local run",
			state: {
				verdict: "breach",
				signals: { floorBreach: true, rawBreach: true },
				k6Code: 0,
				alreadyExtended: false,
				skipServer: false
			},
			expected: true
		},
		{
			name: "breach, but k6 also failed - extending would not help",
			state: {
				verdict: "breach",
				signals: { floorBreach: true, rawBreach: true },
				k6Code: 1,
				alreadyExtended: false,
				skipServer: false
			},
			expected: false
		},
		{
			name: "breach, but already extended once - never extend twice",
			state: {
				verdict: "breach",
				signals: { floorBreach: true, rawBreach: true },
				k6Code: 0,
				alreadyExtended: true,
				skipServer: false
			},
			expected: false
		},
		{
			name: "breach, but this is a cloud run with no memory data to extend",
			state: {
				verdict: "breach",
				signals: { floorBreach: true, rawBreach: true },
				k6Code: 0,
				alreadyExtended: false,
				skipServer: true
			},
			expected: false
		},
		{
			name: "pass - nothing to disambiguate",
			state: {
				verdict: "pass",
				signals: { floorBreach: false, rawBreach: false },
				k6Code: 0,
				alreadyExtended: false,
				skipServer: false
			},
			expected: false
		},
		{
			// This is the case Finding 1 fixes: a genuine signal disagreement on an otherwise
			// enforceable window must extend, the same as a breach does.
			name: "informational from a genuine signal disagreement, k6 passed - must extend",
			state: {
				verdict: "informational",
				signals: { floorBreach: false, rawBreach: true },
				k6Code: 0,
				alreadyExtended: false,
				skipServer: false
			},
			expected: true
		},
		{
			name: "informational from a genuine signal disagreement, but k6 also failed",
			state: {
				verdict: "informational",
				signals: { floorBreach: false, rawBreach: true },
				k6Code: 1,
				alreadyExtended: false,
				skipServer: false
			},
			expected: false
		},
		{
			name: "informational - the run declined to enforce (too little data, signals null)",
			state: {
				verdict: "informational",
				signals: null,
				k6Code: 0,
				alreadyExtended: false,
				skipServer: false
			},
			expected: false
		},
		{
			name: "insufficient - too few samples to have a verdict at all",
			state: {
				verdict: "insufficient",
				signals: null,
				k6Code: 0,
				alreadyExtended: false,
				skipServer: false
			},
			expected: false
		}
	];

	test.each(cases)("$name", ({ state, expected }) => {
		expect(shouldExtendForDisambiguation(state)).toEqual(expected);
	});

	test("a slow-settling warm-up breaches at 30m but resolves to pass once extended to 60m", () => {
		// Same seed, same underlying signal (verified elsewhere to share an identical prefix) -
		// the only difference is how long it was observed for. This is the real edge case Phase 3's
		// whole-window estimator cannot resolve alone: a rise large enough, and slow enough, to
		// still dominate a 30-minute average even though it has genuinely settled by minute 15.
		const initial = evaluateMemory(generateSlowSettlingSeries(42, 181), SHIPPED_DEFAULTS);
		const extended = evaluateMemory(generateSlowSettlingSeries(42, 361), SHIPPED_DEFAULTS);

		expect(initial.verdict).toEqual("breach");
		expect(extended.verdict).toEqual("pass");
	});

	test("a genuine leak still breaches after the same extension - extending does not launder a real leak", () => {
		const initial = evaluateMemory(generateLeakSeries(42, 300, 181), SHIPPED_DEFAULTS);
		const extended = evaluateMemory(generateLeakSeries(42, 300, 361), SHIPPED_DEFAULTS);

		expect(initial.verdict).toEqual("breach");
		expect(extended.verdict).toEqual("breach");
	});

	test("a genuinely short window (12m) is informational with null signals - it never reaches the extend trigger", () => {
		const verdict = evaluateMemory(generateShortBorderlineSeries(1), SHIPPED_DEFAULTS);

		expect(verdict.verdict).toEqual("informational");
		expect(verdict.signals).toBeNull();

		const state: IExtendDecisionState = {
			verdict: verdict.verdict,
			signals: verdict.signals,
			k6Code: 0,
			alreadyExtended: false,
			skipServer: false
		};
		expect(shouldExtendForDisambiguation(state)).toEqual(false);
	});

	test("a real signal disagreement (slow-settling, seed 1) is informational with non-null signals - must extend", () => {
		// Found via a 200-seed sweep of generateSlowSettlingSeries: seed 1 lands informational
		// with the two signals genuinely disagreeing, not from a short window. This is the exact
		// case Finding 1 identified as silently exiting green with no extension attempted.
		const verdict = evaluateMemory(generateSlowSettlingSeries(1, 181), SHIPPED_DEFAULTS);

		expect(verdict.verdict).toEqual("informational");
		expect(verdict.signals).not.toBeNull();
		expect(verdict.signals?.floorBreach).not.toEqual(verdict.signals?.rawBreach);

		const state: IExtendDecisionState = {
			verdict: verdict.verdict,
			signals: verdict.signals,
			k6Code: 0,
			alreadyExtended: false,
			skipServer: false
		};
		expect(shouldExtendForDisambiguation(state)).toEqual(true);
	});

	test("a real signal disagreement (200 MB/hr leak, seed 32) also resolves to breach once extended", () => {
		// The false-negative Finding 1 quantified: today this exact series exits green with zero
		// disambiguation attempted, even though it is a genuine leak well over the limit.
		const initial = evaluateMemory(generateLeakSeries(32, 200, 181), SHIPPED_DEFAULTS);
		const extended = evaluateMemory(generateLeakSeries(32, 200, 361), SHIPPED_DEFAULTS);

		expect(initial.verdict).toEqual("informational");
		expect(initial.signals).not.toBeNull();

		const state: IExtendDecisionState = {
			verdict: initial.verdict,
			signals: initial.signals,
			k6Code: 0,
			alreadyExtended: false,
			skipServer: false
		};
		expect(shouldExtendForDisambiguation(state)).toEqual(true);
		expect(extended.verdict).toEqual("breach");
	});
});
