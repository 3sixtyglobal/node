// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IMemorySample } from "../../../soak/memory-verdict.d.mts";

/**
 * Shape knobs for a synthetic RSS series. Defaults are tuned against the two real archived
 * next.16 fixtures (181 samples, 10s cadence, RSS range ~260-1305 MB, mean |step| ~85 MB,
 * max |step| ~520 MB) so a "flat" synthetic is not cleaner than a real run.
 */
export interface ISyntheticSeriesOptions {
	/**
	 * Seed for the deterministic PRNG. Different seeds produce different noise realizations
	 * of the same underlying shape.
	 */
	seed: number;
	/**
	 * Number of samples. Defaults to 181 (a real 30m run at the 10s default cadence).
	 */
	sampleCount?: number;
	/**
	 * Sample interval in milliseconds. Defaults to 10000 (the harness default).
	 */
	intervalMs?: number;
	/**
	 * Baseline post-GC floor in MB, before drift or warm-up. Defaults to 350.
	 */
	baseFloorMb?: number;
	/**
	 * Peak-to-peak size of the GC sawtooth riding on the floor, in MB. Defaults to 500.
	 */
	sawtoothAmplitudeMb?: number;
	/**
	 * Period of the GC sawtooth in milliseconds. Defaults to 100000.
	 */
	sawtoothPeriodMs?: number;
	/**
	 * Per-sample noise amplitude in MB (uniform jitter). Defaults to 25.
	 */
	noiseMb?: number;
	/**
	 * Linear drift applied to the floor for the whole series, in MB/hour. Zero means no real growth.
	 */
	floorSlopeMbPerHr?: number;
	/**
	 * Extra floor rise (MB) that ramps in linearly and then plateaus — models cold-cache/pool
	 * fill rather than a genuine leak. Zero disables it.
	 */
	warmupRiseMb?: number;
	/**
	 * How long the warm-up rise takes to fully plateau, in milliseconds. Ignored if warmupRiseMb is 0.
	 */
	warmupDurationMs?: number;
}

/* eslint-disable no-bitwise -- mulberry32 is a bitwise PRNG algorithm; the bit ops are the implementation, not incidental */

/**
 * Deterministic PRNG (mulberry32). Same seed always produces the same sequence.
 * @param seed The seed value.
 * @returns A function returning the next pseudo-random value in [0, 1).
 */
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/* eslint-enable no-bitwise */

/**
 * Generate a synthetic RSS series: a floor (baseline + optional linear drift + optional
 * plateauing warm-up rise) with a GC sawtooth and per-sample noise riding on top.
 * @param options The series shape and noise parameters.
 * @returns The generated series, in the same shape run-soak.mjs's sampler produces.
 */
export function generateSyntheticSeries(options: ISyntheticSeriesOptions): IMemorySample[] {
	const sampleCount = options.sampleCount ?? 181;
	const intervalMs = options.intervalMs ?? 10_000;
	const baseFloorMb = options.baseFloorMb ?? 350;
	const amplitudeMb = options.sawtoothAmplitudeMb ?? 500;
	const periodMs = options.sawtoothPeriodMs ?? 100_000;
	const noiseMb = options.noiseMb ?? 25;
	const floorSlopeMbPerHr = options.floorSlopeMbPerHr ?? 0;
	const warmupRiseMb = options.warmupRiseMb ?? 0;
	const warmupDurationMs = options.warmupDurationMs ?? 0;

	const random = mulberry32(options.seed);
	const series: IMemorySample[] = [];
	for (let i = 0; i < sampleCount; i++) {
		const t = i * intervalMs;
		const drift = (floorSlopeMbPerHr * t) / 3_600_000;
		const warmup = warmupDurationMs > 0 ? warmupRiseMb * Math.min(1, t / warmupDurationMs) : 0;
		const floor = baseFloorMb + drift + warmup;
		const phase = (t % periodMs) / periodMs;
		const sawtooth = amplitudeMb * phase;
		const noise = (random() - 0.5) * 2 * noiseMb;
		const rssMb = Math.max(1, floor + sawtooth + noise);
		series.push({ t, rssBytes: Math.round(rssMb * 1_000_000) });
	}
	return series;
}

