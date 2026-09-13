// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * k6 soak scenario for the twin-node server.
 *
 * Weighted traffic mix across 10 API areas.
 * Each VU authenticates on first iteration and re-authenticates on 401. Per-iteration a
 * single group is chosen by weighted random. Per-group custom metrics are declared so they
 * appear in handleSummary and report.json.
 *
 * Config is passed via --env from the orchestrator (run-soak.mjs). Run through that, not directly.
 *
 * NB: this is a k6 script, not Node — it runs in the k6 JS runtime. `__ENV`/`__VU`/`__ITER`
 * are k6 globals, and `http_req_duration` / `http_req_failed` are k6's built-in metric names
 * (fixed by the k6 API), hence the global declaration and the camelcase exception below.
 */

/* global __ENV, __VU, __ITER */
/* eslint-disable camelcase -- k6 built-in metric names are snake_case and fixed by the k6 API */

import { check, fail } from 'k6';
import encoding from 'k6/encoding';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE = __ENV.SOAK_BASE_URL;
const API_KEY = __ENV.SOAK_TENANT_API_KEY || '';
const EMAIL = __ENV.SOAK_ADMIN_EMAIL;
const PASSWORD = __ENV.SOAK_ADMIN_PASSWORD;
const MULTI = (__ENV.SOAK_TENANT_MODE || 'multi') === 'multi';
const WRITE_RATIO = Number(__ENV.SOAK_WRITE_RATIO || 0.3);
// Comma-separated list of group names to skip entirely (probes + VU traffic).
// Use when a feature is unavailable on the target node (e.g. SOAK_DISABLED_GROUPS=logging).
const DISABLED_GROUPS = new Set(
	(__ENV.SOAK_DISABLED_GROUPS || '')
		.split(',')
		.map(s => s.trim())
		.filter(Boolean)
);

// ---------------------------------------------------------------------------
// Group definitions and weighted picker
// ---------------------------------------------------------------------------

/**
 * Traffic weights. Must sum to 1.0.
 * To tune: change the weight values; the picker recalculates automatically.
 */
const ALL_GROUPS = [
	{ name: 'logging', weight: 0.15 },
	{ name: 'blob', weight: 0.12 },
	{ name: 'aig', weight: 0.12 },
	{ name: 'ais', weight: 0.12 },
	{ name: 'identity', weight: 0.12 },
	{ name: 'telemetry', weight: 0.08 },
	{ name: 'auth', weight: 0.07 },
	{ name: 'notarization', weight: 0.08 },
	{ name: 'fedcat', weight: 0.07 },
	{ name: 'dataspace', weight: 0.07 }
];

// Re-normalise weights after removing disabled groups so they still sum to 1.
const ENABLED_GROUPS = ALL_GROUPS.filter(g => !DISABLED_GROUPS.has(g.name));
if (ENABLED_GROUPS.length === 0) {
	throw new Error(
		`SOAK_DISABLED_GROUPS disables all groups; available groups: ${ALL_GROUPS.map(g => g.name).join(', ')}`
	);
}
const enabledTotal = ENABLED_GROUPS.reduce((s, g) => s + g.weight, 0);
const GROUPS = ENABLED_GROUPS.map(g => ({ name: g.name, weight: g.weight / enabledTotal }));
const GROUP_NAMES = GROUPS.map(g => g.name);

// Build cumulative probability table once at module init.
const CDF = [];
let cumulative = 0;
for (const g of GROUPS) {
	cumulative += g.weight;
	CDF.push({ name: g.name, p: cumulative });
}

function buildCdf(groups) {
	const total = groups.reduce((s, g) => s + g.weight, 0);
	const cdf = [];
	let acc = 0;
	for (const g of groups) {
		acc += g.weight / total;
		cdf.push({ name: g.name, p: acc });
	}
	return cdf;
}

// Set per VU on the first iteration from setup()'s data, so groups the target cannot serve are
// never picked; falls back to the module-level CDF when setup() reported none.
let vuCdf;

function pickGroup(unavailableGroups) {
	if (!vuCdf) {
		const unavailable = new Set(unavailableGroups ?? []);
		vuCdf = unavailable.size > 0 ? buildCdf(GROUPS.filter(g => !unavailable.has(g.name))) : CDF;
	}
	const r = Math.random();
	for (const entry of vuCdf) {
		if (r < entry.p) {
			return entry.name;
		}
	}
	return vuCdf[vuCdf.length - 1].name;
}

