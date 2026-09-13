// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The subset of run-soak.mjs's report.json this generator reads. Optional fields reflect real
 * variance across archived runs: warmupDiscardMs/startedIso/finishedIso were added in feat-262
 * phase 1 and are absent from pre-existing report.json files; signals/extended/preExtension*
 * were added by feat-367 and are likewise absent from runs recorded before it.
 */
export interface ISoakReport {
	/**
	 * Run configuration and thresholds.
	 */
	config: {
		/**
		 * The soak profile used (e.g. "cloud", "file-local").
		 */
		profile: string;
		/**
		 * The tenant mode ("multi" or "single").
		 */
		tenantMode: string;
		/**
		 * The k6 load duration, e.g. "1h".
		 */
		duration: string;
		/**
		 * The number of virtual users.
		 */
		vus: number;
		/**
		 * ISO timestamp when the run started. Absent on runs recorded before feat-262 phase 1.
		 */
		startedIso?: string;
		/**
		 * ISO timestamp when the run finished. Absent on runs recorded before feat-262 phase 1.
		 */
		finishedIso?: string;
		/**
		 * The warm-up window excluded from the memory growth slope, in milliseconds. Absent on
		 * runs recorded before feat-262 phase 1.
		 */
		warmupDiscardMs?: number;
		/**
		 * Where the memory series came from: "process" (local child process), "telemetry" (the
		 * target's telemetry endpoint) or "none". Absent on runs recorded before the telemetry sampler.
		 */
		memSource?: 'process' | 'telemetry' | 'none';
		/**
		 * True when the telemetry memory sampler found the target answering 501 on value reads, i.e.
		 * the node's telemetry connector does not implement reads. Absent on older runs.
		 */
		memSamplerUnsupported?: boolean;
		/**
		 * The configured pass/fail thresholds.
		 */
		thresholds: {
			p95Ms: number;
			p99Ms: number;
			errorRate: number | string;
			rssGrowthMbPerHr: number;
		};
	};
	/**
	 * The k6 load result.
	 */
	k6: {
		/**
		 * The k6 process exit code (0 = all thresholds passed).
		 */
		exitCode: number;
		/**
		 * HTTP request duration percentiles/stats, or undefined if k6 produced no summary.
		 */
		httpReqDuration?: {
			med: number;
			'p(95)': number;
			'p(99)': number;
			avg?: number;
			min?: number;
			max?: number;
		};
		/**
		 * HTTP request failure rate, or undefined if k6 produced no summary.
		 */
		httpReqFailed?: {
			rate: number;
		};
		/**
		 * Total HTTP request count/rate, or undefined if k6 produced no summary.
		 */
		httpReqs?: {
			count: number;
			rate: number;
		};
		/**
		 * Per-API-group request counts, error counts, and latency percentiles.
		 */
		groups?: Record<
			string,
			{
				reqs: number;
				errors: number;
				p50: number;
				p95: number;
				p99: number;
			}
		>;
		/**
		 * The k6 result from before the automatic memory-disambiguation extension (feat-367),
		 * or null/absent when the run was not extended.
		 */
		preExtension?: unknown;
	};
	/**
	 * The memory-growth verdict (see memory-verdict.d.mts's IMemoryVerdict — duplicated here
	 * as a loose shape since this generator only reads it, never evaluates it).
	 */
	memory: {
		verdict: 'informational' | 'insufficient' | 'pass' | 'breach';
		slopeMbPerHr: number;
		rawSlopeMbPerHr: number;
		samples: number;
		totalSamples: number;
		peakMb: number | null;
		/**
		 * Whether an automatic disambiguation extension ran (feat-367). Absent on older runs.
		 */
		extended?: boolean;
		/**
		 * The verdict before the extension, if one ran. Absent/null otherwise.
		 */
		preExtensionVerdict?: string | null;
	};
	/**
	 * The sampled RSS series. Empty when memory wasn't sampled (a cloud run with
	 * SOAK_MEM_SOURCE left at its default) — populated either from the local PID sampler or,
	 * for SOAK_MEM_SOURCE=telemetry cloud runs, from the target node's own telemetry store.
	 */
	series: { t: number; rssBytes: number }[];
	/**
	 * The sampled system_cpu_usage_percent series, display-only (no growth verdict). Present
	 * only for SOAK_MEM_SOURCE=telemetry cloud runs; absent (not an empty array) otherwise, so
	 * the report page can tell "not collected" from "collected but empty".
	 */
	cpuSeries?: { t: number; cpuPercent: number }[];
}