/**
 * A flat series with no real growth — the ground truth is "pass". Different seeds give
 * independent noise realizations of the same identical-code scenario the issue describes.
 * @param seed The PRNG seed.
 * @returns The generated series.
 */
export function generateFlatSeries(seed: number): IMemorySample[] {
	return generateSyntheticSeries({ seed });
}

/**
 * A genuine sustained leak — the ground truth is "breach". The positive control the issue's
 * second acceptance criterion requires, since no archived run has a real sampled leak.
 * @param seed The PRNG seed.
 * @param slopeMbPerHr The sustained floor growth rate, in MB/hour. Defaults to 300.
 * @param sampleCount Total samples — 181 for a 30m run, 361 to model one 30m extension.
 * @returns The generated series.
 */
export function generateLeakSeries(
	seed: number,
	slopeMbPerHr = 300,
	sampleCount = 181
): IMemorySample[] {
	return generateSyntheticSeries({ seed, sampleCount, floorSlopeMbPerHr: slopeMbPerHr });
}

/**
 * A rise that plateaus well before the run ends (cold-cache/pool fill, not a leak) — the
 * ground truth is "pass". Models the settling pattern, not a sustained trend.
 * @param seed The PRNG seed.
 * @returns The generated series.
 */
export function generateWarmupOnlySeries(seed: number): IMemorySample[] {
	return generateSyntheticSeries({ seed, warmupRiseMb: 100, warmupDurationMs: 480_000 });
}

/**
 * A rise that only plateaus near the very end of the run — the harder edge case, since a
 * short-tailed estimator may still see it as rising. Ground truth is still "pass": it settles
 * within the window, it just does so late. Models next16-run2-clean-db's cold-start pattern
 * more closely than generateWarmupOnlySeries.
 * @param seed The PRNG seed.
 * @returns The generated series.
 */
export function generateWarmupLateSeries(seed: number): IMemorySample[] {
	return generateSyntheticSeries({ seed, warmupRiseMb: 90, warmupDurationMs: 1_200_000 });
}

/**
 * A slow-settling rise that takes half the run to plateau (15m of a 30m window) — long enough,
 * and large enough relative to the window, that the whole-window fit still reads as a breach at
 * 30 minutes even though the system has genuinely settled. Ground truth is "pass", but only
 * once observed for longer: this is the real edge case the Phase 4 auto-extend protocol exists
 * for, verified empirically to resolve once the same series is generated with a larger
 * sampleCount (the PRNG draws are identical for the shared prefix, so extending is exact).
 * @param seed The PRNG seed.
 * @param sampleCount Total samples — 181 for the initial 30m run, 361 to model one 30m extension.
 * @returns The generated series.
 */
export function generateSlowSettlingSeries(seed: number, sampleCount = 181): IMemorySample[] {
	return generateSyntheticSeries({
		seed,
		sampleCount,
		warmupRiseMb: 90,
		warmupDurationMs: 900_000
	});
}

/**
 * A short window (12m) carrying a leak-like slope. Landed as "informational" (window too short
 * to enforce, not "breach") when measured: 72 samples at the default 10s cadence span ~590s of
 * usable window after a 2m discard — just under the 10m minimum. Useful for the Phase 4 trigger
 * table test's negative case (informational never extends), not for the estimator-selection
 * matrix or for exercising a resolved breach.
 * @param seed The PRNG seed.
 * @returns The generated series.
 */
export function generateShortBorderlineSeries(seed: number): IMemorySample[] {
	return generateSyntheticSeries({ seed, sampleCount: 72, floorSlopeMbPerHr: 300 });
}