// ---------------------------------------------------------------------------
// Per-group custom metrics
// ---------------------------------------------------------------------------

const grpDuration = {};
const grpReqs = {};
const grpErrors = {};

for (const name of GROUP_NAMES) {
	grpDuration[name] = new Trend(`grp_${name}_duration`, true);
	grpReqs[name] = new Counter(`grp_${name}_reqs`);
	grpErrors[name] = new Counter(`grp_${name}_errors`);
}

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

export const options = {
	scenarios: {
		soak: {
			executor: 'constant-vus',
			vus: Number(__ENV.SOAK_VUS || 5),
			duration: __ENV.SOAK_DURATION || '30s'
		}
	},
	// Cloud setup probes 12 endpoints over a remote connection (~500 ms each).
	// The default 60 s is too tight; 180 s gives a 15× margin per request.
	setupTimeout: '180s',
	thresholds: {
		http_req_duration: [`p(95)<${__ENV.SOAK_P95_MS || 500}`, `p(99)<${__ENV.SOAK_P99_MS || 1500}`],
		http_req_failed: [`rate<${__ENV.SOAK_ERROR_RATE || 0.01}`]
	},
	summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)']
};

// ---------------------------------------------------------------------------
// Per-VU state
// ---------------------------------------------------------------------------

// k6 keeps module scope per VU for the VU's lifetime. Each VU accumulates its own
// created resource IDs so subsequent reads/updates go to real stored data.
const ctx = {
	token: null,
	tokenExp: 0,
	org: null,
	blobId: null,
	aigId: null,
	aisId: null,
	notarizationId: null,
	fedcatDatasetId: null,
	dataspaceDatasetId: null,
	trustToken: null,
	trustExp: 0
};

// ---------------------------------------------------------------------------
// setup() — preflight: log in once and probe each group's read endpoint.
// Runs before any VUs start. Fails the whole run early on a bad path.
// ---------------------------------------------------------------------------