/**
 * One row of the run-history index, derived from a single report.json.
 */
export interface IRunEntry {
	/**
	 * The GitHub Actions run id (or a local identifier for non-CI runs) — the manifest's
	 * de-duplication key and the per-run directory name.
	 */
	runId: string;
	/**
	 * Link to the GitHub Actions run, or null when generated outside CI.
	 */
	runUrl: string | null;
	/**
	 * ISO timestamp of the run (config.startedIso, or a caller-supplied fallback for older
	 * report.json files that predate it).
	 */
	date: string;
	/**
	 * The soak profile used.
	 */
	profile: string;
	/**
	 * The k6 load duration.
	 */
	duration: string;
	/**
	 * The number of virtual users.
	 */
	vus: number;
	/**
	 * Overall pass/fail, derived from the k6 exit code.
	 */
	verdict: 'pass' | 'fail';
	/**
	 * The memory-growth verdict string (informational/insufficient/pass/breach).
	 */
	memVerdict: string;
	/**
	 * Total HTTP requests made during the run, or NaN if the k6 summary failed to parse.
	 */
	reqs: number;
	/**
	 * HTTP request failure rate, 0-1, or NaN if the k6 summary failed to parse.
	 */
	failedRate: number;
	/**
	 * p50 latency in milliseconds, or NaN if the k6 summary failed to parse.
	 */
	p50: number;
	/**
	 * p95 latency in milliseconds, or NaN if the k6 summary failed to parse.
	 */
	p95: number;
	/**
	 * p99 latency in milliseconds, or NaN if the k6 summary failed to parse.
	 */
	p99: number;
	/**
	 * The configured p95 threshold in milliseconds.
	 */
	p95Threshold: number;
	/**
	 * The configured p99 threshold in milliseconds.
	 */
	p99Threshold: number;
}

/**
 * Build a run-history manifest entry from a parsed report.json.
 * @param report The parsed report.json.
 * @param runId The unique id for this run (typically the GitHub Actions run id).
 * @param runUrl Link to the GitHub Actions run, or null when generated outside CI.
 * @returns The manifest entry for this run.
 */
export function buildRunEntry(report: ISoakReport, runId: string, runUrl: string | null): IRunEntry;

/**
 * Whether a string is safe to use as a --run-id path segment (used to build the on-disk report
 * directory). Restricts to a safe character set to prevent path traversal.
 * @param runId The candidate run id.
 * @returns True if runId is a non-empty string of letters, digits, underscores, and hyphens only.
 */
export function isValidRunId(runId: string): boolean;

/**
 * Returns a copy of a parsed k6 summary with setup_data.token (the admin session token used to
 * drive the run) redacted, if present. Never mutates the input.
 * @param summary The parsed k6 summary.json contents.
 * @returns A copy of summary with setup_data.token redacted, or summary unchanged if it has no
 * such field.
 */
export function redactSummary(summary: unknown): unknown;

/**
 * Render a self-contained HTML report page for a single run. No external resources are
 * referenced (no CDN scripts/stylesheets/fonts) so the page renders correctly offline.
 * @param report The parsed report.json.
 * @param entry This run's manifest entry (reused so the page and the index never disagree
 * on headline numbers).
 * @returns The complete report.html document as a string.
 */
export function renderRunPage(report: ISoakReport, entry: IRunEntry): string;

/**
 * Merge a new run entry into an existing manifest, de-duplicating by runId (a re-run of the
 * same workflow attempt overwrites its own prior entry instead of appending a duplicate) and
 * sorting newest-first by date.
 * @param existingRuns The current manifest contents (empty array if none yet).
 * @param entry The run entry to merge in.
 * @returns The updated manifest, newest-first.
 */
export function updateManifest(existingRuns: IRunEntry[], entry: IRunEntry): IRunEntry[];

/**
 * Render the run-history index page listing every run in the manifest, newest first.
 * @param runs The manifest, as returned by updateManifest.
 * @returns The complete index.html document as a string.
 */
export function renderIndex(runs: IRunEntry[]): string;
