// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Remote metric sampler for cloud soak runs (Option B — see
 * .cursor/tasks/node/soak-cloud-memory/option-b-probe-plan.md for the probe that validated it).
 *
 * Samples one of the target node's own telemetry metrics through the same REST API and
 * credentials the soak scenario already uses. The primary use is memory
 * (`process_memory_rss_bytes`, the default), so cloud runs (SOAK_SKIP_SERVER=true) get a real
 * series into the memory-growth verdict instead of the empty stub; a second instance samples
 * `system_cpu_usage_percent` for the display-only CPU panel (run-soak.mjs) — no verdict math
 * depends on it, so it never affects pass/fail.
 *
 * Matches the local PID sampler's contract: sync peek()/stop() returning
 * [{ t: ms since sampler start, [valueField]: number }]. Polling happens on an interval in the
 * background; every poll re-queries the full window from sampler start (cursor-paginated) and
 * replaces the held series, so a transient failed poll never loses earlier points.
 *
 * The store may hold duplicate copies of a measurement (multi-tenant broadcast rows from before
 * the twin-telemetry context-batching fix, or windows spanning that deploy), so identical values
 * within a small time window are collapsed to one point.
 *
 * Sampling failures are logged (every one, not just the first) and never fatal: the sampler serves
 * the last good series — an empty memory series yields the existing non-fatal 'insufficient'
 * verdict downstream; an empty CPU series just means the CPU panel doesn't render.
 *
 * fetchTimeoutMs bounds each request so a stuck poll (e.g. the target's telemetry read waiting on
 * its own background flush, see soak-report-04/investigation.md) fails fast instead of tying up
 * the sampler's single in-flight slot for however long the server takes.
 */

const DEFAULT_METRIC_ID = 'process_memory_rss_bytes';
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEDUPE_WINDOW_MS = 1500;
const PAGE_LIMIT = 200;
const MAX_PAGES = 25;

/**
 * Create a remote sampler polling one of a node's telemetry values endpoints. Despite the name
 * (kept for the memory call site's field compatibility — see valueField), this also drives the
 * display-only CPU sampler with a different metricId/valueField.
 * @param options The sampler options.
 * @param options.baseUrl Base URL of the target node.
 * @param options.apiKey Tenant api key sent as x-api-key on every request.
 * @param options.email Admin user email for login.
 * @param options.password Admin user password for login.
 * @param options.metricId Metric id to sample, defaults to process_memory_rss_bytes.
 * @param options.valueField The field name to store each sampled value under, defaults to
 * rssBytes (memory-verdict.mjs's expected shape). Pass a different name for a non-memory metric
 * (e.g. 'cpuPercent') so its series is never mistaken for — or fed into — the memory verdict.
 * @param options.pollIntervalMs How often to poll, defaults to 60s (the collector cadence).
 * @param options.fetchTimeoutMs Per-request timeout, defaults to 15s. Applies to every request a
 * poll makes (login, user lookup, values query) so one stuck call can't hold the poll open for
 * the remainder of pollIntervalMs.
 * @param options.fetchImpl Fetch implementation, injectable for tests, defaults to global fetch.
 * @param options.log Logger (level, message), defaults to console-less no-op.
 * @returns The sampler handle: sync peek() and stop() returning the series snapshot.
 */