export function setup() {
	const session = login();
	if (!session.token) {
		const detail = String(session.body ?? '').slice(0, 500);
		fail(
			`setup: login failed — HTTP ${session.status}: ${detail || '(no response body)'} ` +
				'— check SOAK_ADMIN_EMAIL / SOAK_ADMIN_PASSWORD / SOAK_TENANT_API_KEY'
		);
	}
	// eslint-disable-next-line no-console
	console.log('[setup] org =', session.org, '| MULTI =', MULTI);

	// Generate a trust token — needed for fedcat dataset creation (endpoint requires trust auth).
	const tRes = http.post(
		`${BASE}/identity/${encodeURIComponent(session.org)}/verifiable-credential/trust-assertion`,
		JSON.stringify({
			credentialId: 'https://soak.example.com/creds/setup',
			subject: { '@context': 'https://schema.org', '@type': 'SoakProbe' }
		}),
		{
			headers: { Cookie: `access_token=${session.token}`, 'Content-Type': 'application/json' },
			tags: { name: 'setup_trust_token' }
		}
	);
	if (tRes.status !== 200) {
		fail(`setup: trust token generation failed — ${tRes.status} ${tRes.body?.slice(0, 300) ?? ''}`);
	}
	let setupTrustToken = null;
	try {
		setupTrustToken = JSON.parse(tRes.body).jwt;
	} catch {}
	if (!setupTrustToken) {
		fail(`setup: trust token JWT missing from response — ${tRes.body?.slice(0, 300) ?? ''}`);
	}

	const probes = [
		{
			area: 'auth',
			method: 'GET',
			url: `/authentication/admin/users/${encodeURIComponent(EMAIL)}`,
			ok: [200]
		},
		{ area: 'logging', method: 'GET', url: '/logging?limit=1', ok: [200] },
		{ area: 'blob', method: 'GET', url: '/blob?limit=1', ok: [200] },
		{ area: 'aig', method: 'GET', url: '/aig?limit=1', ok: [200] },
		{ area: 'ais', method: 'GET', url: '/ais?limit=1', ok: [200] },
		{ area: 'identity', method: 'GET', url: '/identity/profile', ok: [200] },
		{ area: 'telemetry', method: 'GET', url: '/telemetry/metric?limit=1', ok: [200] },
		{
			area: 'notarization',
			method: 'POST',
			url: '/notarization',
			body: { mode: 'dynamic', data: encoding.b64encode('soak-probe'), description: 'soak probe' },
			ok: [201]
		},
		{
			area: 'fedcat',
			method: 'POST',
			url: '/catalog/datasets',
			body: {
				'@context': {
					dcat: 'http://www.w3.org/ns/dcat#',
					dcterms: 'http://purl.org/dc/terms/',
					odrl: 'http://www.w3.org/ns/odrl/2/'
				},
				'@id': 'https://soak.example.com/datasets/soak-probe-dataset',
				'@type': 'dcat:Dataset',
				'dcterms:title': 'soak probe dataset',
				'dcterms:publisher': 'https://soak.example.com/participants/soak-node',
				'dcat:distribution': {
					'@type': 'dcat:Distribution',
					'@id': 'https://soak.example.com/distributions/soak-probe-dist',
					'dcterms:format': 'HttpData-PULL',
					'dcat:accessService': 'https://soak.example.com/services/soak-node'
				},
				'odrl:hasPolicy': {
					'@context': 'http://www.w3.org/ns/odrl/2/',
					'@type': 'Offer',
					uid: 'https://soak.example.com/policies/soak-probe-policy',
					assigner: 'https://soak.example.com/participants/soak-node',
					permission: [{ action: 'use' }]
				}
			},
			ok: [201, 204]
		},
		{ area: 'dataspace', method: 'GET', url: '/dataspace/app-datasets?limit=1', ok: [200] }
	];

	const activeProbes = probes.filter(p => !DISABLED_GROUPS.has(p.area));
	// Groups whose probe answered 501 Not Implemented: the target's configured connector does not
	// serve that API at all (e.g. telemetry reads with an OpenTelemetry-only connector), so the
	// group is disabled for this run rather than aborting the whole soak.
	const unavailableGroups = [];
	for (const probe of activeProbes) {
		// eslint-disable-next-line no-console
		console.log(`[setup] probing ${probe.area}...`);
		let url = `${BASE}${probe.url}`;
		if (session.org) {
			const sep = probe.url.includes('?') ? '&' : '?';
			url += `${sep}organization=${encodeURIComponent(session.org)}`;
		}
		const params = {
			headers: { Cookie: `access_token=${session.token}` },
			tags: { name: `setup_probe_${probe.area}` }
		};
		if (probe.area === 'fedcat' && setupTrustToken) {
			params.headers['Authorization'] = `Bearer ${setupTrustToken}`;
		}
		let res;
		if (probe.method === 'POST') {
			params.headers['Content-Type'] = 'application/json';
			res = http.post(url, JSON.stringify(probe.body), params);
		} else {
			res = http.get(url, params);
		}
		if (res.status === 501) {
			unavailableGroups.push(probe.area);
			// eslint-disable-next-line no-console
			console.warn(
				`[setup] area "${probe.area}" returned 501 Not Implemented at ${url} — the target does not implement this API with its configured connectors; group disabled for this run`
			);
		} else if (!probe.ok.includes(res.status)) {
			fail(
				`setup: area "${probe.area}" returned ${res.status} at ${url} — ${res.body?.slice(0, 120) ?? ''} (check feature flag, REST path, credentials, or organization param; org=${session.org})`
			);
		}
	}
	if (unavailableGroups.length === ENABLED_GROUPS.length) {
		fail(
			`setup: every enabled group returned 501 (${unavailableGroups.join(', ')}); nothing left to run`
		);
	}

	return { token: session.token, org: session.org, unavailableGroups };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function login() {
	const loginHeaders = { 'Content-Type': 'application/json' };
	// Sent whenever a key is configured. Any node running in multi-tenant mode rejects every
	// request without it (401 tenantProcessor.missingApiKey), including this login — that
	// applies to cloud targets too, so SOAK_TENANT_API_KEY must be set for those.
	if (API_KEY) {
		loginHeaders['x-api-key'] = API_KEY;
	}
	const res = http.post(
		`${BASE}/authentication/login`,
		JSON.stringify({ email: EMAIL, password: PASSWORD }),
		{
			headers: loginHeaders,
			tags: { name: 'login' }
		}
	);
	check(res, { 'login 200': r => r.status === 200 });

	let token;
	if (res.cookies?.access_token?.[0]?.value) {
		token = res.cookies.access_token[0].value;
	} else {
		const sc = res.headers['Set-Cookie'];
		const raw = Array.isArray(sc) ? sc.join(';') : sc || '';
		const m = /access_token=([^\s,;]+)/.exec(raw);
		token = m ? m[1] : undefined;
	}

	let org;
	let exp;
	if (token) {
		try {
			// JWT uses base64url (no padding). Convert to standard base64 before decoding
			// to avoid any runtime differences in rawurl handling across k6 versions.
			const raw = token.split('.')[1];
			const b64 =
				raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (raw.length % 4)) % 4);
			const payload = JSON.parse(encoding.b64decode(b64, 'std', 's'));
			org = payload.org;
			exp = payload.exp;
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error('[login] JWT org extraction failed:', String(e));
		}
	}
	// status/body are returned so a failed login can report why (an auth rejection, a tenant
	// processor rejecting a missing x-api-key, a 5xx) instead of only that it failed.
	return { token, org, exp, status: res.status, body: res.body };
}

