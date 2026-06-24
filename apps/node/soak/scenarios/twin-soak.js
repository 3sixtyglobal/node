// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * k6 soak scenario for the twin-node server.
 *
 * Phase 2: each VU performs the real two-step auth (API-key login -> JWT cookie), then drives
 * an authenticated read. Tokens are NOT pre-cached: a VU logs in on its first iteration and
 * re-logs-in on a 401, so token handling is exercised under load.
 *
 * Config is passed via --env from the orchestrator (run-soak.mjs). Run through that, not directly.
 *
 * NB: this is a k6 script, not Node — it runs in the k6 JS runtime. `__ENV`/`__VU` are k6 globals,
 * and `http_req_duration` / `http_req_failed` are k6's built-in metric names (fixed by the k6 API),
 * hence the global declaration and the camelcase exception below.
 */

/* global __ENV, __VU */
/* eslint-disable camelcase -- k6 built-in metric names are snake_case and fixed by the k6 API */

import { check } from 'k6';
import encoding from 'k6/encoding';
import http from 'k6/http';

const BASE = __ENV.SOAK_BASE_URL;
const API_KEY = __ENV.SOAK_TENANT_API_KEY || '';
const EMAIL = __ENV.SOAK_ADMIN_EMAIL;
const PASSWORD = __ENV.SOAK_ADMIN_PASSWORD;
const MULTI = (__ENV.SOAK_TENANT_MODE || 'multi') === 'multi';

export const options = {
	scenarios: {
		soak: {
			executor: 'constant-vus',
			vus: Number(__ENV.SOAK_VUS || 5),
			duration: __ENV.SOAK_DURATION || '30s'
		}
	},
	thresholds: {
		http_req_duration: [`p(95)<${__ENV.SOAK_P95_MS || 500}`, `p(99)<${__ENV.SOAK_P99_MS || 1500}`],
		http_req_failed: [`rate<${__ENV.SOAK_ERROR_RATE || 0.01}`]
	},
	// Ensure p(99) is present in the exported summary (default stats omit it).
	summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)']
};

// Per-VU auth state. k6 keeps module scope per VU for the VU's lifetime.
const sessions = {};

/** Two-step login: API-key header + credentials -> access_token cookie + org claim. */
function login() {
	const res = http.post(
		`${BASE}/authentication/login`,
		JSON.stringify({ email: EMAIL, password: PASSWORD }),
		{
			headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
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
	if (token) {
		try {
			const payload = JSON.parse(encoding.b64decode(token.split('.')[1], 'rawurl', 's'));
			org = payload.org;
		} catch {
			// malformed JWT — leave org undefined
		}
	}
	return { token, org };
}

/** An authenticated read (admin user lookup), org-scoped in multi-tenant mode. */
function authedRead(session) {
	let p = `/authentication/admin/users/${encodeURIComponent(EMAIL)}`;
	if (MULTI && session.org) {
		p += `?organization=${encodeURIComponent(session.org)}`;
	}
	return http.get(`${BASE}${p}`, {
		headers: session.token ? { Cookie: `access_token=${session.token}` } : {},
		tags: { name: 'adminUserRead' }
	});
}

export default function iteration() {
	const vu = __VU;
	if (!sessions[vu]?.token) {
		sessions[vu] = login();
	}

	const res = authedRead(sessions[vu]);
	if (res.status === 401) {
		// Token expired/invalid — force a fresh login on the next iteration.
		sessions[vu] = login();
	} else {
		check(res, { 'read 200': r => r.status === 200 });
	}
}

/** Write the structured summary for the orchestrator + a compact stdout line. */
export function handleSummary(data) {
	const out = {};
	if (__ENV.SOAK_SUMMARY_PATH) {
		out[__ENV.SOAK_SUMMARY_PATH] = JSON.stringify(data, null, 2);
	}
	out.stdout = compactSummary(data);
	return out;
}

function compactSummary(data) {
	const m = data.metrics ?? {};
	const dur = m.http_req_duration?.values ?? {};
	const failed = m.http_req_failed?.values ?? {};
	const reqs = m.http_reqs?.values ?? {};
	const lines = [
		'',
		'  twin-soak summary',
		`    requests:   ${fmt(reqs.count)} (${fmt(reqs.rate, 1)}/s)`,
		`    failed:     ${fmt((failed.rate ?? 0) * 100, 2)}%`,
		`    p50/p95/p99: ${fmt(dur.med)} / ${fmt(dur['p(95)'])} / ${fmt(dur['p(99)'])} ms`,
		''
	];
	return lines.join('\n');
}

function fmt(n, digits = 0) {
	return typeof n === 'number' ? n.toFixed(digits) : 'n/a';
}
