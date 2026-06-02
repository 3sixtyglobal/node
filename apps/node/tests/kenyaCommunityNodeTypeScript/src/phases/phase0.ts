// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { assertEquals, assertNonEmpty } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { info, ok, phase } from "../logger.js";
import { makeAuthenticationClient } from "../restClientFactory.js";

/**
 * Issue a raw HTTP request and return the status code only. Used by Phase 0
 * to probe `/health` with and without an api key — neither response body is
 * meaningful, only the status code.
 * @param url The URL to fetch.
 * @param init Optional fetch options.
 * @returns The HTTP status code.
 */
async function statusOf(url: string, init?: RequestInit): Promise<number> {
	const response = await fetch(url, init);
	// Drain the body so the underlying connection is recycled.
	await response.arrayBuffer();
	return response.status;
}

/**
 * Phase 0 — health check + per-tenant logins.
 * Verifies the TenantProcessor gate (keyless /health rejected; with key
 * accepted) and exercises the production authentication rest client to
 * log in as KRA admin + Trader admin.
 * @param context The scenario context. Session JWTs are written back in-place.
 */
export async function runPhase0(context: IKenyaContext): Promise<void> {
	phase(0, "Health check + per-tenant logins");

	const keylessStatus = await statusOf(`${context.host}/health`);
	assertEquals(keylessStatus, 401, "Keyless GET /health → 401 (TenantProcessor gate intact)");

	const kraStatus = await statusOf(`${context.host}/health`, {
		headers: { "x-api-key": context.kraApiKey }
	});
	assertEquals(kraStatus, 200, "GET /health with KRA api-key");

	const traderStatus = await statusOf(`${context.host}/health`, {
		headers: { "x-api-key": context.traderApiKey }
	});
	assertEquals(traderStatus, 200, "GET /health with Trader api-key");

	// Use the production rest client to exercise the same code path the UI /
	// other services use, then surface the session token (cookie value) into
	// the shared context so subsequent phases can attach it as
	// `access_token=<JWT>`.
	const kraAuth = makeAuthenticationClient(context.host, context.kraApiKey);
	const kraLogin = await kraAuth.login(context.kraUserEmail, context.kraUserPassword);
	assertNonEmpty(kraLogin.token, "KRA admin login returned a session JWT");
	context.kraSessionJwt = kraLogin.token ?? "";

	const traderAuth = makeAuthenticationClient(context.host, context.traderApiKey);
	const traderLogin = await traderAuth.login(context.traderUserEmail, context.traderUserPassword);
	assertNonEmpty(traderLogin.token, "Trader admin login returned a session JWT");
	context.traderSessionJwt = traderLogin.token ?? "";

	ok(`KRA admin (${context.kraUserEmail}) logged in`);
	ok(`Trader admin (${context.traderUserEmail}) logged in`);

	info("Phase 0 complete. TICKET-A (trust auto-enable) + TICKET-C (vault key bootstrap)");
	info("implicitly verified — node started cleanly with full DSP+PNP+rights-mgmt enabled.");
}