function authHeaders() {
	return ctx.token ? { Cookie: `access_token=${ctx.token}` } : {};
}

// Generate/refresh the org trust token (a JWT-encoded W3C VC). Used as a Bearer token
// for catalog requests. Refreshes proactively 60s before expiry so no
// request ever sends a stale token — this mirrors real client behaviour.
function ensureTrustToken() {
	const nowSec = Date.now() / 1000;
	if (ctx.trustToken && nowSec < ctx.trustExp - 60) {
		return;
	}
	const url = `${BASE}/identity/${encodeURIComponent(ctx.org)}/verifiable-credential/trust-assertion`;
	const body = JSON.stringify({
		credentialId: `https://soak.example.com/creds/${__VU}-${__ITER}`,
		subject: { '@context': 'https://schema.org', '@type': 'SoakRun', id: ctx.org }
	});
	const res = http.post(url, body, {
		headers: { ...authHeaders(), 'Content-Type': 'application/json' },
		tags: { name: 'trust_token_generate' }
	});
	if (res.status !== 200) {
		// Leave trustToken null; fedcat read will fall back to no-auth (endpoint is skipAuth).
		return;
	}
	try {
		const parsed = JSON.parse(res.body);
		ctx.trustToken = parsed.jwt;
		const raw = ctx.trustToken.split('.')[1];
		const b64 = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (raw.length % 4)) % 4);
		const payload = JSON.parse(encoding.b64decode(b64, 'std', 's'));
		ctx.trustExp = payload.exp ?? nowSec + 3600;
	} catch {
		ctx.trustExp = nowSec + 3600;
	}
}

// Refreshes the main session token proactively, before it expires, instead of waiting for a
// 401 (the old behaviour — see record()'s fallback below). All VUs log in within seconds of
// each other at the start of a run, so their tokens share almost the same expiry; without
// staggering, every VU would hit /authentication/login in the same instant the moment that
// shared expiry arrives. A 5h cloud run hit exactly this: the token expired 1h in, and the
// resulting thundering herd of simultaneous re-logins appears to have tripped the server's
// auth rate limiter, locking out the remaining 4h of the run (81.64% failure).
// The refresh buffer is offset per-VU (60s + 10s * __VU) so VUs refresh a few seconds apart
// rather than all at once, even though they started together.
function ensureSessionToken() {
	const nowSec = Date.now() / 1000;
	const vuOffsetSec = 10 * __VU; // stagger refreshes by 10s per VU
	const refreshBufferSec = 60 + vuOffsetSec;
	if (ctx.token && nowSec < ctx.tokenExp - refreshBufferSec) {
		return;
	}
	const s = login();
	ctx.token = s.token;
	ctx.org = s.org;
	ctx.tokenExp = s.exp ?? nowSec + 3600;
}

function trustHeaders() {
	return ctx.trustToken ? { Authorization: `Bearer ${ctx.trustToken}` } : {};
}

function orgParam(hasExisting) {
	if (!ctx.org) {
		return '';
	}
	return `${hasExisting ? '&' : '?'}organization=${encodeURIComponent(ctx.org)}`;
}

// Extracts the resource id from a create response's Location header. Location is the full
// absolute URL (e.g. http://host/aig/aig%3Axyz) — only the trailing path segment is the id,
// so it must be split off before decoding. Decoding the whole URL instead of just the segment
// produced a mangled, doubled URL on every subsequent request (see bug write-up).
function locationId(res) {
	const loc = res.headers?.Location || res.headers?.location || '';
	if (!loc) {
		return null;
	}
	const segment = loc.split('/').pop();
	return segment ? decodeURIComponent(segment) : null;
}

const failureLogCount = {};
const MAX_LOGGED_FAILURES_PER_GROUP = 20;

