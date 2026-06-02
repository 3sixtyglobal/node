// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IPolicyNegotiation } from "@twin.org/rights-management-models";
import {
	DataspaceProtocolContexts,
	DataspaceProtocolContractNegotiationStateType,
	DataspaceProtocolContractNegotiationTypes,
	type IDataspaceProtocolContractNegotiation,
	type IDataspaceProtocolContractRequestMessage
} from "@twin.org/standards-dataspace-protocol";
import { assert, assertNonEmpty } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase, step } from "../logger.js";
import { makePnapClient, makePnpClient, type ITenantCredentials } from "../restClientFactory.js";

/**
 * Negotiation-flow output values that phase 6 needs.
 */
export interface INegotiationOutput {
	/**
	 * The provider-side negotiation id returned by KRA when Trader's
	 * ContractRequestMessage was accepted.
	 */
	providerNegotiationPid: string;

	/**
	 * The consumer-side negotiation id Trader pre-injected into its own PNAP.
	 */
	traderConsumerPid: string;

	/**
	 * The agreement id resolved out of Trader's PNAP entry once FINALIZED.
	 */
	traderAgreementId: string;
}

/**
 * Build a urn:uuid-style identifier that mirrors what the bash test produces
 * (`urn:contract-negotiation:trader-${epoch}-${RANDOM}`).
 * @param prefix The prefix string.
 * @returns A unique identifier.
 */
function urn(prefix: string): string {
	const epoch = Math.floor(Date.now() / 1000);
	const rand = Math.floor(Math.random() * 100000);
	return `urn:${prefix}-${epoch}-${rand}`;
}

/**
 * Build Trader's credentials for cross-tenant requests. The Phase-3-captured
 * encrypted KRA tenant token must be on every PNP/DSP call so the inbound
 * tenant processor lands the request in KRA's partition.
 * @param context The scenario context.
 * @returns The credentials for cross-tenant calls.
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
 * Phase 4 — Trader pre-injects a consumer-side negotiation entry into its
 * own PNAP, then issues the ContractRequestMessage cross-tenant to KRA.
 * @param context The scenario context.
 * @returns The negotiation ids produced.
 */
async function runPhase4(context: IKenyaContext): Promise<{
	providerNegotiationPid: string;
	traderConsumerPid: string;
}> {
	phase(4, "Trader initiates PNP negotiation against KRA's offer");

	const traderConsumerPid = urn("contract-negotiation:trader");

	// 1. Pre-inject a consumer-side negotiation entry (mobius pattern).
	// PNAP /admin/* routes accept the local session JWT, so we use the
	// Trader-scoped client without any cross-tenant routing token.
	step("Pre-injecting Trader negotiation entry into PNAP...");
	const traderPnap = makePnapClient({
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt
	});
	const traderPnapEntry: IPolicyNegotiation = {
		id: traderConsumerPid,
		correlationId: "",
		dateCreated: new Date().toISOString(),
		state: DataspaceProtocolContractNegotiationStateType.REQUESTED,
		nodeIdentity: context.traderDid,
		organizationIdentity: context.traderDid
	};
	await traderPnap.set(traderPnapEntry);
	ok("Trader PNAP entry created");

	// 2. Send the ContractRequestMessage cross-tenant to KRA. The PNP rest
	// client takes the trust JWT explicitly as its `trustPayload` argument and
	// folds it into the Bearer Authorization header. The Trader-side
	// PolicyNegotiationPointService.sendRequestToProvider in production builds
	// the callbackAddress automatically; here we mirror that wiring manually
	// — including the per-tenant trailing `?x-enc-tenant-token=...` so the
	// provider's reply lands in Trader's partition.
	step("Sending ContractRequestMessage to KRA...");
	const traderCallbackUrl = `${context.internalUrl}/rights-management?x-enc-tenant-token=${encodeURIComponent(
		context.traderTenantToken
	)}`;

	const offer = {
		"@context": context.odrlContext,
		"@type": "Offer",
		uid: context.kraOfferId,
		assigner: context.kraDid,
		target: context.kraDatasetId,
		action: "read",
		permission: [
			{
				action: "read",
				target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" }
			}
		]
	};

	// NOTE: bash test sends "@context" as ARRAY (`[$ctx]`); the type signature
	// here allows a single string, but the platform's body validation appears
	// to reject the string form with HTTP 400. Wrap in an array to mirror the
	// bash payload — this is JSON-LD convention anyway.
	const request: IDataspaceProtocolContractRequestMessage = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		"@context": [DataspaceProtocolContexts.Context] as any,
		"@type": DataspaceProtocolContractNegotiationTypes.ContractRequestMessage,
		consumerPid: traderConsumerPid,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		offer: offer as any,
		callbackAddress: traderCallbackUrl
	};

	const pnp = makePnpClient(traderToKraCredentials(context));

	console.error("DEBUG REQUEST BODY:", JSON.stringify(request, null, 2));
	let response;
	try {
		response = await pnp.requestFromConsumer(request, context.traderTrustJwt);
	} catch (err) {
		console.error(
			"DEBUG ERROR PROPERTIES:",
			JSON.stringify((err as { properties?: unknown })?.properties ?? {}, null, 2)
		);

		console.error("DEBUG ERROR MESSAGE:", (err as Error)?.message);
		throw err;
	}

	if ((response as { "@type"?: string })["@type"]?.endsWith("Error") === true) {
		fail(`PNP negotiation request returned an error: ${JSON.stringify(response)}`);
	}

	const negotiation = response as IDataspaceProtocolContractNegotiation;
	const providerNegotiationPid = negotiation.providerPid;
	assertNonEmpty(providerNegotiationPid, "Negotiation initiated (providerPid present)");
	ok(`Negotiation initiated (providerPid: ${providerNegotiationPid})`);

	return { providerNegotiationPid, traderConsumerPid };
}

