// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
//
// Thin wrapper around DataspaceControlPlaneRestClient so kenya-test.sh can
// exercise the production REST-client URL construction / serialization /
// response parsing instead of bash curl + hand-crafted JSON-LD.
//
// Module resolution: relies on `node/node_modules` which has the rest-client
// installed (this file lives at .../node/apps/node/tests/kenyaCommunityUseCaseDefaultArbiter/scripts/
// and Node walks up to .../node/node_modules).
//
// CLI shape:
//   node dsp-client.mjs <command> --host <url> --organization <org-did>
//     [--trust-payload <jwt>] [--body <json>] [--pid <consumerPid>] [--id <datasetId>]
//
// Output (stdout): a single JSON line.
//   Success:  {"ok":true,"status":200,"body":<response-body>}
//   Error:    {"ok":false,"status":<status>,"errorName":"...","errorMessage":"...","body":<parsed-error-body|null>}
//
// Always exits 0 — the test harness reads .status from the JSON to decide
// pass/fail. This keeps bash plumbing simple (`result=$(node dsp-client.mjs ...)`).

import { DataspaceControlPlaneRestClient } from '@twin.org/dataspace-control-plane-rest-client';

function parseArgs(argv) {
	const command = argv[2];
	const opts = {};
	for (let i = 3; i < argv.length; i += 2) {
		const k = argv[i];
		const v = argv[i + 1];
		if (k?.startsWith('--')) {
			opts[k.slice(2)] = v;
		}
	}
	return { command, opts };
}

function buildEndpoint(host, organization) {
	// host arrives like "http://localhost:3042". Embed the target tenant's org
	// DID at the endpoint level so BaseRestClient preserves it as a query param
	// on every request. Post-#203 the TenantProcessor resolves non-login routes
	// via ?organization=<org-did> (Tenant.organizationId + aliases) — the
	// catalogue's URL-baked org DID is how cross-tenant requests route inbound.
	if (!organization) {
		return host;
	}
	const url = new URL(host);
	url.searchParams.set('organization', organization);
	return url.toString();
}

function makeClient(opts) {
	// Two auth modes:
	//  (1) DSP routes (skipAuth on inbound): target org DID in URL query +
	//      Bearer trust JWT via the rest client method's trustPayload arg.
	//  (2) Tenant-admin routes (listAppDatasets, getAppDataset): require the
	//      org query param (routing) + session JWT cookie (auth). Set the
	//      cookie as a static header so every request carries it.
	const headers = {};
	if (opts['session-jwt']) {
		headers.Cookie = `access_token=${opts['session-jwt']}`;
	}
	return new DataspaceControlPlaneRestClient({
		endpoint: buildEndpoint(opts.host, opts.organization),
		pathPrefix: 'dataspace',
		headers: Object.keys(headers).length > 0 ? headers : undefined
	});
}

function parseBody(raw) {
	if (raw === undefined || raw === null || raw === '') {
		return;
	}
	try {
		return JSON.parse(raw);
	} catch (err) {
		throw new Error(`Invalid --body JSON: ${err.message}`, { cause: err });
	}
}

function emit(result) {
	process.stdout.write(JSON.stringify(result));
	process.stdout.write('\n');
}

// Map TWIN core error class names to HTTP status codes. BaseRestClient
// throws BaseError subclasses; the .name is reliable but the httpStatus
// property is sometimes nested. This mapping is the fallback when we
// can't dig the status out of the error object directly.
const ERROR_NAME_STATUS = {
	GuardError: 400,
	UnauthorizedError: 401,
	ForbiddenError: 403,
	NotFoundError: 404,
	ConflictError: 409,
	AlreadyExistsError: 409,
	NotImplementedError: 501,
	GeneralError: 500
};

function classifyError(err) {
	const errorName = err?.name ?? 'Error';
	const errorMessage = err?.message ?? String(err);

	// Dig the response body out of wherever it might live. FetchError stores
	// it at `err.properties.response`. We also check toJsonObject() and the
	// cause chain for completeness.
	let body = null;
	try {
		const candidates = [err?.properties, err?.cause?.properties];
		if (typeof err?.toJsonObject === 'function') {
			candidates.push(err.toJsonObject()?.properties);
		}
		if (typeof err?.cause?.toJsonObject === 'function') {
			candidates.push(err.cause.toJsonObject()?.properties);
		}
		for (const c of candidates) {
			if (c && (c.response !== undefined || c.body !== undefined)) {
				body = c.response ?? c.body;
				break;
			}
		}
	} catch {}

	// Status: prefer explicit httpStatus from FetchError, then fallback to
	// errorName-based mapping for non-FetchError throws.
	const status =
		err?.httpStatus ??
		err?.statusCode ??
		err?.status ??
		err?.cause?.httpStatus ??
		err?.cause?.statusCode ??
		err?.cause?.status ??
		err?.properties?.httpStatus ??
		(typeof err?.toJsonObject === 'function'
			? err.toJsonObject()?.properties?.httpStatus
			: undefined) ??
		ERROR_NAME_STATUS[errorName] ??
		0;
	return {
		ok: false,
		status: typeof status === 'number' ? status : 0,
		errorName,
		errorMessage,
		body
	};
}

async function main() {
	const { command, opts } = parseArgs(process.argv);
	if (!command) {
		emit({ ok: false, status: 0, errorName: 'Usage', errorMessage: 'No command given' });
		return;
	}
	if (!opts.host) {
		emit({ ok: false, status: 0, errorName: 'Usage', errorMessage: 'Missing --host' });
		return;
	}

	const client = makeClient(opts);

	try {
		let body;
		switch (command) {
			case 'requestTransfer': {
				const message = parseBody(opts.body);
				if (!message) {
					throw new Error('requestTransfer requires --body <json>');
				}
				if (!opts['trust-payload']) {
					throw new Error('requestTransfer requires --trust-payload <jwt>');
				}
				// Signature is requestTransfer(request, trustPayload) (2-arg as of
				// dataspace-control-plane next.55 — the old `options` arg was removed).
				// Auto-start is now a provider-side config (autoStartTransfers, default
				// false), never a consumer request param; this scaffold drives startTransfer
				// explicitly afterwards.
				body = await client.requestTransfer(message, opts['trust-payload']);
				break;
			}
			case 'startTransfer': {
				const message = parseBody(opts.body);
				if (!message) {
					throw new Error('startTransfer requires --body <json>');
				}
				if (!opts['trust-payload']) {
					throw new Error('startTransfer requires --trust-payload <jwt>');
				}
				body = await client.startTransfer(message, opts['trust-payload']);
				break;
			}
			case 'getTransferProcess': {
				if (!opts.pid) {
					throw new Error('getTransferProcess requires --pid <consumerPid>');
				}
				if (!opts['trust-payload']) {
					throw new Error('getTransferProcess requires --trust-payload <jwt>');
				}
				body = await client.getTransferProcess(opts.pid, opts['trust-payload']);
				break;
			}
			case 'listAppDatasets': {
				body = await client.listAppDatasets(
					opts.cursor,
					opts.limit ? Number(opts.limit) : undefined
				);
				break;
			}
			case 'getAppDataset': {
				if (!opts.id) {
					throw new Error('getAppDataset requires --id <datasetId>');
				}
				body = await client.getAppDataset(opts.id);
				break;
			}
			default:
				throw new Error(`Unknown command: ${command}`);
		}
		emit({ ok: true, status: 200, body });
	} catch (err) {
		emit(classifyError(err));
	}
}

main();