// Logs enough of the response to diagnose a failure (status, k6-level error, truncated body)
// without flooding CI logs during a catastrophic run — caps at 20 lines per group, same order
// of magnitude as a one-off intermittent issue, far below a mass-failure run's request count.
function logFailure(group, res) {
	failureLogCount[group] = (failureLogCount[group] ?? 0) + 1;
	const n = failureLogCount[group];
	if (n > MAX_LOGGED_FAILURES_PER_GROUP) {
		if (n === MAX_LOGGED_FAILURES_PER_GROUP + 1) {
			// eslint-disable-next-line no-console
			console.error(
				`[${group}] further failures suppressed after ${MAX_LOGGED_FAILURES_PER_GROUP} logged`
			);
		}
		return;
	}
	const body = typeof res.body === 'string' ? res.body.slice(0, 300) : '';
	// eslint-disable-next-line no-console
	console.error(
		`[${group}] status=${res.status} duration=${res.timings.duration.toFixed(0)}ms error=${res.error || ''} body=${body}`
	);
}

function record(group, res, successCheck) {
	grpReqs[group].add(1);
	grpDuration[group].add(res.timings.duration);
	if (!successCheck) {
		grpErrors[group].add(1);
		logFailure(group, res);
	}
	// Fallback safety net: ensureSessionToken() should refresh well before expiry, so this
	// should rarely fire. If a 401 slips through anyway (e.g. clock drift), clear the token
	// so the next iteration re-authenticates immediately instead of retrying a dead one. Any
	// remaining requests in the current group call still fire without auth and fail gracefully.
	if (res.status === 401) {
		ctx.token = null;
	}
}

// ---------------------------------------------------------------------------
// Group handlers
// ---------------------------------------------------------------------------

function doLogging() {
	const g = 'logging';
	const body = JSON.stringify({
		level: 'info',
		source: 'k6-soak',
		message: `iter ${__VU}-${__ITER}`
	});
	const res = http.post(`${BASE}/logging${orgParam(false)}`, body, {
		headers: { ...authHeaders(), 'Content-Type': 'application/json' },
		tags: { name: 'logging_write' }
	});
	const ok = check(res, { 'logging 204': r => r.status === 204 });
	record(g, res, ok);

	// Every ~20th iteration also list recent log entries (table grows large under sustained load).
	if (__ITER % 20 === 0) {
		const listRes = http.get(`${BASE}/logging?source=k6-soak&limit=20${orgParam(true)}`, {
			headers: authHeaders(),
			tags: { name: 'logging_list' }
		});
		const listOk = check(listRes, { 'logging list 200': r => r.status === 200 });
		record(g, listRes, listOk);
	}
}

function doBlob() {
	const g = 'blob';

	if (!ctx.blobId || Math.random() < WRITE_RATIO) {
		const blob = encoding.b64encode('soak-test-payload');
		const body = JSON.stringify({
			blob,
			metadata: { '@context': 'https://schema.org', '@type': 'DigitalDocument', name: 'soak' }
		});
		const res = http.post(`${BASE}/blob${orgParam(false)}`, body, {
			headers: { ...authHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'blob_create' }
		});
		const ok = check(res, { 'blob 201': r => r.status === 201 });
		record(g, res, ok);
		const id = locationId(res);
		if (id) {
			ctx.blobId = id;
		}
	} else {
		const id = ctx.blobId;
		const metaRes = http.get(`${BASE}/blob/${id}${orgParam(false)}`, {
			headers: authHeaders(),
			tags: { name: 'blob_read' }
		});
		const metaOk = check(metaRes, { 'blob meta 200': r => r.status === 200 });
		record(g, metaRes, metaOk);

		const contentRes = http.get(`${BASE}/blob/${id}/content${orgParam(false)}`, {
			headers: authHeaders(),
			tags: { name: 'blob_content' }
		});
		const contentOk = check(contentRes, { 'blob content 200': r => r.status === 200 });
		record(g, contentRes, contentOk);
	}
}

