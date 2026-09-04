// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
// Probe extension for twin-dataspace #362: calls the in-process-only consumer methods
// negotiateAgreement (agreement reuse across PAP pages) and prepareTransfer (prune of an
// agreement the provider reports unknown) in the consumer tenant's context and prints
// PROBE-* lines for option3-test.sh to parse. One call per process, then exit.
import { ContextIdStore } from "@twin.org/context";
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
			setTimeout(async () => {
				try {
					await runProbe(engineCore);
					process.exit(0);
				} catch (err) {
					console.error("PROBE-ERROR", err);
					process.exit(3);
				}
			}, 5000);
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
	const mode = process.env.PROBE_MODE ?? "negotiate";
	const datasetId = process.env.PROBE_DATASET_ID;
	const offerId = process.env.PROBE_OFFER_ID;
	const providerEndpoint = process.env.PROBE_PROVIDER_ENDPOINT;
	const trustPayload = process.env.PROBE_TRUST_JWT;
	const agreementId = process.env.PROBE_AGREEMENT_ID;
	const ctx = {
		organization: process.env.PROBE_ORG,
		publicOrigin: process.env.TWIN_PUBLIC_ORIGIN ?? "http://twin-kenya-defaultarb-node:3000"
	};
	if (process.env.PROBE_TENANT) {
		ctx.tenant = process.env.PROBE_TENANT;
	}
	try {
		const { readFileSync } = await import("node:fs");
		const engineState = JSON.parse(readFileSync("/app/data/engine-state.json", "utf8"));
		if (engineState?.nodeId) {
			ctx.node = engineState.nodeId;
		}
	} catch {}
	console.log("PROBE-START", JSON.stringify({ mode, datasetId, offerId, providerEndpoint, agreementId, ctx }));
	let result;
	let callError;
	try {
		result = await ContextIdStore.run(ctx, async () =>
			mode === "prepare"
				? controlPlane.prepareTransfer(agreementId, providerEndpoint, "HttpData-PULL", trustPayload)
				: controlPlane.negotiateAgreement(datasetId, offerId, providerEndpoint, trustPayload)
		);
	} catch (err) {
		callError = {
			name: err?.name ?? "Error",
			message: err?.message ?? String(err),
			properties: err?.properties,
			inner: err?.inner ? { name: err.inner.name, message: err.inner.message } : undefined
		};
	}
	console.log("PROBE-RETURN", JSON.stringify({ mode, result: result ?? null, error: callError ?? null }));
}

/**
 * Initialise the extension configuration (nothing to configure for the probe).
 */
export async function extensionInitialise() {}