/**
 * Phase 5 — poll KRA's PNP for the negotiation to reach FINALIZED / VERIFIED,
 * then resolve the agreement id from Trader's PNAP entry.
 * @param context The scenario context.
 * @param phase4Out The output of phase 4.
 * @param phase4Out.providerNegotiationPid KRA-side (provider) negotiation pid to poll.
 * @param phase4Out.traderConsumerPid Trader-side (consumer) negotiation pid.
 * @returns The full negotiation output including the agreement id.
 */
async function runPhase5(
	context: IKenyaContext,
	phase4Out: { providerNegotiationPid: string; traderConsumerPid: string }
): Promise<INegotiationOutput> {
	phase(5, "Negotiation reaches FINALIZED / VERIFIED");

	const pnp = makePnpClient(traderToKraCredentials(context));
	let finalState: string | undefined;
	let lastState: string | undefined;
	for (let attempt = 1; attempt <= 15; attempt++) {
		const stateResp = (await pnp.getNegotiation(
			phase4Out.providerNegotiationPid,
			context.traderTrustJwt
		)) as IDataspaceProtocolContractNegotiation;
		lastState = stateResp.state;

		console.log(`    Attempt ${attempt}/15: state=${lastState ?? "<unknown>"}`);
		if (
			lastState === DataspaceProtocolContractNegotiationStateType.FINALIZED ||
			lastState === DataspaceProtocolContractNegotiationStateType.VERIFIED
		) {
			finalState = lastState;
			break;
		}
		if (attempt < 15) {
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
	}

	assert(
		typeof finalState === "string",
		`Negotiation completed (state: ${finalState ?? "<unknown>"})`,
		`Negotiation did not reach FINALIZED (last seen: ${lastState ?? "<unknown>"})`
	);

	// Extract agreement id from Trader's PNAP.
	const traderPnap = makePnapClient({
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt
	});
	const pnapEntry = await traderPnap.get(phase4Out.traderConsumerPid);
	const agreementId =
		(pnapEntry.agreement as { "@id"?: string; uid?: string } | undefined)?.["@id"] ??
		(pnapEntry.agreement as { uid?: string } | undefined)?.uid ??
		"";
	let traderAgreementId = agreementId;
	if (traderAgreementId.length === 0) {
		// Bash test falls back to KRA_OFFER_ID if the PNAP entry hasn't
		// propagated yet — mirror that behaviour.
		info("Could not extract agreement id from Trader PNAP — falling back to KRA_OFFER_ID");
		traderAgreementId = context.kraOfferId;
	} else {
		ok(`Agreement id from Trader PNAP: ${traderAgreementId}`);
	}

	return {
		providerNegotiationPid: phase4Out.providerNegotiationPid,
		traderConsumerPid: phase4Out.traderConsumerPid,
		traderAgreementId
	};
}

/**
 * Combined Phase 4 + 5 runner. They are tightly coupled (Phase 5 needs the
 * provider PID from Phase 4) so we expose them as a single import.
 * @param context The scenario context.
 * @returns The negotiation output.
 */
export async function runPhase4and5(context: IKenyaContext): Promise<INegotiationOutput> {
	const phase4Out = await runPhase4(context);
	return runPhase5(context, phase4Out);
}
