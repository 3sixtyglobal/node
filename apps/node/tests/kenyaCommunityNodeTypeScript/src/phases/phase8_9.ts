// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	DataspaceProtocolContexts,
	DataspaceProtocolTransferProcessTypes,
	type IDataspaceProtocolDataAddress,
	type IDataspaceProtocolTransferError,
	type IDataspaceProtocolTransferProcess,
	type IDataspaceProtocolTransferRequestMessage,
	type IDataspaceProtocolTransferStartMessage
} from "@twin.org/standards-dataspace-protocol";
import { assert, assertNonEmpty } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase, warn } from "../logger.js";
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
 * Issue a PUSH-format requestTransfer + startTransfer pair using the supplied
 * inbox endpoint. Returns the start-side response so the calling phase can
 * decide whether it expected acceptance or rejection.
 * @param context The scenario context.
 * @param negotiation The Phase 4+5 output.
 * @param inboxEndpoint The dataAddress.endpoint to register.
 * @returns The TransferStartMessage or TransferError returned by the start.
 */
async function pushTransferRoundtrip(
	context: IKenyaContext,
	negotiation: INegotiationOutput,
	inboxEndpoint: string
): Promise<{
	startResponse: IDataspaceProtocolTransferStartMessage | IDataspaceProtocolTransferError;
	providerPid: string;
}> {
	const consumerPid = urn("trader-push");

	const callbackAddress = `${context.internalUrl}/dataspace?x-enc-tenant-token=${encodeURIComponent(
		context.traderTenantToken
	)}`;

	const dataAddress: IDataspaceProtocolDataAddress = {
		"@type": DataspaceProtocolTransferProcessTypes.DataAddress,
		endpointType: "https",
		endpoint: inboxEndpoint
	};

	const request: IDataspaceProtocolTransferRequestMessage = {
		"@context": DataspaceProtocolContexts.Context,
		"@type": DataspaceProtocolTransferProcessTypes.TransferRequestMessage,
		consumerPid,
		agreementId: negotiation.traderAgreementId,
		format: "HttpProxy-PUSH",
		callbackAddress,
		dataAddress
	};

	const cp = makeControlPlaneClient(traderToKraCredentials(context));
	const reqResponse = await cp.requestTransfer(request, context.traderTrustJwt);

	if (
		(reqResponse as { "@type"?: string })["@type"] ===
		DataspaceProtocolTransferProcessTypes.TransferError
	) {
		fail(
			`Push negative path: requestTransfer returned TransferError: ${JSON.stringify(reqResponse)}`
		);
	}
	const requestTp = reqResponse as IDataspaceProtocolTransferProcess;
	const providerPid = requestTp.providerPid;
	assertNonEmpty(providerPid, "Push requestTransfer returned providerPid");

	// Body fields drive `startTransferHandler` (the URL :pid slot is unused).
	// Send the real consumer + provider pids; the rest client populates the
	// URL :pid from message.consumerPid which is fine — the handler ignores
	// it.
	const startMessage: IDataspaceProtocolTransferStartMessage = {
		"@context": DataspaceProtocolContexts.Context,
		"@type": DataspaceProtocolTransferProcessTypes.TransferStartMessage,
		consumerPid,
		providerPid
	};
	// Defensive: the platform currently returns HTTP 5xx (not 200) for
	// protocol-level errors like pushSubscriptionMissingTenantToken — the body
	// still has the TransferError envelope but the rest client throws on
	// non-2xx. Extract the response body from FetchError.properties.response
	// so the caller can treat both shapes uniformly. (See findings doc, batch 3
	// platform observation — should be fixed in dataspaceControlPlaneService.)
	let startResponse;
	try {
		startResponse = await cp.startTransfer(startMessage, context.kraTrustJwt);
	} catch (err) {
		const props = (err as { properties?: { response?: unknown } })?.properties;
		if (props?.response) {
			startResponse = props.response as IDataspaceProtocolTransferStartMessage;
		} else {
			throw err;
		}
	}

	return { startResponse, providerPid };
}

/**
 * Phase 8 — Push setup with a bare inbox endpoint that does NOT carry an
 * encrypted tenant token. The data plane must reject the start because the
 * multi-tenant publisher cannot dispatch eventual delivery to an
 * unauthenticated tenant. Expected: startResponse @type === TransferError and
 * startResponse.code matches /pushSubscriptionMissingTenantToken/. Anything
 * else is a regression and we WARN (the bash scaffold does the same — it does
 * not fail hard).
 * @param context The scenario context.
 * @param negotiation The Phase 4+5 output.
 */
async function runPhase8(context: IKenyaContext, negotiation: INegotiationOutput): Promise<void> {
	phase(8, "Push setup REJECTS missing tenant token (multi-tenant gate)");

	const inboxEndpoint = `${context.internalUrl}/dataspace/inbox`;
	const { startResponse } = await pushTransferRoundtrip(context, negotiation, inboxEndpoint);

	const responseType = (startResponse as { "@type"?: string })["@type"];
	if (responseType === DataspaceProtocolTransferProcessTypes.TransferError) {
		const err = startResponse as IDataspaceProtocolTransferError;
		const code = err.code ?? "";
		if (code.includes("pushSubscriptionMissingTenantToken")) {
			ok(`Push setup rejected as expected — code: ${code}`);
		} else {
			warn(`Push setup returned TransferError but with a different code: ${code}`);
			info(`Body: ${JSON.stringify(startResponse)}`);
		}
	} else {
		warn(
			"Push setup did NOT reject the bare endpoint. Either Kenya's data plane is not in multi-tenant mode, or the gate is bypassed."
		);
		info(`Response: ${JSON.stringify(startResponse)}`);
	}
}

/**
 * Phase 9 — Push setup with an inbox endpoint that DOES carry the consumer's
 * encrypted tenant token. The data plane must accept.
 * @param context The scenario context.
 * @param negotiation The Phase 4+5 output.
 */
async function runPhase9(context: IKenyaContext, negotiation: INegotiationOutput): Promise<void> {
	phase(9, "Push setup ACCEPTS endpoint with baked consumer tenant token");

	const inboxEndpoint = `${context.internalUrl}/dataspace/inbox?x-enc-tenant-token=${encodeURIComponent(
		context.traderTenantToken
	)}`;
	const { startResponse, providerPid } = await pushTransferRoundtrip(
		context,
		negotiation,
		inboxEndpoint
	);

	const responseType = (startResponse as { "@type"?: string })["@type"];
	if (responseType === DataspaceProtocolTransferProcessTypes.TransferError) {
		const err = startResponse as IDataspaceProtocolTransferError;
		fail(
			`Positive push setup failed: ${err.code ?? "unknown"} | body: ${JSON.stringify(startResponse)}`
		);
	}
	assert(
		responseType === DataspaceProtocolTransferProcessTypes.TransferStartMessage,
		`Push setup accepted with baked consumer tenant token (providerPid: ${providerPid})`,
		`Unexpected push start response @type=${String(responseType)}`
	);
}

/**
 * Combined Phase 8 + 9 runner.
 * @param context The scenario context.
 * @param negotiation The Phase 4+5 output.
 */
export async function runPhase8and9(
	context: IKenyaContext,
	negotiation: INegotiationOutput
): Promise<void> {
	await runPhase8(context, negotiation);
	await runPhase9(context, negotiation);
}
