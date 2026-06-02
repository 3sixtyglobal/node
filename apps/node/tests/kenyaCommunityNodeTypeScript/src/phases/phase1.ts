// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseError } from "@twin.org/core";
import { DataspaceProtocolCatalogTypes } from "@twin.org/standards-dataspace-protocol";
import { assert } from "../assert.js";
import type { IKenyaContext } from "../context.js";
import { fail, info, ok, phase } from "../logger.js";
import { makeFederatedCatalogueClient } from "../restClientFactory.js";

/**
 * Phase 1 — Trader queries the federated catalogue and either receives a
 * Catalog or the `noDatasetsFound` "empty" response. Either outcome proves
 * that Trader's tenant context successfully reaches the catalogue service.
 * The catalogue partition is [Node]-only, so the response is shared across
 * tenants once KRA has seeded.
 * @param context The scenario context.
 */
export async function runPhase1(context: IKenyaContext): Promise<void> {
	phase(1, "Trader queries federated catalogue (expects shared [Node] discovery)");

	const catalogue = makeFederatedCatalogueClient({
		host: context.host,
		apiKey: context.traderApiKey,
		sessionJwt: context.traderSessionJwt
	});

	try {
		const { result } = await catalogue.query([]);

		// Service may return either a Catalog (with or without datasets) or
		// an empty-payload variant. The bash test treats all of these as
		// proof-of-routing for this phase.
		if (result["@type"] === DataspaceProtocolCatalogTypes.Catalog) {
			const catalog = result;
			const datasets = catalog.dataset;
			let count = 0;
			if (Array.isArray(datasets)) {
				count = datasets.length;
			} else if (datasets) {
				count = 1;
			}
			ok(`Trader can reach federated-catalogue/request (HTTP 200, datasets: ${count})`);
		} else if (result["@type"] === DataspaceProtocolCatalogTypes.CatalogError) {
			const error = result;
			ok(`Trader can reach federated-catalogue/request (CatalogError code=${error.code})`);
		} else {
			fail(`Unexpected catalogue response @type=${String(result["@type"])}`);
		}
	} catch (err) {
		// 404 noDatasetsFound is the empty-catalogue payload the bash scaffold
		// treats as success: the request reached the service in Trader's
		// tenant context, the service just had no datasets to return yet.
		const isEmpty = BaseError.someErrorMessage(err, /noDatasetsFound/);
		assert(
			isEmpty,
			"Trader can reach federated-catalogue/request (404 noDatasetsFound — empty)",
			`Trader catalogue query failed: ${err instanceof Error ? err.message : String(err)}`
		);
		info("This proves the partition fix: Trader's tenant context successfully queried");
		info("the [Node]-only catalogue. Empty result is expected before KRA seeds an offer.");
	}

	info("Run ./provision-storage.sh next to seed KRA's dataset + ODRL offer,");
	info("then re-run this test.");
}
