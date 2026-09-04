// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
// Probe extension: live reproduction of twin-dataspace #333 agreement reuse,
// onFinalized(undefined, agreementId) broadcast to all negotiation callbacks.
import { ContextIdHelper, ContextIdStore } from "@twin.org/context";
import { ComponentFactory } from "@twin.org/core";

/**
 * Initialise the engine for the extension: schedule the probe after engine start.
 * @param engineCore The engine core instance.
 */
export async function extensionInitialiseEngine(engineCore) {
	const startedAt = Date.now();
	const timer = setInterval(async () => {
		let controlPlaneReady = false;
		try {
			const cpType = engineCore.getRegisteredInstanceType("dataspaceControlPlaneComponent");
			controlPlaneReady = Boolean(ComponentFactory.getIfExists(cpType));
		} catch {}
		if (controlPlaneReady) {
			clearInterval(timer);
			// Small grace period so remaining components finish starting.
			setTimeout(async () => {
				try {
					await runProbe(engineCore);
					process.exit(0);
				} catch (err) {
					console.error("PROBE-ERROR", err);
					process.exit(3);
				}
			}, 8000);
		} else if (Date.now() - startedAt > 120000) {
			clearInterval(timer);
			console.error("PROBE-ERROR control plane never became available");
			process.exit(4);
		}
	}, 2000);
}

async function runProbe(engineCore) {
	const cpType = engineCore.getRegisteredInstanceType("dataspaceControlPlaneComponent");
	const controlPlane = ComponentFactory.get(cpType);
	const datasetId = process.env.PROBE_DATASET_ID;
	const offerId = process.env.PROBE_OFFER_ID;
	const providerEndpoint = process.env.PROBE_PROVIDER_ENDPOINT;
	const trustPayload = process.env.PROBE_TRUST_JWT;
	const orgId = process.env.PROBE_ORG;
	console.log("PROBE-START", JSON.stringify({ cpType, datasetId, offerId, providerEndpoint, orgId }));

	const events = [];
	const cbBenign = {
		onStateChanged: async (n, s) => { events.push(["benign.onStateChanged", n, s]); },
		onFinalized: async (negotiationId, agreementId) => {
			events.push(["benign.onFinalized", String(negotiationId), agreementId]);
		},
		onFailed: async (n, r) => { events.push(["benign.onFailed", n, r]); }
	};
	// Mirrors twin-supply-chain dataspaceClient failure mode 1: resolveEntities is
	// declared but not yet assigned when the reuse broadcast fires inside negotiateAgreement.
	let resolveEntities;
	const cbSupplyChainStyle = {
		onStateChanged: async () => {},
		onFinalized: async (negotiationId, agreementId) => {
			events.push(["scStyle.onFinalized.invoked", String(negotiationId), agreementId]);
			resolveEntities(undefined);
		},
		onFailed: async () => {}
	};
	controlPlane.registerNegotiationCallback("probe-benign", cbBenign);
	controlPlane.registerNegotiationCallback("probe-supplychain-style", cbSupplyChainStyle);

	const publicOrigin = process.env.TWIN_PUBLIC_ORIGIN ?? "http://twin-kenya-defaultarb-node:3000";
	const shortCtx = { organization: orgId };
	if (process.env.PROBE_TENANT) {
		shortCtx.tenant = process.env.PROBE_TENANT;
	}
	try {
		const { readFileSync } = await import("node:fs");
		const engineState = JSON.parse(readFileSync("/app/data/engine-state.json", "utf8"));
		if (engineState?.nodeId) {
			shortCtx.node = engineState.nodeId;
		}
	} catch {}
	const ctx = {
		...shortCtx,
		publicOrigin
	};
	console.log("PROBE-CTX", JSON.stringify(ctx));

	let result;
	let callError;
	try {
		result = await ContextIdStore.run(ctx, async () =>
			controlPlane.negotiateAgreement(datasetId, offerId, providerEndpoint, trustPayload)
		);
	} catch (err) {
		callError = `${err?.name ?? "Error"}: ${err?.message ?? String(err)}`;
		try {
			console.log("PROBE-ERRFULL", JSON.stringify(err, Object.getOwnPropertyNames(err)).slice(0, 2500));
		} catch {}
	}

	console.log("PROBE-RETURN", JSON.stringify(result ?? null), "error:", callError ?? "none");
	console.log("PROBE-EVENTS", JSON.stringify(events));
	const reuse = events.find(e => e[0] === "benign.onFinalized" && e[1] === "undefined");
	const scInvoked = events.find(e => e[0] === "scStyle.onFinalized.invoked");
	console.log("PROBE-VERDICT reuseFiredWithUndefinedNegotiationId:", reuse ? "YES" : "NO");
	console.log("PROBE-VERDICT supplyChainStyleCallbackInvoked:", scInvoked ? "YES" : "NO");
	console.log("PROBE-VERDICT negotiateAgreementSurvivedCallbackTypeError:", callError ? "NO" : "YES");
}

/**
 * Initialise the extension configuration (no config changes needed for the probe).
 */
export async function extensionInitialise() {}
