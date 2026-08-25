// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ComponentFactory, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	AuthorizationConnectorType,
	EntityStorageConnectorType,
	IdentityConnectorType,
	IdentityResolverConnectorType,
	VaultConnectorType
} from "@twin.org/engine-types";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import {
	IdentityConnectorFactory,
	IdentityResolverConnectorFactory
} from "@twin.org/identity-models";
import type { ITrustComponent } from "@twin.org/trust-models";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { CI_ENV_VARS } from "./setupTestEnv.js";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import { run } from "../src/node.js";

const CATALOGUE_PORT = 24000 + Math.floor(Math.random() * 1000);
const PROXY_PORT = CATALOGUE_PORT + 1000;
const TEST_FEDCAT_DATASET_ID = "urn:uuid:test-n2n-dataset-001";
const TMP_N2N = "./tests/.tmp/n2n/";
const CATALOGUE_DB = path.resolve(`${TMP_N2N}catalogue/db`);
const PROXY_DB = path.resolve(`${TMP_N2N}proxy/db`);

interface IdentityStoreEntry {
	id: string;
}

async function readIdentityStore(dbRoot: string): Promise<IdentityStoreEntry[]> {
	try {
		return JSON.parse(
			await readFile(path.join(dbRoot, "identity-document", "store.json"), "utf8")
		) as IdentityStoreEntry[];
	} catch {
		return [];
	}
}

async function writeIdentityStore(dbRoot: string, entries: IdentityStoreEntry[]): Promise<void> {
	await mkdir(path.join(dbRoot, "identity-document"), { recursive: true });
	await writeFile(
		path.join(dbRoot, "identity-document", "store.json"),
		JSON.stringify(entries, undefined, "\t"),
		"utf8"
	);
}

// Minimal identity connectors needed by all nodes.
const BASE_ENV: { [id: string]: string } = {
	TWIN_DEBUG: "true",
	TWIN_SILENT: "true",
	TWIN_TENANT_ENABLED: "false",
	TWIN_SCHEMA_MIGRATION_ENABLED: "false",
	TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
	TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
	TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
	TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
	TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage,
	TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
};

// Trust vars shared by both nodes.
const TRUST_ENV: { [id: string]: string } = {
	TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
	TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
	TWIN_TRUST_VERIFICATION_METHOD_ID: "trust-assertion"
};

// Catalogue node: hosts the federated catalogue service.
// TWIN_FEDERATED_CATALOGUE_ENABLED makes isTrustRequired()=true so bootstrap
// creates the trust verification method key alongside the node DID.
const CATALOGUE_ENV: { [id: string]: string } = {
	...BASE_ENV,
	...TRUST_ENV,
	TWIN_FEDERATED_CATALOGUE_ENABLED: "true"
};

// Proxy node: trust vars required so the proxy can issue its own trust tokens.
// TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT (added per-run below) makes
// isTrustRequired()=true, so bootstrap also creates the trust verification key.
const PROXY_ENV: { [id: string]: string } = {
	...BASE_ENV,
	...TRUST_ENV
};

