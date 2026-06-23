// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	DataspaceProtocolContexts,
	DataspaceProtocolTransferProcessTypes,
	type IDataspaceProtocolTransferProcess,
	type IDataspaceProtocolTransferRequestMessage,
	type IDataspaceProtocolTransferStartMessage
} from "@twin.org/standards-dataspace-protocol";
import { assert, assertNonEmpty } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase, step, warn } from "../logger.js";
import { makeControlPlaneClient, type ITenantCredentials } from "../restClientFactory.js";
import type { INegotiationOutput } from "./phase4_5.js";

/**
 * Build a urn:uuid-style identifier matching the bash test's pattern.
 * @param prefix The prefix string.
 * @returns A unique identifier.
 */
function urn(prefix: string): string {
	const epoch = Math.floor(Date.now() / 1000);
	const rand = Math.floor(Math.random() * 100000);
	return `urn:uuid:${prefix}-${epoch}-${rand}`;
}

/**
 * Build the trader→KRA credentials carrying the encrypted KRA tenant token.
 * @param context The scenario context.
 * @returns The cross-tenant rest-client credentials.
 * @throws Error if the Phase-3 KRA tenant token is missing from the context.
 */
function traderToKraCredentials(context: IKenyaContext): ITenantCredentials {
	const encToken = context.kraTenantToken;
	if (typeof encToken !== "string" || encToken.length === 0) {
		throw new Error("Phase 3 did not populate context.kraTenantToken");
	}
	return {
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt,
		encTenantToken: encToken
	};
}

/**
 * Translate a container-internal callback URL to the host-accessible URL the
 * test runner can curl. Same trick as the bash scaffold: strip the docker
 * service hostname prefix and replace it with the public HOST. Query string
 * is preserved (including `?x-enc-tenant-token=...`).
 * @param url The raw URL returned by startTransfer.
 * @param internalUrl The internal docker URL prefix (e.g. http://twin-kenya-node:3000).
 * @param host The host-accessible prefix (e.g. http://localhost:3040).
 * @returns The translated URL.
 */
function translateEndpoint(url: string, internalUrl: string, host: string): string {
	if (url.startsWith(internalUrl)) {
		return `${host}${url.slice(internalUrl.length)}`;
	}
	return url;
}

/**
 * Phase 6 — Trader sends a TransferRequestMessage against the agreement.
 * The reply contains the providerPid we need for startTransfer.
 * @param context The scenario context.
 * @param negotiation The Phase 4+5 output.
 * @returns The DSP consumer pid + provider pid for this transfer.
 */
async function runPhase6(
	context: IKenyaContext,
	negotiation: INegotiationOutput
): Promise<{ traderDspPid: string; providerDspPid: string }> {
	phase(6, "Trader requestTransfer against the agreement");

	const traderDspPid = urn("trader-dsp");

	const callbackAddress = `${context.internalUrl}/dataspace?x-enc-tenant-token=${encodeURIComponent(
		context.traderTenantToken
	)}`;

	const request: IDataspaceProtocolTransferRequestMessage = {
		"@context": DataspaceProtocolContexts.Context,
		"@type": DataspaceProtocolTransferProcessTypes.TransferRequestMessage,
		consumerPid: traderDspPid,
		agreementId: negotiation.traderAgreementId,
		format: "Http-Pull-Query-Format",
		callbackAddress
	};

	const cp = makeControlPlaneClient(traderToKraCredentials(context));
	const response = await cp.requestTransfer(request, context.traderTrustJwt);

	if (
		(response as { "@type"?: string })["@type"] ===
		DataspaceProtocolTransferProcessTypes.TransferError
	) {
		fail(
			`Transfer request returned TransferError: ${(response as { code?: string }).code ?? "unknown"}`
		);
	}

	const tp = response as IDataspaceProtocolTransferProcess;
	const providerDspPid = tp.providerPid;
	assertNonEmpty(providerDspPid, "Transfer created (providerPid present)");
	ok(`Transfer created (providerPid: ${providerDspPid})`);

	return { traderDspPid, providerDspPid };
}

/**
 * Phase 7 — KRA fires the TransferStartMessage on behalf of the provider side
 * (DSP protocol-level call). The response carries the encrypted dataAddress
 * endpoint TICKET-D bakes the tenant token into. Trader then pulls the data.
 * @param context The scenario context.
 * @param phase6Out The output of phase 6.
 * @param phase6Out.traderDspPid Trader-side (consumer) DSP transfer process pid.
 * @param phase6Out.providerDspPid KRA-side (provider) DSP transfer process pid.
 */
