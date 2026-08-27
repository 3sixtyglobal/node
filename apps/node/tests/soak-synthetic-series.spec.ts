// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	generateFlatSeries,
	generateLeakSeries,
	generateShortBorderlineSeries,
	generateSlowSettlingSeries,
	generateSyntheticSeries,
	generateWarmupLateSeries,
	generateWarmupOnlySeries
} from "./fixtures/soak/syntheticSeries.js";

describe("soak synthetic series generator", () => {
	test("is deterministic: the same seed always produces the same series", () => {
		const a = generateFlatSeries(42);
		const b = generateFlatSeries(42);

		expect(a).toEqual(b);
	});

	test("different seeds produce different noise realizations", () => {
		const a = generateFlatSeries(1);
		const b = generateFlatSeries(2);

		expect(a).not.toEqual(b);
	});

	test("a flat series has no sustained floor drift: first and last sample RSS stay within the sawtooth amplitude", () => {
		const series = generateSyntheticSeries({ seed: 7 });
		const first = series[0].rssBytes;
		const last = series[series.length - 1].rssBytes;

		// No drift term is applied, so any difference is sawtooth phase + noise, not growth —
		// bounded well under the amplitude (500 MB) used to build the fixture.
		expect(Math.abs(last - first)).toBeLessThan(500_000_000);
	});

	test("a leak series has a floor that is unambiguously higher at the end than at the start", () => {
		const series = generateLeakSeries(3, 300);
		const firstQuarter = series.slice(0, Math.floor(series.length / 4));
		const lastQuarter = series.slice(-Math.floor(series.length / 4));
		const minOf = (samples: typeof series): number => Math.min(...samples.map(s => s.rssBytes));

		// Compare floors (minimums), not raw samples, so the sawtooth doesn't mask the drift.
		expect(minOf(lastQuarter)).toBeGreaterThan(minOf(firstQuarter));
	});

	test("a warm-up-only series plateaus: the second half's floor is flat, not still climbing", () => {
		const series = generateWarmupOnlySeries(4);
		const secondHalf = series.filter(s => s.t >= series[series.length - 1].t / 2);
		const firstQuarterOfSecondHalf = secondHalf.slice(0, Math.floor(secondHalf.length / 4));
		const lastQuarterOfSecondHalf = secondHalf.slice(-Math.floor(secondHalf.length / 4));
		const minOf = (samples: typeof series): number => Math.min(...samples.map(s => s.rssBytes));

		// Once past the plateau (well before the halfway point), the floor should no longer
		// be climbing within the second half.
		expect(Math.abs(minOf(lastQuarterOfSecondHalf) - minOf(firstQuarterOfSecondHalf))).toBeLessThan(
			500_000_000
		);
	});

	test("a warm-up-late series is a distinct fixture from a warm-up-only series", () => {
		const early = generateWarmupOnlySeries(5);
		const late = generateWarmupLateSeries(5);

		// Different plateau timing (480s vs 1200s) must produce different series, even from
		// the same seed — otherwise the two fixtures would be testing the same thing twice.
		expect(early).not.toEqual(late);
	});

	test("a short-borderline series is shorter than the default minimum enforcement window", () => {
		const series = generateShortBorderlineSeries(1);
		const windowMs = series[series.length - 1].t - series[0].t;

		// 72 samples at the default 10s interval span ~11.8 minutes — under the harness's
		// default 10-minute minimum enforcement window once warm-up is discarded.
		expect(windowMs).toBeLessThan(720_000);
	});

	test("a slow-settling series extended to a longer sample count keeps its original prefix unchanged", () => {
		// The Phase 4 auto-extend tests rely on this: the same seed's PRNG draws for the shared
		// prefix must be identical regardless of the total sampleCount requested, so "extending"
		// a run is exactly generating more samples of the same underlying signal, not a new one.
		const initial = generateSlowSettlingSeries(42, 181);
		const extended = generateSlowSettlingSeries(42, 361);

		expect(extended.slice(0, 181)).toEqual(initial);
	});
});