function doAig() {
	const g = 'aig';

	if (!ctx.aigId || Math.random() < WRITE_RATIO) {
		const body = JSON.stringify({
			'@context': ['https://schema.twindev.org/aig/', 'https://schema.twindev.org/common/'],
			type: 'AuditableItemGraphVertex',
			annotationObject: {
				'@context': 'https://schema.org',
				'@type': 'Note',
				content: `soak ${__VU}-${__ITER}`
			}
		});
		const res = http.post(`${BASE}/aig${orgParam(false)}`, body, {
			headers: { ...authHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'aig_create' }
		});
		const ok = check(res, { 'aig 201': r => r.status === 201 });
		record(g, res, ok);
		const id = locationId(res);
		if (id) {
			ctx.aigId = id;
		}
	} else {
		const id = ctx.aigId;
		const res = http.get(`${BASE}/aig/${id}${orgParam(false)}`, {
			headers: authHeaders(),
			tags: { name: 'aig_read' }
		});
		const ok = check(res, { 'aig read 200': r => r.status === 200 });
		record(g, res, ok);

		// Occasional list.
		if (__ITER % 7 === 0) {
			const listRes = http.get(`${BASE}/aig?limit=20${orgParam(true)}`, {
				headers: authHeaders(),
				tags: { name: 'aig_list' }
			});
			const listOk = check(listRes, { 'aig list 200': r => r.status === 200 });
			record(g, listRes, listOk);
		}
	}
}

function doAis() {
	const g = 'ais';

	// Create stream once per VU.
	if (!ctx.aisId) {
		const body = JSON.stringify({
			'@context': [
				'https://schema.org',
				'https://schema.twindev.org/ais/',
				'https://schema.twindev.org/common/'
			],
			type: 'AuditableItemStream',
			// Disables gas-consuming immutable-proof checks for this stream (0 = never, per the
			// model's own docs). Soak traffic doesn't need real on-chain notarization and was
			// draining the shared testnet wallet — see bug write-up on AIG/AIS gas exhaustion.
			immutableInterval: 0,
			annotationObject: {
				'@context': 'https://schema.org',
				'@type': 'Note',
				content: 'soak stream'
			}
		});
		const res = http.post(`${BASE}/ais${orgParam(false)}`, body, {
			headers: { ...authHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'ais_create' }
		});
		const ok = check(res, { 'ais 201': r => r.status === 201 });
		record(g, res, ok);
		const id = locationId(res);
		if (id) {
			ctx.aisId = id;
		}
		return;
	}

	// Add an entry.
	const id = ctx.aisId;
	const entryBody = JSON.stringify({
		entryObject: {
			'@context': 'https://schema.org',
			'@type': 'Event',
			startDate: new Date().toISOString(),
			description: 'soak entry'
		}
	});
	const writeRes = http.post(`${BASE}/ais/${id}/entries${orgParam(false)}`, entryBody, {
		headers: { ...authHeaders(), 'Content-Type': 'application/json' },
		tags: { name: 'ais_entry' }
	});
	const writeOk = check(writeRes, { 'ais entry 201': r => r.status === 201 });
	record(g, writeRes, writeOk);

	// Read entries.
	const readRes = http.get(`${BASE}/ais/${id}/entries?limit=20${orgParam(true)}`, {
		headers: authHeaders(),
		tags: { name: 'ais_entries_read' }
	});
	const readOk = check(readRes, { 'ais entries 200': r => r.status === 200 });
	record(g, readRes, readOk);
}

function doIdentity() {
	const g = 'identity';

	if (ctx.org) {
		const resolveRes = http.get(`${BASE}/identity/${encodeURIComponent(ctx.org)}`, {
			headers: authHeaders(),
			tags: { name: 'identity_resolve' }
		});
		const resolveOk = check(resolveRes, { 'identity resolve 200': r => r.status === 200 });
		record(g, resolveRes, resolveOk);
	}

	const profileRes = http.get(`${BASE}/identity/profile${orgParam(false)}`, {
		headers: authHeaders(),
		tags: { name: 'identity_profile' }
	});
	const profileOk = check(profileRes, { 'identity profile 200': r => r.status === 200 });
	record(g, profileRes, profileOk);
}

function doTelemetry() {
	const g = 'telemetry';
	const res = http.get(`${BASE}/telemetry/metric?limit=20${orgParam(true)}`, {
		headers: authHeaders(),
		tags: { name: 'telemetry_list' }
	});
	const ok = check(res, { 'telemetry 200': r => r.status === 200 });
	record(g, res, ok);
}

function doAuth() {
	const g = 'auth';
	let p = `/authentication/admin/users/${encodeURIComponent(EMAIL)}`;
	if (ctx.org) {
		p += `?organization=${encodeURIComponent(ctx.org)}`;
	}
	const res = http.get(`${BASE}${p}`, {
		headers: authHeaders(),
		tags: { name: 'auth_admin_read' }
	});
	const ok = check(res, { 'auth read 200': r => r.status === 200 });
	record(g, res, ok);
}