describe("node-core n2n", () => {
	test("Documents federated catalogue proxy behaviour when the caller identity does not exist on the remote node", async () => {
		await rm(TMP_N2N, { recursive: true, force: true });

		Factory.clearFactories();

		const catalogueState: INodeEngineState = {};
		const catalogueStorage = new MemoryStateStorage(false, catalogueState);
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: catalogueStorage,
				disableProcessExitOnFailure: true,
				envVars: {
					...CATALOGUE_ENV,
					TWIN_PORT: CATALOGUE_PORT.toString(),
					TWIN_STORAGE_FILE_ROOT: CATALOGUE_DB,
					TWIN_FEATURES: "node-identity"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		const catalogueServer = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: catalogueStorage,
			envVars: {
				...CATALOGUE_ENV,
				TWIN_PORT: CATALOGUE_PORT.toString(),
				TWIN_STORAGE_FILE_ROOT: CATALOGUE_DB
			}
		});

		const catalogueTrustComponentType =
			catalogueServer?.engine.getRegisteredInstanceType("trustComponent");
		const catalogueTrustComponent = ComponentFactory.get<ITrustComponent>(
			catalogueTrustComponentType ?? ""
		);
		const catalogueTrustToken = await catalogueTrustComponent.generate(
			catalogueState.nodeOrganizationId ?? "",
			undefined,
			{ subject: {} }
		);

		const seedRes = await fetch(`http://localhost:${CATALOGUE_PORT}/catalog/datasets`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${String(catalogueTrustToken)}`
			},
			body: JSON.stringify({
				"@context": {
					dcat: "http://www.w3.org/ns/dcat#",
					dcterms: "http://purl.org/dc/terms/",
					odrl: "http://www.w3.org/ns/odrl/2/"
				},
				"@id": TEST_FEDCAT_DATASET_ID,
				"@type": "dcat:Dataset",
				"dcterms:title": "N2N Test Dataset",
				"dcterms:publisher": catalogueState.nodeId ?? "",
				"odrl:hasPolicy": [
					{
						"@context": "http://www.w3.org/ns/odrl.jsonld",
						"@type": "Offer",
						uid: "urn:uuid:n2n-test-offer-001",
						assigner: catalogueState.nodeId ?? "",
						permission: [{ action: "use" }]
					}
				],
				"dcat:distribution": [
					{
						"@type": "dcat:Distribution",
						"dcterms:format": "HttpData-PULL",
						"dcat:accessService": "https://example.com/n2n-data-access"
					}
				]
			})
		});
		expect(seedRes.status).toBe(201);

		EntityStorageConnectorFactory.clear();
		VaultConnectorFactory.clear();
		IdentityConnectorFactory.clear();
		IdentityResolverConnectorFactory.clear();

		const proxyRemoteEndpoint = `http://localhost:${CATALOGUE_PORT}`;
		const proxyState: INodeEngineState = {};
		const proxyStorage = new MemoryStateStorage(false, proxyState);
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: proxyStorage,
				disableProcessExitOnFailure: true,
				envVars: {
					...PROXY_ENV,
					TWIN_PORT: PROXY_PORT.toString(),
					TWIN_STORAGE_FILE_ROOT: PROXY_DB,
					TWIN_FEATURES: "node-identity",
					TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT: proxyRemoteEndpoint
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		const proxyServer = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: proxyStorage,
			envVars: {
				...PROXY_ENV,
				TWIN_PORT: PROXY_PORT.toString(),
				TWIN_STORAGE_FILE_ROOT: PROXY_DB,
				TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT: proxyRemoteEndpoint
			}
		});

		const proxyTrustComponentType = proxyServer?.engine.getRegisteredInstanceType("trustComponent");
		const proxyTrustComponent = ComponentFactory.get<ITrustComponent>(
			proxyTrustComponentType ?? ""
		);
		const proxyTrustToken = await proxyTrustComponent.generate(
			proxyState.nodeOrganizationId ?? "",
			undefined,
			{ subject: {} }
		);

		const catalogueIdentityStore = await readIdentityStore(CATALOGUE_DB);
		expect(catalogueIdentityStore.some(entry => entry.id === proxyState.nodeOrganizationId)).toBe(
			false
		);

		try {
			const requestRes = await fetch(`http://localhost:${PROXY_PORT}/catalog/request`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${String(proxyTrustToken)}`
				},
				body: JSON.stringify({
					"@context": ["https://w3id.org/dspace/2025/1/context.jsonld"],
					"@type": "CatalogRequestMessage"
				})
			});

			// With mandatory trust verification, the remote catalogue cannot verify the
			// proxy's trust token (proxy DID not in catalogue's identity store), so it
			// returns a CatalogError rather than datasets.
			expect(requestRes.status).toBe(200);

			const requestBody = (await requestRes.json()) as {
				"@type"?: string;
				dataset?: unknown[];
			};
			expect(Array.isArray(requestBody.dataset) && requestBody.dataset.length > 0).toBe(false);

			const getRes = await fetch(
				`http://localhost:${PROXY_PORT}/catalog/datasets/${TEST_FEDCAT_DATASET_ID}`,
				{ headers: { authorization: `Bearer ${String(proxyTrustToken)}` } }
			);
			expect(getRes.status).toBe(200);
			const datasetBody = (await getRes.json()) as { "@id"?: string };
			expect(datasetBody["@id"]).toBe(TEST_FEDCAT_DATASET_ID);
		} finally {
			await proxyServer?.shutdown();
			await catalogueServer?.shutdown();
			await rm(TMP_N2N, { recursive: true, force: true });
		}
	}, 300000);

	test("Can verify federated catalogue remote endpoint communication between two nodes", async () => {
		await rm(TMP_N2N, { recursive: true, force: true });

		Factory.clearFactories();

		// Each node requires two run() calls: bootstrap then server start.
		// Bootstrap writes the node's DID and vault keys to disk and stores the
		// nodeId in the MemoryStateStorage. The server start reads that nodeId
		// back automatically. The two steps cannot be merged because nodeId is
		// only known after bootstrap.

		// Catalogue node: hosts the federated catalogue service
		const catalogueState: INodeEngineState = {};
		const catalogueStorage = new MemoryStateStorage(false, catalogueState);
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: catalogueStorage,
				disableProcessExitOnFailure: true,
				envVars: {
					...CATALOGUE_ENV,
					TWIN_PORT: CATALOGUE_PORT.toString(),
					TWIN_STORAGE_FILE_ROOT: CATALOGUE_DB,
					TWIN_FEATURES: "node-identity"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		const catalogueServer = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: catalogueStorage,
			envVars: {
				...CATALOGUE_ENV,
				TWIN_PORT: CATALOGUE_PORT.toString(),
				TWIN_STORAGE_FILE_ROOT: CATALOGUE_DB
			}
		});
		expect(catalogueServer?.engine).toBeDefined();

		const catalogueNodeId = catalogueState.nodeId;
		expect(catalogueNodeId).toBeDefined();

		// Generate a catalogue trust token to seed the dataset directly.
		const catalogueTrustComponentType =
			catalogueServer?.engine.getRegisteredInstanceType("trustComponent");
		const catalogueTrustComponent = ComponentFactory.get<ITrustComponent>(
			catalogueTrustComponentType ?? ""
		);
		const catalogueTrustToken = await catalogueTrustComponent.generate(
			catalogueState.nodeOrganizationId ?? "",
			undefined,
			{ subject: {} }
		);

		// Seed a dataset into the catalogue node via HTTP.
		const seedRes = await fetch(`http://localhost:${CATALOGUE_PORT}/catalog/datasets`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${String(catalogueTrustToken)}`
			},
			body: JSON.stringify({
				"@context": {
					dcat: "http://www.w3.org/ns/dcat#",
					dcterms: "http://purl.org/dc/terms/",
					odrl: "http://www.w3.org/ns/odrl/2/"
				},
				"@id": TEST_FEDCAT_DATASET_ID,
				"@type": "dcat:Dataset",
				"dcterms:title": "N2N Test Dataset",
				"dcterms:publisher": catalogueNodeId ?? "",
				"odrl:hasPolicy": [
					{
						"@context": "http://www.w3.org/ns/odrl.jsonld",
						"@type": "Offer",
						uid: "urn:uuid:n2n-test-offer-001",
						assigner: catalogueNodeId ?? "",
						permission: [{ action: "use" }]
					}
				],
				"dcat:distribution": [
					{
						"@type": "dcat:Distribution",
						"dcterms:format": "HttpData-PULL",
						"dcat:accessService": "https://example.com/n2n-data-access"
					}
				]
			})
		});
		expect(seedRes.status).toBe(201);

		// Proxy node: proxies fedcat requests to the catalogue node
		// Clear only the low-level connector factories (entity-storage, vault,
		// identity) so the proxy bootstrap can register its own connectors
		// pointing to PROXY_DB. ComponentFactory and route-processor factories
		// are intentionally kept so the already-running catalogue server
		// continues serving requests (its route handlers call
		// ComponentFactory.get(...) at request time).
		EntityStorageConnectorFactory.clear();
		VaultConnectorFactory.clear();
		IdentityConnectorFactory.clear();
		IdentityResolverConnectorFactory.clear();

		// TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT in the bootstrap env makes
		// isTrustRequired()=true so the proxy's DID gets a trust verification
		// method key. The endpoint is the base URL - BaseRestClient appends
		// "/catalog" automatically.
		const proxyRemoteEndpoint = `http://localhost:${CATALOGUE_PORT}`;
		const proxyState: INodeEngineState = {};
		const proxyStorage = new MemoryStateStorage(false, proxyState);
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: proxyStorage,
				disableProcessExitOnFailure: true,
				envVars: {
					...PROXY_ENV,
					TWIN_PORT: PROXY_PORT.toString(),
					TWIN_STORAGE_FILE_ROOT: PROXY_DB,
					TWIN_FEATURES: "node-identity",
					TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT: proxyRemoteEndpoint
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		const proxyNodeId = proxyState.nodeId;
		expect(proxyNodeId).toBeDefined();

		// Copy the proxy's DID document into the catalogue's entity storage so
		// the catalogue's identity resolver can find it when verifying the proxy's
		// trust token. FileEntityStorageConnector reads store.json from disk on
		// every lookup, so the update is visible immediately without restarting.
		const proxyOrgId = proxyState.nodeOrganizationId;
		expect(proxyOrgId).toBeDefined();
		const proxyIdentityStore = await readIdentityStore(PROXY_DB);
		const proxyDidEntry = proxyIdentityStore.find(e => e.id === proxyOrgId);
		expect(proxyDidEntry).toBeDefined();
		if (!proxyDidEntry) {
			throw new Error("Proxy org DID entry not found in identity store");
		}

		const catalogueIdentityStore = await readIdentityStore(CATALOGUE_DB);
		catalogueIdentityStore.push(proxyDidEntry);
		await writeIdentityStore(CATALOGUE_DB, catalogueIdentityStore);

		const proxyServer = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: proxyStorage,
			envVars: {
				...PROXY_ENV,
				TWIN_PORT: PROXY_PORT.toString(),
				TWIN_STORAGE_FILE_ROOT: PROXY_DB,
				TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT: proxyRemoteEndpoint
			}
		});
		expect(proxyServer?.engine).toBeDefined();

		// Generate a trust token from the proxy's own identity.
		const proxyTrustComponentType = proxyServer?.engine.getRegisteredInstanceType("trustComponent");
		const proxyTrustComponent = ComponentFactory.get<ITrustComponent>(
			proxyTrustComponentType ?? ""
		);
		const proxyTrustToken = await proxyTrustComponent.generate(proxyOrgId ?? "", undefined, {
			subject: {}
		});

		// Verify proxy: requests to proxy node are forwarded to catalogue ────
		// The proxy passes the trust token to the catalogue, which verifies the
		// proxy's identity using the DID document now present in its entity storage.
		try {
			const requestRes = await fetch(`http://localhost:${PROXY_PORT}/catalog/request`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${String(proxyTrustToken)}`
				},
				body: JSON.stringify({
					"@context": ["https://w3id.org/dspace/2025/1/context.jsonld"],
					"@type": "CatalogRequestMessage"
				})
			});
			expect(requestRes.status).toBe(200);
			const catalogBody = (await requestRes.json()) as {
				dataset?: unknown[];
				catalog?: { dataset?: unknown[] }[];
			};
			// Datasets published by the catalogue node appear in nested catalog entries
			// (DS Protocol: own datasets go in root dataset[], other participants' go in catalog[])
			const rootDatasets = Array.isArray(catalogBody.dataset) ? catalogBody.dataset.length : 0;
			const nestedDatasets = Array.isArray(catalogBody.catalog)
				? catalogBody.catalog.reduce(
						(n, c) => n + (Array.isArray(c.dataset) ? c.dataset.length : 0),
						0
					)
				: 0;
			expect(rootDatasets + nestedDatasets > 0).toBe(true);

			const getRes = await fetch(
				`http://localhost:${PROXY_PORT}/catalog/datasets/${TEST_FEDCAT_DATASET_ID}`,
				{ headers: { authorization: `Bearer ${String(proxyTrustToken)}` } }
			);
			expect(getRes.status).toBe(200);
			const datasetBody = (await getRes.json()) as { "@id"?: string };
			expect(datasetBody["@id"]).toBe(TEST_FEDCAT_DATASET_ID);
		} finally {
			await proxyServer?.shutdown();
			await catalogueServer?.shutdown();
			await rm(TMP_N2N, { recursive: true, force: true });
		}
	}, 120000);
});