export function createRemoteMemorySampler({
	baseUrl,
	apiKey,
	email,
	password,
	metricId = DEFAULT_METRIC_ID,
	valueField = 'rssBytes',
	pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
	fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
	fetchImpl = fetch,
	log = () => {}
}) {
	const startMs = Date.now();
	let series = [];
	let auth; // { headers, organization } once logged in
	let stopped = false;
	let inFlight = false;
	let tickCount = 0;
	let failureCount = 0;
	// Set when the target answers 501: its telemetry connector does not implement reads, so no
	// later poll can succeed and polling stops after logging the reason once.
	let unsupported = false;

	async function fetchWithTimeout(url, init) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
		try {
			return await fetchImpl(url, { ...init, signal: controller.signal });
		} catch (err) {
			if (err?.name === 'AbortError') {
				throw new Error(`request timed out after ${fetchTimeoutMs}ms: ${url}`, { cause: err });
			}
			throw err;
		} finally {
			clearTimeout(timer);
		}
	}

	async function login() {
		const loginRes = await fetchWithTimeout(`${baseUrl}/authentication/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
			body: JSON.stringify({ email, password })
		});
		const setCookie = loginRes.headers.get('set-cookie') ?? '';
		const tokenMatch = /access_token=([^;]+)/.exec(setCookie);
		if (!loginRes.ok || !tokenMatch) {
			throw new Error(`login failed with status ${loginRes.status}`);
		}
		const headers = { Cookie: `access_token=${tokenMatch[1]}`, 'x-api-key': apiKey };

		const userRes = await fetchWithTimeout(
			`${baseUrl}/authentication/admin/users/${encodeURIComponent(email)}`,
			{ headers }
		);
		if (!userRes.ok) {
			throw new Error(`user lookup failed with status ${userRes.status}`);
		}
		const organization = (await userRes.json())?.organizationIdentity;
		return { headers, organization };
	}

	async function queryWindow() {
		auth ??= await login();
		const points = [];
		let cursor;
		let pages = 0;
		do {
			const params = new URLSearchParams({
				timeStart: String(startMs),
				timeEnd: String(Date.now()),
				limit: String(PAGE_LIMIT)
			});
			if (auth.organization) {
				params.set('organization', auth.organization);
			}
			if (cursor) {
				params.set('cursor', cursor);
			}
			const url = `${baseUrl}/telemetry/metric/${encodeURIComponent(metricId)}/value?${params.toString()}`;
			const res = await fetchWithTimeout(url, { headers: auth.headers });
			if (res.status === 401) {
				// Token expired mid-run (long soaks outlive the JWT TTL) — re-login and retry next poll.
				auth = undefined;
				throw new Error('values query returned 401 — re-authenticating on next poll');
			}
			if (!res.ok) {
				const error = new Error(`values query failed with status ${res.status}`);
				error.status = res.status;
				throw error;
			}
			const body = await res.json();
			points.push(...(body.entities ?? []));
			cursor = body.cursor;
			pages++;
		} while (cursor && pages < MAX_PAGES);
		return points;
	}

	function dedupeAndMap(points) {
		points.sort((a, b) => a.ts - b.ts);
		const mapped = [];
		let lastKept;
		for (const point of points) {
			const isDuplicate =
				lastKept && point.value === lastKept.value && point.ts - lastKept.ts <= DEDUPE_WINDOW_MS;
			if (!isDuplicate) {
				lastKept = point;
				mapped.push({ t: point.ts - startMs, [valueField]: point.value });
			}
		}
		return mapped;
	}

	async function tick() {
		if (stopped || inFlight) {
			return;
		}
		inFlight = true;
		tickCount++;
		try {
			const points = await queryWindow();
			if (!stopped) {
				series = dedupeAndMap(points);
			}
		} catch (err) {
			failureCount++;
			if (err?.status === 501) {
				unsupported = true;
				clearInterval(timer);
				log(
					'warn',
					`Remote memory sampler (${metricId}): the target answered 501 Not Implemented — its configured telemetry connector does not serve reads, so memory cannot be sampled from the node in this run. Polling stopped; the report will say so.`
				);
			} else {
				log(
					'warn',
					`Remote memory sampler (${metricId}): ${err?.message ?? err} — memory series may be incomplete (serving last good snapshot). Failed ${failureCount}/${tickCount} polls so far.`
				);
			}
		} finally {
			inFlight = false;
		}
	}

	const timer = setInterval(() => {
		tick();
	}, pollIntervalMs);
	tick();

	return {
		/** Poll counters and whether the target turned out not to implement telemetry reads. */
		status() {
			return { polls: tickCount, failures: failureCount, unsupported };
		},
		/** Snapshot the series so far, without halting sampling — used to evaluate an interim verdict. */
		peek() {
			return [...series];
		},
		stop() {
			stopped = true;
			clearInterval(timer);
			return [...series];
		}
	};
}
