// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
/* eslint-disable no-console, unicorn/no-process-exit, import/no-extraneous-dependencies -- one-shot probe extension: its console lines are the interface option3-test.sh parses, it exits the node after one call, and it resolves packages from the node image */
// Probe extension for twin-dataspace #362: calls the in-process-only consumer methods
// negotiateAgreement (agreement reuse across PAP pages) and prepareTransfer (prune of an
// agreement the provider reports unknown) in the consumer tenant's context and prints
// PROBE-* lines for option3-test.sh to parse. One call per process, then exit.
import { ContextIdStore } from '@twin.org/context';
import { ComponentFactory } from '@twin.org/core';
import { ComparisonOperator } from '@twin.org/entity';
import { EntityStorageConnectorFactory } from '@twin.org/entity-storage-models';

/**
 * Initialise the engine for the extension: schedule the probe after engine start.
 * @param engineCore The engine core instance.
 */
export async function extensionInitialiseEngine(engineCore) {
	const startedAt = Date.now();
	const timer = setInterval(async () => {
		let controlPlaneReady = false;
		try {
			const cpType = engineCore.getRegisteredInstanceType('dataspaceControlPlaneComponent');
			controlPlaneReady = Boolean(ComponentFactory.getIfExists(cpType));
		} catch {}
		if (controlPlaneReady) {
			clearInterval(timer);
			setTimeout(async () => {
				try {
					await runProbe(engineCore);
					process.exit(0);
				} catch (err) {
					console.error('PROBE-ERROR', err);
					process.exit(3);
				}
			}, 5000);
		} else if (Date.now() - startedAt > 120000) {
			clearInterval(timer);
			console.error('PROBE-ERROR control plane never became available');
			process.exit(4);
		}
	}, 2000);
}

async function runProbe(engineCore) {
	const cpType = engineCore.getRegisteredInstanceType('dataspaceControlPlaneComponent');
	const controlPlane = ComponentFactory.get(cpType);
	const mode = process.env.PROBE_MODE ?? 'negotiate';
	const datasetId = process.env.PROBE_DATASET_ID;
	const offerId = process.env.PROBE_OFFER_ID;
	const providerEndpoint = process.env.PROBE_PROVIDER_ENDPOINT;
	const trustPayload = process.env.PROBE_TRUST_JWT;
	const agreementId = process.env.PROBE_AGREEMENT_ID;
	const ctx = {
		organization: process.env.PROBE_ORG,
		publicOrigin: process.env.TWIN_PUBLIC_ORIGIN ?? 'http://twin-kenya-defaultarb-node:3000'
	};
	if (process.env.PROBE_TENANT) {
		ctx.tenant = process.env.PROBE_TENANT;
	}
	try {
		const { readFileSync } = await import('node:fs');
		const engineState = JSON.parse(readFileSync('/app/data/engine-state.json', 'utf8'));
		if (engineState?.nodeId) {
			ctx.node = engineState.nodeId;
		}
	} catch {}
	console.log(
		'PROBE-START',
		JSON.stringify({ mode, datasetId, offerId, providerEndpoint, agreementId, ctx })
	);
	let result;
	let callError;
	try {
		result = await ContextIdStore.run(ctx, async () => {
			if (mode === 'prepare') {
				return controlPlane.prepareTransfer(
					agreementId,
					providerEndpoint,
					'HttpData-PULL',
					trustPayload
				);
			}
			return controlPlane.negotiateAgreement(datasetId, offerId, providerEndpoint, trustPayload);
		});
	} catch (err) {
		callError = {
			name: err?.name ?? 'Error',
			message: err?.message ?? String(err),
			properties: err?.properties,
			inner: err?.inner ? { name: err.inner.name, message: err.inner.message } : undefined
		};
	}
	if (mode === 'prepare' && result?.consumerPid) {
		// twin-api #282: with TWIN_DATASPACE_AUTO_START_TRANSFERS=true the provider schedules its start on a
		// zero-delay timer inside THIS process (in-process route), so stay alive until the record moves.
		const providerCtx = {
			...ctx,
			organization: process.env.PROBE_PROVIDER_ORG,
			tenant: process.env.PROBE_PROVIDER_TENANT
		};
		Object.assign(result, await waitForTransferStates(result.consumerPid, ctx, providerCtx));
	}
	console.log(
		'PROBE-RETURN',
		JSON.stringify({ mode, result: result ?? null, error: callError ?? null })
	);
}

/**
 * Read the transfer-process state for one role under its tenant context.
 * @param ctx The context ids of the role's tenant.
 * @param consumerPid The transfer's consumer pid.
 * @param localRole "provider" or "consumer".
 * @returns The state or undefined.
 */
async function readTransferState(ctx, consumerPid, localRole) {
	return ContextIdStore.run(ctx, async () => {
		const connector = EntityStorageConnectorFactory.get('transfer-process');
		const page = await connector.query({
			conditions: [
				{ property: 'consumerPid', value: consumerPid, comparison: ComparisonOperator.Equals },
				{ property: 'localRole', value: localRole, comparison: ComparisonOperator.Equals }
			]
		});
		return page?.entities?.[0]?.state;
	});
}

/**
 * Poll both role records until the provider record leaves REQUESTED or the wait expires.
 * @param consumerPid The transfer's consumer pid.
 * @param consumerCtx The consumer tenant context.
 * @param providerCtx The provider tenant context.
 * @returns The final states and the time waited.
 */
async function waitForTransferStates(consumerPid, consumerCtx, providerCtx) {
	const maxMs = Number(process.env.PROBE_AUTOSTART_WAIT_MS ?? 20000);
	const started = Date.now();
	let providerState;
	let consumerState;
	while (Date.now() - started < maxMs) {
		providerState = await readTransferState(providerCtx, consumerPid, 'provider');
		consumerState = await readTransferState(consumerCtx, consumerPid, 'consumer');
		if (
			providerState &&
			providerState !== 'REQUESTED' &&
			consumerState &&
			consumerState !== 'REQUESTED'
		) {
			break;
		}
		await new Promise(resolve => setTimeout(resolve, 500));
	}
	return {
		providerState: providerState ?? null,
		consumerState: consumerState ?? null,
		waitedMs: Date.now() - started
	};
}

/**
 * Initialise the extension configuration (nothing to configure for the probe).
 */
export async function extensionInitialise() {}
