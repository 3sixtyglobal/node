// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * A single RSS sample from the memory sampler.
 */
export interface IMemorySample {
	/**
	 * Milliseconds since the sampler started.
	 */
	t: number;
	/**
	 * Resident set size in bytes.
	 */
	rssBytes: number;
}

/**
 * Threshold and window configuration consumed by evaluateMemory.
 */
export interface IMemoryVerdictOptions {
	/**
	 * Initial window (ms) excluded from the growth slope.
	 */
	warmupDiscardMs: number;
	/**
	 * Settled-window length (ms) below which the verdict is informational, not fatal.
	 */
	memMinWindowMs: number;
	/**
	 * Maximum growth slope (MB/hour) before the verdict is a breach (both signals must exceed it).
	 */
	memGrowthLimitMbPerHr: number;
}

/**
 * The result of evaluating a memory series.
 */
export interface IMemoryVerdict {
	/**
	 * The verdict: informational (window too short), insufficient (too few samples), pass, or breach.
	 */
	verdict: 'informational' | 'insufficient' | 'pass' | 'breach';
	/**
	 * The floor Theil-Sen slope in MB/hour — one of the two corroborating verdict signals.
	 */
	slopeMbPerHr: number;
	/**
	 * The whole-window raw least-squares slope in MB/hour — one of the two corroborating verdict signals.
	 */
	rawSlopeMbPerHr: number;
	/**
	 * The post-warm-up window length in milliseconds.
	 */
	windowMs: number;
	/**
	 * The number of post-warm-up samples used.
	 */
	samples: number;
	/**
	 * The total number of samples in the series, including warm-up.
	 */
	totalSamples: number;
	/**
	 * The RSS at the first usable sample, in MB.
	 */
	startMb: number | null;
	/**
	 * The RSS at the last usable sample, in MB.
	 */
	endMb: number | null;
	/**
	 * The post-GC floor at the start of the post-warm-up window, in MB.
	 */
	floorStartMb: number | null;
	/**
	 * The post-GC floor at the end of the post-warm-up window, in MB.
	 */
	floorEndMb: number | null;
	/**
	 * The peak RSS across the whole series, in MB.
	 */
	peakMb: number | null;
	/**
	 * The number of post-warm-up floor buckets.
	 */
	buckets: number;
	/**
	 * Which of the two corroborating signals independently exceeded the breach limit. Null when
	 * the verdict was not enforced (informational due to a short window, or insufficient samples).
	 */
	signals: IMemoryVerdictSignals | null;
}

/**
 * Whether each corroborating signal independently exceeded the breach limit.
 */
export interface IMemoryVerdictSignals {
	/**
	 * Whether the floor Theil-Sen slope exceeded the breach limit.
	 */
	floorBreach: boolean;
	/**
	 * Whether the whole-window raw least-squares slope exceeded the breach limit.
	 */
	rawBreach: boolean;
}

/**
 * The current run state, used to decide whether to extend once before failing on memory alone.
 */
export interface IExtendDecisionState {
	/**
	 * The current memory verdict.
	 */
	verdict: IMemoryVerdict['verdict'];
	/**
	 * The current verdict's corroborating signals, or null (informational from too little data,
	 * or a verdict that never reaches signal evaluation at all).
	 */
	signals: IMemoryVerdictSignals | null;
	/**
	 * The k6 exit code from the load phase just completed.
	 */
	k6Code: number;
	/**
	 * Whether this run has already been extended once.
	 */
	alreadyExtended: boolean;
	/**
	 * Whether this run targets an external node (no local process to sample).
	 */
	skipServer: boolean;
}

/**
 * A time/value point for slope fitting.
 */
export interface ISlopePoint {
	/**
	 * Milliseconds since the sampler started.
	 */
	t: number;
	/**
	 * The value, in bytes.
	 */
	v: number;
}

/**
 * Evaluate a memory-growth verdict from a sampled RSS series.
 * @param series The sampled RSS series.
 * @param options Verdict thresholds and window configuration.
 * @returns The memory verdict.
 */
export function evaluateMemory(
	series: IMemorySample[],
	options: IMemoryVerdictOptions
): IMemoryVerdict;

/**
 * Whether a memory breach should trigger one automatic run extension before failing.
 * @param state The current run state.
 * @returns True if the run should be extended once before evaluating a final verdict.
 */
export function shouldExtendForDisambiguation(state: IExtendDecisionState): boolean;

/**
 * Least-squares slope of {t(ms), v(bytes)} points, expressed in MB/hour.
 * @param points The points to fit.
 * @returns The slope in MB/hour.
 */
export function lsSlopeMbPerHr(points: ISlopePoint[]): number;

/**
 * Theil-Sen slope of {t(ms), v(bytes)} points in MB/hour: the median of all pairwise slopes.
 * @param points The points to fit.
 * @returns The slope in MB/hour.
 */
export function theilSenSlopeMbPerHr(points: ISlopePoint[]): number;
