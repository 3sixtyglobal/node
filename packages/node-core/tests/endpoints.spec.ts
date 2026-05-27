// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { rm } from "node:fs/promises";
import path from "node:path";
import { ComponentFactory, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	AuthenticationAdminComponentType,
	AuthenticationComponentType
} from "@twin.org/engine-server-types";
import {
	AttestationConnectorType,
	BlobStorageConnectorType,
	EntityStorageConnectorType,
	EventBusComponentType,
	EventBusConnectorType,
	FaucetConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	IdentityResolverConnectorType,
	LoggingConnectorType,
	NftConnectorType,
	NotarizationConnectorType,
	TelemetryConnectorType,
	VaultConnectorType,
	VerifiableStorageConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import type { ITrustComponent } from "@twin.org/trust-models";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import { run } from "../src/node.js";
import { loadAndRunGroups } from "./endpoints/runner.js";

const TEST_PORT = 21000 + Math.floor(Math.random() * 1000);
const TEST_TENANT_API_KEY = "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d";
const TEST_ADMIN_EMAIL = "admin@node";
const TEST_ADMIN_PASSWORD = "Admin@Node12345!";
const OUTPUT_TMP_DIR = "./tests/.tmp-endpoints/";

const SHARED_ENV_VARS: { [id: string]: string } = {
	TWIN_DEBUG: "true",
	TWIN_SILENT: "true",
	TWIN_TENANT_ENABLED: "true",
	TWIN_PORT: TEST_PORT.toString(),
	TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR}db`,
	TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
	TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
	TWIN_BLOB_STORAGE_CONNECTOR_PUBLIC: BlobStorageConnectorType.Memory,
	TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
	TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
	TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
	TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
	TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
	TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
	TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
	TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
	TWIN_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
	TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
	TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
	TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
	TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
	TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
	TWIN_HEALTH_ENABLED: "true",
	TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
	TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
	TWIN_DATA_PROCESSING_ENABLED: "true",
	TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
	TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
	TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
	TWIN_AUTOMATION_ACTION_TYPES: "fetch",
	TWIN_MESSAGING_ENABLED: "true",
	TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
	TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
	TWIN_DATASPACE_ENABLED: "true",
	TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
	TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
	TWIN_TRUST_VERIFICATION_METHOD_ID: "trust-assertion",
	TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH: "/rights-management",
	TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity",
	TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "pass-through",
	TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "pass-through",
	TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
	TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "pass-through",
	TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "pass-through"
};

describe("node-core", () => {
	test("Can bootstrap the node and exercise all connected endpoints", async () => {
		await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
		Factory.clearFactories();

		// Phase 1: Bootstrap — creates node identity, auth signing key, tenant, admin user.
		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: {
					...SHARED_ENV_VARS,
					TWIN_FEATURES: "node-identity,node-admin-user",
					TWIN_TENANT_API_KEY: TEST_TENANT_API_KEY,
					TWIN_ADMIN_USER_NAME: TEST_ADMIN_EMAIL,
					TWIN_ADMIN_USER_PASSWORD: TEST_ADMIN_PASSWORD,
					TWIN_ADMIN_USER_SCOPE: "tenant-admin,user-admin",
					TWIN_HEALTH_CHECK_STARTUP_INTERVAL: "500"
				}
			},
			["node", "index.js", "bootstrap-legacy"]
		);

		expect(bootstrapState.nodeId).toBeDefined();
		expect(bootstrapState.nodeTenantId).toBeDefined();

		Factory.clearFactories();

		// Phase 2: Start the server using the bootstrapped identity/tenant state.
		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			openApiSpecFile: path.resolve("../../apps/node/docs/open-api/spec.json"),
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId,
				nodeTenantId: bootstrapState.nodeTenantId
			}),
			envVars: SHARED_ENV_VARS
		});

		expect(serverResult).toBeDefined();
		expect(serverResult?.engine).toBeDefined();

		const trustComponentType = serverResult?.engine.getRegisteredInstanceType("trustComponent");
		expect(trustComponentType).toBeDefined();

		const trustComponent = ComponentFactory.get<ITrustComponent>(trustComponentType ?? "");
		const trustBearerToken = await trustComponent.generate(bootstrapState.nodeId ?? "", undefined, {
			subject: {}
		});

		const serverStartTime = Date.now();

		// Phase 3: Exercise endpoints as a client, using the test definitions in tests/endpoints.
		try {
			await loadAndRunGroups(path.resolve("tests/endpoints/index.json"), {
				baseUrl: `http://localhost:${TEST_PORT}`,
				apiKeyQuery: `x-api-key=${TEST_TENANT_API_KEY}`,
				authToken: "",
				vars: {
					trustAuthorization: `Bearer ${String(trustBearerToken)}`,
					adminEmail: TEST_ADMIN_EMAIL,
					adminPassword: TEST_ADMIN_PASSWORD,
					metricId: "test-counter",
					ruleGroupId: "test-rule-group",
					docId: "DOC-TEST-001",
					testUserEmail: "test-user@node",
					testUserPassword: "TestUser@123456!",
					vmFragmentId: "test-vm",
					serviceId: "service-test-001",
					aliasId: "did:example:alias001",
					transferAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
					fakeId: "fake:nonexistent-resource-id"
				},
				serverStartTime
			});
		} finally {
			await serverResult?.shutdown();
			await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
		}
	});
});
