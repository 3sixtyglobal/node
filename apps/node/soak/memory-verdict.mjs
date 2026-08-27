// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Memory-growth verdict estimator, extracted from run-soak.mjs so it can be unit tested
 * against real and synthetic RSS series without spinning up the full soak orchestrator.
 */

/* eslint-disable no-mixed-operators -- conflicts with Prettier, which strips the clarifying parens this rule asks for */

/**
 * Evaluate a memory-growth verdict from a sampled RSS series.
 *
 * Two independent signals are computed over the whole post-warm-up window (not just its tail —
 * restricting to the tail starved the fit down to 8-9 points and made the verdict flip between
 * -933 and +434 MB/hr on two 30m runs of identical code, see issue #367):
 * - `rawSlopeMbPerHr`: a plain least-squares fit over the raw samples.
 * - `slopeMbPerHr`: a Theil-Sen (median of pairwise slopes) fit over each bucket's post-GC floor
 *   (per-bucket minimum), which strips GC peaks so it reads retained memory rather than the
 *   sawtooth riding on top of it.
 * A breach requires BOTH signals to independently exceed the limit. If they disagree, the verdict
 * is reported as informational (inconclusive) so the orchestrator can decide what to do (e.g.,
 * run longer) rather than arbitrarily picking one signal.
 * @param series The sampled RSS series.
 * @param options Verdict thresholds and window configuration.
 * @returns The memory verdict — { verdict, slopeMbPerHr, samples, totalSamples, startMb, endMb, peakMb }.
 */
export function evaluateMemory(series, options) {
	const usable = series.filter(
		s => s.t >= options.warmupDiscardMs && typeof s.rssBytes === 'number'
	);
	const peakMb = series.length ? mb(Math.max(...series.map(s => s.rssBytes))) : null;

	if (usable.length < 2) {
		return {
			verdict: 'insufficient',
			slopeMbPerHr: 0,
			rawSlopeMbPerHr: 0,
			windowMs: 0,
			samples: usable.length,
			totalSamples: series.length,
			startMb: null,
			endMb: null,
			floorStartMb: null,
			floorEndMb: null,
			peakMb,
			buckets: 0,
			signals: null
		};
	}

	const windowMs = usable[usable.length - 1].t - usable[0].t;

	// Signal A: whole-window least-squares over the raw post-warm-up samples.
	const rawSlopeMbPerHr = lsSlopeMbPerHr(usable.map(s => ({ t: s.t, v: s.rssBytes })));

	// Signal B: Theil-Sen slope over the post-GC floor (per-bucket minimum) of every post-warm-up
	// bucket. A true leak keeps lifting the floor across the whole window; cache/pool warm-up
	// fill plateaus it.
	const t0 = usable[0].t;
	const bucketMs = Math.min(180_000, Math.max(30_000, Math.round(windowMs / 16)));
	const floorByBucket = new Map();
	for (const s of usable) {
		const b = Math.floor((s.t - t0) / bucketMs);
		const cur = floorByBucket.get(b);
		if (cur === undefined || s.rssBytes < cur.v) {
			floorByBucket.set(b, { t: t0 + (b + 0.5) * bucketMs, v: s.rssBytes });
		}
	}
	const floors = [...floorByBucket.values()].sort((a, b) => a.t - b.t);
	const slopeMbPerHr =
		floors.length >= 2
			? theilSenSlopeMbPerHr(floors.map(f => ({ t: f.t, v: f.v })))
			: rawSlopeMbPerHr;

	// Only enforced once the window is long enough AND there are enough floor buckets for a
	// stable fit.
	let verdict;
	let signals = null;
	if (windowMs < options.memMinWindowMs || floors.length < 4) {
		verdict = 'informational';
	} else {
		const floorBreach = slopeMbPerHr > options.memGrowthLimitMbPerHr;
		const rawBreach = rawSlopeMbPerHr > options.memGrowthLimitMbPerHr;
		signals = { floorBreach, rawBreach };
		if (floorBreach && rawBreach) {
			verdict = 'breach';
		} else if (floorBreach === rawBreach) {
			verdict = 'pass';
		} else {
			verdict = 'informational';
		}
	}

	return {
		verdict,
		slopeMbPerHr, // floor Theil-Sen slope
		rawSlopeMbPerHr, // whole-window raw least-squares slope — corroborating signal
		windowMs,
		samples: usable.length,
		totalSamples: series.length,
		buckets: floors.length,
		startMb: mb(usable[0].rssBytes),
		endMb: mb(usable[usable.length - 1].rssBytes),
		floorStartMb: mb(floors[0].v),
		floorEndMb: mb(floors[floors.length - 1].v),
		peakMb,
		signals
	};
}

/**
 * Whether a memory verdict should trigger one automatic run extension before finalizing.
 * Fires on a breach, or on a genuine signal disagreement (verdict 'informational' with
 * non-null signals — the window was long enough to enforce, the two signals just disagreed).
 * Does NOT fire when 'informational' comes from too little data (short window or too few
 * floor buckets, signals is null) — extension is not an obvious fix for that case. Only fires
 * on an otherwise-clean, not-yet-extended, local run: a breach/disagreement on a run that k6
 * also failed is not disambiguated by running longer, and cloud (skipServer) runs never
 * produce a real verdict to disambiguate in the first place.
 * @param state The current run state.
 * @returns True if the run should be extended once before evaluating a final verdict.
 */
export function shouldExtendForDisambiguation(state) {
	const inconclusive =
		state.verdict === 'breach' || (state.verdict === 'informational' && state.signals !== null);
	return inconclusive && state.k6Code === 0 && !state.alreadyExtended && !state.skipServer;
}

/**
 * Least-squares slope of {t(ms), v(bytes)} points, expressed in MB/hour.
 * @param points The points to fit.
 * @returns The slope in MB/hour.
 */
export function lsSlopeMbPerHr(points) {
	const n = points.length;
	if (n < 2) {
		return 0;
	}
	const sT = points.reduce((a, p) => a + p.t, 0);
	const sV = points.reduce((a, p) => a + p.v, 0);
	const sTT = points.reduce((a, p) => a + p.t * p.t, 0);
	const sTV = points.reduce((a, p) => a + p.t * p.v, 0);
	const denom = n * sTT - sT * sT;
	const slopeBytesPerMs = denom === 0 ? 0 : (n * sTV - sT * sV) / denom;
	return (slopeBytesPerMs * 3_600_000) / 1_000_000;
}

/**
 * Theil-Sen slope of {t(ms), v(bytes)} points in MB/hour: the median of all pairwise slopes.
 * Robust to outliers (tolerates a noisy end bucket that would skew a least-squares fit).
 * @param points The points to fit.
 * @returns The slope in MB/hour.
 */
export function theilSenSlopeMbPerHr(points) {
	const n = points.length;
	if (n < 2) {
		return 0;
	}
	const slopes = [];
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const dt = points[j].t - points[i].t;
			if (dt > 0) {
				slopes.push((points[j].v - points[i].v) / dt);
			}
		}
	}
	if (slopes.length === 0) {
		return 0;
	}
	slopes.sort((a, b) => a - b);
	const mid = Math.floor(slopes.length / 2);
	const medianBytesPerMs = slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
	return (medianBytesPerMs * 3_600_000) / 1_000_000;
}

/**
 * Convert bytes to megabytes.
 * @param bytes The byte value.
 * @returns The value in megabytes, or null if not a number.
 */
function mb(bytes) {
	return typeof bytes === 'number' ? bytes / 1_000_000 : null;
}
