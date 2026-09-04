// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError, Is } from "@twin.org/core";
import { assert, assertEquals } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase, step, warn } from "../logger.js";
import {
	makeAuthenticationClient,
	makeControlPlaneClient,
	makePapClient
} from "../restClientFactory.js";

/**
 * Pull the HTTP status off a thrown rest-client error. BaseRestClient wraps
 * non-2xx responses in a FetchError which exposes `properties.httpStatus`.
 * Some rest clients (e.g. EntityStorageAuthenticationRestClient) wrap the
 * FetchError in another BaseError, so we also walk the cause chain.
 *
 * Maps known TWIN core error names to HTTP statuses as a final fallback so
 * we always have *some* signal even if the FetchError got reconstructed.
 * @param err The error thrown from the rest client.
 * @returns The HTTP status code if found, otherwise -1.
 */
const ERROR_NAME_STATUS: { [key: string]: number } = {
	GuardError: 400,
	UnauthorizedError: 401,
	ForbiddenError: 403,
	NotFoundError: 404,
	ConflictError: 409,
	AlreadyExistsError: 409,
	GeneralError: 500
};

function statusFromError(err: unknown): number {
	const candidates: unknown[] = [err];
	if (Is.object(err) && "cause" in err) {
		candidates.push((err as { cause?: unknown }).cause);
	}
	for (const candidate of candidates) {
		if (Is.object(candidate)) {
			const obj = candidate as {
				properties?: { httpStatus?: number };
				httpStatus?: number;
				statusCode?: number;
				name?: string;
				toJsonObject?: () => { properties?: { httpStatus?: number } };
			};
			const direct = obj.properties?.httpStatus ?? obj.httpStatus ?? obj.statusCode;
			if (Is.number(direct)) {
				return direct;
			}
			if (Is.function(obj.toJsonObject)) {
				const dumped = obj.toJsonObject();
				if (Is.number(dumped?.properties?.httpStatus)) {
					return dumped.properties.httpStatus;
				}
			}
			if (Is.string(obj.name) && ERROR_NAME_STATUS[obj.name] !== undefined) {
				return ERROR_NAME_STATUS[obj.name];
			}
		}
	}
	return -1;
}

/**
 * Run an async operation and capture either the HTTP status from a thrown
 * FetchError or 200 on success. Convenience helper for the "Trader tries to
 * touch a KRA resource and is rejected" pattern repeated through Phase 11.
 * @param op The operation to run.
 * @returns The HTTP status code, error message, and the raw error object.
 */
async function captureStatus(
	op: () => Promise<unknown>
): Promise<{ status: number; message: string; error?: unknown }> {
	try {
		await op();
		return { status: 200, message: "" };
	} catch (err) {
		const status = statusFromError(err);
		const message = err instanceof Error ? err.message : String(err);
		return { status, message, error: err };
	}
}

/**
 * Phase 11 — five tenant-isolation assertions covering the layered defenses
 * (login-time TenantProcessor, AuthHeaderProcessor on authenticated routes,
 * storage [Node, Tenant] partitioning on list, on PAP direct-fetch, and on
 * app-dataset direct-fetch with the explicit S2 tenant-equality check).
 * @param context The scenario context (the Trader session JWT is refreshed
 * here because Phase 10 invalidated all in-memory sessions).
 */
