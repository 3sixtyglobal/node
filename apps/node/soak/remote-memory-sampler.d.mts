// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IMemorySample } from './memory-verdict.d.mts';

/**
 * One sampled point with a caller-chosen value field name (see valueField), used for metrics
 * other than memory (e.g. { t, cpuPercent }) where IMemorySample's fixed rssBytes shape doesn't fit.
 */
export interface INamedValueSample {
	/**
	 * Milliseconds since the sampler started.
	 */
	t: number;
	/**
	 * The sampled value, keyed by whichever field name valueField specified.
	 */
	[valueField: string]: number;
}

/**
 * Options for creating a remote metric sampler.
 */
export interface IRemoteMemorySamplerOptions {
	/**
	 * Base URL of the target node.
	 */
	baseUrl: string;
	/**
	 * Tenant api key sent as x-api-key on every request.
	 */
	apiKey: string;
	/**
	 * Admin user email for login.
	 */
	email: string;
	/**
	 * Admin user password for login.
	 */
	password: string;
	/**
	 * Metric id to sample, defaults to process_memory_rss_bytes.
	 */
	metricId?: string;
	/**
	 * The field name to store each sampled value under, defaults to rssBytes
	 * (memory-verdict.mjs's expected shape). Pass a different name (e.g. 'cpuPercent') for a
	 * non-memory metric so its series is never mistaken for, or fed into, the memory verdict.
	 */
	valueField?: string;
	/**
	 * How often to poll, defaults to 60s (the collector cadence).
	 */
	pollIntervalMs?: number;
	/**
	 * Per-request timeout in milliseconds, defaults to 15s. Applies to every request a poll makes
	 * (login, user lookup, values query) so one stuck call can't hold the poll open for the
	 * remainder of pollIntervalMs.
	 */
	fetchTimeoutMs?: number;
	/**
	 * Fetch implementation, injectable for tests, defaults to global fetch.
	 */
	fetchImpl?: typeof fetch;
	/**
	 * Logger (level, message).
	 */
	log?: (level: string, message: string) => void;
}

/**
 * The sampler handle, matching the local PID sampler's contract.
 */
export interface IRemoteMemorySampler {
	/**
	 * Poll counters and whether the target answered 501 on value reads, meaning its telemetry
	 * connector does not implement reads and polling was stopped.
	 */
	status(): { polls: number; failures: number; unsupported: boolean };
	/**
	 * Snapshot the series so far, without halting sampling.
	 */
	peek(): (IMemorySample | INamedValueSample)[];
	/**
	 * Halt sampling and return the final series snapshot.
	 */
	stop(): (IMemorySample | INamedValueSample)[];
}

/**
 * Create a remote metric sampler polling one of a node's telemetry values endpoints — memory by
 * default (feeding the memory-growth verdict), or any other gauge metric via metricId/valueField
 * for display-only use (e.g. CPU).
 * @param options The sampler options.
 * @returns The sampler handle: sync peek() and stop() returning the series snapshot.
 */
export function createRemoteMemorySampler(
	options: IRemoteMemorySamplerOptions
): IRemoteMemorySampler;