function doNotarization() {
	const g = 'notarization';

	if (!ctx.notarizationId || Math.random() < WRITE_RATIO) {
		const body = JSON.stringify({
			mode: 'dynamic',
			data: encoding.b64encode(`soak ${__VU}-${__ITER}`),
			description: 'soak notarization'
		});
		const res = http.post(`${BASE}/notarization${orgParam(false)}`, body, {
			headers: { ...authHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'notarization_create' }
		});
		const ok = check(res, { 'notarization 201': r => r.status === 201 });
		record(g, res, ok);
		const id = locationId(res);
		if (id) {
			ctx.notarizationId = id;
		}
	} else {
		const id = ctx.notarizationId;
		const res = http.get(`${BASE}/notarization/${encodeURIComponent(id)}${orgParam(false)}`, {
			headers: authHeaders(),
			tags: { name: 'notarization_read' }
		});
		const ok = check(res, { 'notarization read 200': r => r.status === 200 });
		record(g, res, ok);
	}
}

function doFedcat() {
	const g = 'fedcat';

	// Trust token required for both dataset creates and catalog queries.
	ensureTrustToken();

	if (!ctx.fedcatDatasetId || Math.random() < WRITE_RATIO) {
		const id = `https://soak.example.com/datasets/soak-${__VU}-${__ITER}`;
		const body = JSON.stringify({
			'@context': {
				dcat: 'http://www.w3.org/ns/dcat#',
				dcterms: 'http://purl.org/dc/terms/',
				odrl: 'http://www.w3.org/ns/odrl/2/'
			},
			'@id': id,
			'@type': 'dcat:Dataset',
			'dcterms:title': `soak dataset ${__VU}-${__ITER}`,
			'dcterms:description': 'created by k6 soak',
			'dcterms:publisher': 'https://soak.example.com/participants/soak-node',
			'dcat:distribution': {
				'@type': 'dcat:Distribution',
				'@id': `https://soak.example.com/distributions/soak-${__VU}-${__ITER}`,
				'dcterms:format': 'HttpData-PULL',
				'dcat:accessService': 'https://soak.example.com/services/soak-node'
			},
			'odrl:hasPolicy': {
				'@context': 'http://www.w3.org/ns/odrl/2/',
				'@type': 'Offer',
				uid: `https://soak.example.com/policies/soak-${__VU}-${__ITER}`,
				assigner: 'https://soak.example.com/participants/soak-node',
				permission: [{ action: 'use' }]
			}
		});
		const res = http.post(`${BASE}/catalog/datasets${orgParam(false)}`, body, {
			headers: { ...authHeaders(), ...trustHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'fedcat_create' }
		});
		const ok = check(res, { 'fedcat upsert 201/204': r => r.status === 201 || r.status === 204 });
		record(g, res, ok);
		if (ok) {
			ctx.fedcatDatasetId = id;
		}
	} else {
		// Catalog query (trust token already ensured above; exercises refresh on expiry).
		const body = JSON.stringify({
			'@context': ['https://w3id.org/dspace/2025/1/context.jsonld'],
			'@type': 'CatalogRequestMessage',
			filter: []
		});
		const res = http.post(`${BASE}/catalog/request${orgParam(false)}`, body, {
			headers: { ...authHeaders(), ...trustHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'fedcat_query' }
		});
		// 404 = empty catalogue, still a valid response (not a server error).
		const ok = check(res, { 'fedcat query 200/404': r => r.status === 200 || r.status === 404 });
		record(g, res, ok);
	}
}