export async function runPhase11(context: IKenyaContext): Promise<void> {
	phase(11, "Negative-path tenant isolation (Trader denied from KRA-only resources)");

	// Phase 10 restarts the container; the Trader session JWT cached on the
	// context is now invalid (sessions are in-memory). Re-login first so
	// 11.2-11.5 actually test authorization logic, not stale-token rejection.
	step("Re-logging in as Trader after Phase 10 restart");
	const traderAuth = makeAuthenticationClient(context.host, context.traderApiKey);
	const traderLogin = await traderAuth.login(context.traderUserEmail, context.traderUserPassword);
	assert(
		Is.stringValue(traderLogin.token),
		"Trader re-logged in after restart",
		"Trader re-login after restart failed"
	);
	context.traderSessionJwt = traderLogin.token ?? "";

	// --------------------------------------------------------------------
	// 11.1 — Login with Trader email + KRA api-key (cross-tenant credential mix)
	// --------------------------------------------------------------------
	step("Login attempt with Trader email + KRA api-key (cross-tenant credential mix)");
	// EntityStorageAuthenticationRestClient throws a FetchError on non-2xx;
	// we want to confirm the 401 specifically.
	const crossLogin = await captureStatus(async () => {
		const mixed = makeAuthenticationClient(context.host, context.kraApiKey);
		await mixed.login(context.traderUserEmail, context.traderUserPassword);
	});
	assertEquals(
		crossLogin.status,
		401,
		"Trader email + KRA api-key → 401 (TenantProcessor scoped lookup to KRA partition, user not found)"
	);

	// --------------------------------------------------------------------
	// 11.2 — Authenticated route with mismatched session/api-key tenant
	// --------------------------------------------------------------------
	step("Authenticated route with Trader session JWT + KRA api-key (tenant mismatch)");
	// Use the PAP rest client so the call lands on the same route the bash
	// scaffold hits (`/rights-management/policy/admin/${KRA_OFFER_ID}`).
	const mismatchPap = makePapClient({
		host: context.host,
		apiKey: context.kraApiKey,
		sessionJwt: context.traderSessionJwt
	});
	const mismatchResult = await captureStatus(async () => {
		await mismatchPap.get(context.kraOfferId);
	});
	assertEquals(
		mismatchResult.status,
		401,
		"Trader session + KRA api-key → 401 (AuthHeaderProcessor tenantIdMismatch)"
	);

	// --------------------------------------------------------------------
	// 11.3 — App-dataset list scoped to Trader's partition (no KRA dataset leak)
	// --------------------------------------------------------------------
	step("Trader queries /dataspace/app-datasets (should NOT see KRA's dataset)");
	const traderCp = makeControlPlaneClient({
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt
	});
	const list = await traderCp.listAppDatasets();
	const leak = list.entities.find(entity => {
		// Trader has no datasets; KRA's id should NOT appear in Trader's
		// listing under any property — match the bash test's substring scan.
		const serialised = JSON.stringify(entity);
		return serialised.includes(context.kraDatasetId);
	});
	if (leak !== undefined) {
		info(`List response: ${JSON.stringify(list)}`);
		fail(
			`Cross-tenant leak: Trader's app-dataset listing contains KRA's dataset ${context.kraDatasetId}`
		);
	}
	ok(
		"Trader's app-dataset listing does NOT contain KRA's dataset (storage partition isolation intact)"
	);

	// --------------------------------------------------------------------
	// 11.4 — Direct fetch of KRA's offer by URN (PAP partition isolation → 404)
	// --------------------------------------------------------------------
	step("Trader tries to fetch KRA's offer by URN via PAP admin route (expect 404)");
	const traderPap = makePapClient({
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt
	});
	const papResult = await captureStatus(async () => {
		await traderPap.get(context.kraOfferId);
	});
	assertEquals(
		papResult.status,
		404,
		"Direct fetch of KRA's offer by URN from Trader context → 404 (PAP partition hides it)"
	);

	// --------------------------------------------------------------------
	// 11.5 — Direct fetch of KRA's app-dataset by id (S2 explicit tenant-equality)
	// --------------------------------------------------------------------
	step("Trader tries to fetch KRA's app-dataset by id (expect 401 datasetWrongTenant)");
	const appDsResult = await captureStatus(async () => {
		await traderCp.getAppDataset(context.kraDatasetId);
	});
	if (appDsResult.status !== 401) {
		warn(`Expected HTTP 401 but got ${appDsResult.status}`);
		info(`Error message: ${appDsResult.message}`);
		fail(
			`Expected 401 with datasetWrongTenant for cross-tenant app-dataset fetch, got ${appDsResult.status}`
		);
	}
	// FetchError wraps the server-side error keys in BaseError; use
	// someErrorMessage to walk the cause chain for the specific signature.
	const matched =
		appDsResult.message.includes("datasetWrongTenant") ||
		BaseError.someErrorMessage(appDsResult.error, /datasetWrongTenant/);
	assert(
		matched,
		"Direct fetch of KRA's app-dataset by id from Trader context → 401 datasetWrongTenant (explicit tenant-equality check fires)",
		`Expected datasetWrongTenant in error message, got: ${appDsResult.message}`
	);
}