async function runPhase7(
	context: IKenyaContext,
	phase6Out: { traderDspPid: string; providerDspPid: string }
): Promise<void> {
	phase(7, "Trader startTransfer + receives encrypted endpoint + pulls data");

	// The DSP startTransfer is provider-side: the trust JWT is KRA's because
	// the message is "from KRA". The route still needs the encrypted KRA
	// tenant token to land in KRA's partition — that travels on the URL.
	//
	// `startTransferHandler` reads everything it needs from the body
	// (`request.body.consumerPid` / `request.body.providerPid`); the URL
	// `:pid` slot is unused at the handler layer. The rest client populates
	// `:pid` from `message.consumerPid`, so we just send the real consumer +
	// provider pids and let the rest client construct the URL.
	const startMessage: IDataspaceProtocolTransferStartMessage = {
		"@context": DataspaceProtocolContexts.Context,
		"@type": DataspaceProtocolTransferProcessTypes.TransferStartMessage,
		consumerPid: phase6Out.traderDspPid,
		providerPid: phase6Out.providerDspPid
	};

	const cp = makeControlPlaneClient(traderToKraCredentials(context));
	// publicOrigin is no longer a client parameter; the receiving node derives it from context.
	const response = await cp.startTransfer(startMessage, context.kraTrustJwt);

	if (
		(response as { "@type"?: string })["@type"] ===
		DataspaceProtocolTransferProcessTypes.TransferError
	) {
		fail(`Transfer start returned TransferError: ${JSON.stringify(response)}`);
	}

	const startResp = response as IDataspaceProtocolTransferStartMessage;
	const rawEndpoint = startResp.dataAddress?.endpoint;
	assertNonEmpty(rawEndpoint, "Transfer started, raw endpoint present");
	ok(`Transfer started, raw endpoint: ${rawEndpoint ?? ""}`);

	// TICKET-D: the endpoint MUST contain a tenant-token query param.
	const dataEndpointRaw = rawEndpoint ?? "";
	if (dataEndpointRaw.includes("tenant-token=")) {
		ok("TICKET-D verified: dataAddress.endpoint carries encrypted tenantToken");
	} else {
		warn("TICKET-D unexpected: endpoint has NO tenantToken query — was DSP wired correctly?");
	}

	const dataEndpoint = translateEndpoint(dataEndpointRaw, context.internalUrl, context.host);

	// Authorization token comes from endpointProperties[name=authorization]
	// when present; falls back to the trader trust JWT.
	const authEntry = (startResp.dataAddress?.endpointProperties ?? []).find(
		ep => ep.name === "authorization"
	);
	const dataToken =
		authEntry && typeof authEntry.value === "string" && authEntry.value.length > 0
			? authEntry.value
			: context.traderTrustJwt;
	if (authEntry === undefined) {
		warn("No data access token in dataAddress; falling back to TRADER_TRUST_JWT");
	}

	step(`Pulling data from ${dataEndpoint} ...`);
	// The data plane rest client expects to be talking to /dataspace/entities,
	// but the dataAddress.endpoint we just decrypted is the absolute URL the
	// provider published. We hit it directly with fetch() so the existing
	// query string (including x-enc-tenant-token=) is preserved verbatim.
	const url = new URL(dataEndpoint);
	url.searchParams.set("consumerPid", phase6Out.traderDspPid);
	url.searchParams.set("type", "https://vocabulary.uncefact.org/Consignment");

	const pullResponse = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${dataToken}`
		}
	});

	const pullText = await pullResponse.text();
	let pullBody: unknown;
	try {
		pullBody = JSON.parse(pullText);
	} catch {
		pullBody = pullText;
	}
	const itemList = (pullBody as { itemListElement?: unknown[] } | undefined)?.itemListElement ?? [];
	const itemCount = Array.isArray(itemList) ? itemList.filter(item => item !== null).length : 0;
	assert(
		pullResponse.ok && itemCount > 0,
		`Trader pulled ${itemCount} item(s) from KRA's data plane (HTTP ${pullResponse.status})`,
		`Data pull failed or returned 0 items (HTTP ${pullResponse.status}): ${pullText}`
	);

	info(`Authoritative dataAddress.endpoint host: ${url.host}`);
}

/**
 * Combined Phase 6 + 7 runner.
 * @param context The scenario context.
 * @param negotiation The Phase 4+5 output.
 */
export async function runPhase6and7(
	context: IKenyaContext,
	negotiation: INegotiationOutput
): Promise<void> {
	const phase6Out = await runPhase6(context, negotiation);
	await runPhase7(context, phase6Out);
}