function doDataspace() {
	const g = 'dataspace';

	if (!ctx.dataspaceDatasetId || Math.random() < WRITE_RATIO) {
		// Date.now() suffix guarantees uniqueness across separate runs against the same
		// long-lived cloud node (VU/ITER alone repeat every run since SOAK_SKIP_BOOTSTRAP=true
		// means the node and its data persist). Without it, this endpoint's create-only
		// semantics (unlike fedcat's upsert) throw AlreadyExistsError -> 409 on any (VU, ITER)
		// pair a past run already used, and that collision rate grows with every run since.
		const id = `https://soak.example.com/ds-${__VU}-${__ITER}-${Date.now()}`;
		const body = JSON.stringify({
			appId: 'https://soak.example.com/app1',
			dataset: {
				'@context': {
					dcat: 'http://www.w3.org/ns/dcat#',
					dcterms: 'http://purl.org/dc/terms/',
					odrl: 'http://www.w3.org/ns/odrl/2/'
				},
				'@type': 'dcat:Dataset',
				'@id': id,
				'dcterms:title': `soak ds ${__VU}-${__ITER}`,
				'dcterms:publisher': 'https://soak.example.com/participants/soak-node',
				'dcat:distribution': {
					'@type': 'dcat:Distribution',
					'@id': `https://soak.example.com/distributions/ds-${__VU}-${__ITER}`,
					'dcterms:format': 'HttpData-PULL',
					'dcat:accessService': 'https://soak.example.com/services/soak-node'
				},
				'odrl:hasPolicy': {
					'@context': 'http://www.w3.org/ns/odrl/2/',
					'@type': 'Offer',
					uid: `https://soak.example.com/policies/ds-${__VU}-${__ITER}`,
					assigner: 'https://soak.example.com/participants/soak-node',
					permission: [{ action: 'use' }]
				}
			}
		});
		const res = http.post(`${BASE}/dataspace/app-datasets${orgParam(false)}`, body, {
			headers: { ...authHeaders(), 'Content-Type': 'application/json' },
			tags: { name: 'dataspace_create' }
		});
		const ok = check(res, { 'dataspace 201': r => r.status === 201 });
		record(g, res, ok);
		if (ok) {
			const loc = locationId(res);
			ctx.dataspaceDatasetId = loc ?? id;
		}
	} else {
		const id = ctx.dataspaceDatasetId;
		const res = http.get(
			`${BASE}/dataspace/app-datasets/${encodeURIComponent(id)}${orgParam(false)}`,
			{
				headers: authHeaders(),
				tags: { name: 'dataspace_read' }
			}
		);
		const ok = check(res, { 'dataspace read 200': r => r.status === 200 });
		record(g, res, ok);
	}
}

const GROUP_FNS = {
	logging: doLogging,
	blob: doBlob,
	aig: doAig,
	ais: doAis,
	identity: doIdentity,
	telemetry: doTelemetry,
	auth: doAuth,
	notarization: doNotarization,
	fedcat: doFedcat,
	dataspace: doDataspace
};

// ---------------------------------------------------------------------------
// Default function (per-iteration)
// ---------------------------------------------------------------------------

export default function iteration(data) {
	ensureSessionToken();

	const group = pickGroup(data?.unavailableGroups);
	GROUP_FNS[group]();
}

// ---------------------------------------------------------------------------
// handleSummary — per-group metrics + compact stdout line
// ---------------------------------------------------------------------------

export function handleSummary(data) {
	const out = {};

	const groups = {};
	for (const name of GROUP_NAMES) {
		const d = data.metrics[`grp_${name}_duration`]?.values ?? {};
		groups[name] = {
			reqs: data.metrics[`grp_${name}_reqs`]?.values?.count ?? 0,
			errors: data.metrics[`grp_${name}_errors`]?.values?.count ?? 0,
			p50: d.med,
			p95: d['p(95)'],
			p99: d['p(99)']
		};
	}

	if (__ENV.SOAK_SUMMARY_PATH) {
		out[__ENV.SOAK_SUMMARY_PATH] = JSON.stringify({ ...data, groups }, null, 2);
	}
	out.stdout = compactSummary(data, groups);
	return out;
}

function compactSummary(data, groups) {
	const m = data.metrics ?? {};
	const dur = m.http_req_duration?.values ?? {};
	const failed = m.http_req_failed?.values ?? {};
	const reqs = m.http_reqs?.values ?? {};

	const lines = [
		'',
		'  twin-soak summary',
		`    requests:    ${fmt(reqs.count)} (${fmt(reqs.rate, 1)}/s)`,
		`    failed:      ${fmt((failed.rate ?? 0) * 100, 2)}%`,
		`    p50/p95/p99: ${fmt(dur.med)} / ${fmt(dur['p(95)'])} / ${fmt(dur['p(99)'])} ms`,
		'',
		'  per-group (p50/p95 ms | reqs | errors)',
		...GROUP_NAMES.map(name => {
			const g = groups[name] ?? {};
			return `    ${name.padEnd(13)} ${fmt(g.p50)} / ${fmt(g.p95)} ms | ${fmt(g.reqs)} reqs | ${fmt(g.errors)} err`;
		}),
		''
	];
	return lines.join('\n');
}

function fmt(n, digits = 0) {
	return typeof n === 'number' ? n.toFixed(digits) : 'n/a';
}
