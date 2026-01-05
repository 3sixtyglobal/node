// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { rm, writeFile } from "node:fs/promises";
import type { AuthenticationUser } from "@twin.org/api-auth-entity-storage-service";
import type { Tenant } from "@twin.org/api-tenant-processor";
import { ComponentFactory, Converter, Factory, HexHelper } from "@twin.org/core";
import { DataSpaceConnectorAppFactory } from "@twin.org/data-space-connector-models";
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
	TelemetryConnectorType,
	VaultConnectorType,
	VerifiableStorageConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import type { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { FederatedCatalogueFilterFactory } from "@twin.org/federated-catalogue-models";
import type {
	IdentityDocument,
	IdentityProfile
} from "@twin.org/identity-connector-entity-storage";
import { Did } from "@twin.org/identity-models";
import {
	DataAccessHandlerFactory,
	PolicyArbiterFactory,
	PolicyEnforcementProcessorFactory,
	PolicyExecutionActionFactory,
	PolicyInformationSourceFactory,
	PolicyNegotiatorFactory,
	PolicyRequesterFactory
} from "@twin.org/rights-management-models";
import { TrustGeneratorFactory, TrustVerifierFactory } from "@twin.org/trust-models";
import type { VaultKey, VaultSecret } from "@twin.org/vault-connector-entity-storage";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import type { INodeOptions } from "../src/models/INodeOptions.js";
import { buildConfiguration, overrideModuleImport, run } from "../src/node.js";
import { start } from "../src/server.js";
import { initialiseLocales } from "../src/utils.js";

const basePort = Math.floor(Math.random() * 1000);
let port = 3000 + basePort;

describe("node-core", () => {
	beforeEach(() => {
		port++;

		Factory.clearFactories();
	});

	test("Can fail to run the node with no config as default is for file storage and this requires a storageFileRoot", async () => {
		await expect(run({ disableProcessExitOnFailure: true })).rejects.toThrow();
	});

	test("Can run the node with minimal config and shut it down", async () => {
		const result = await run({ stateStorage: new MemoryStateStorage(false, {}) });
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node with config with no node id", async () => {
		const result = await run({
			stateStorage: new MemoryStateStorage(false, {}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_PUBLIC: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
				TWIN_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
				TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
				TWIN_DATA_PROCESSING_ENABLED: "true",
				TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
				TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
				TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
				TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
				TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
				TWIN_FEATURES: "",
				TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
				TWIN_TASK_SCHEDULER_ENABLED: "true",
				TWIN_BACKGROUND_TASKS_ENABLED: "true",
				TWIN_VC_AUTHENTICATION_ENABLED: "true",
				TWIN_MESSAGING_ENABLED: "true"
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node with config and node id enabled, but no user", async () => {
		const result = await run({
			stateStorage: new MemoryStateStorage(false, {}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_PUBLIC: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
				TWIN_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
				TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
				TWIN_DATA_PROCESSING_ENABLED: "true",
				TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
				TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
				TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
				TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
				TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
				TWIN_FEATURES: "node-identity",
				TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
				TWIN_TASK_SCHEDULER_ENABLED: "true",
				TWIN_BACKGROUND_TASKS_ENABLED: "true",
				TWIN_TRUST_ENABLED: "true",
				TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
				TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
				TWIN_RIGHTS_MANAGEMENT_ENABLED: "true",
				TWIN_RIGHTS_MANAGEMENT_BASE_CALLBACK_URL: `https://localhost:${port}/rights-management`,
				TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity",
				TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "example",
				TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "example",
				TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "example",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "example",
				TWIN_RIGHTS_MANAGEMENT_DATA_ACCESS_HANDLERS: "example",
				TWIN_FEDERATED_CATALOGUE_ENABLED: "true",
				TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-example",
				TWIN_SYNCHRONISED_STORAGE_ENABLED: "true",
				TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID: "test-key",
				TWIN_DATA_SPACE_CONNECTOR_ENABLED: "true",
				TWIN_VC_AUTHENTICATION_ENABLED: "true",
				TWIN_MESSAGING_ENABLED: "true",
				TWIN_EXTENSIONS: "./tests/apps/test-app.js"
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node with config and node id enabled and multi tenant enabled, but no user", async () => {
		const result = await run({
			stateStorage: new MemoryStateStorage(false, {}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_TENANT_ENABLED: "true",
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_PUBLIC: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
				TWIN_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
				TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
				TWIN_DATA_PROCESSING_ENABLED: "true",
				TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
				TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
				TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
				TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
				TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
				TWIN_FEATURES: "node-identity",
				TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
				TWIN_TASK_SCHEDULER_ENABLED: "true",
				TWIN_BACKGROUND_TASKS_ENABLED: "true",
				TWIN_TRUST_ENABLED: "true",
				TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
				TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
				TWIN_RIGHTS_MANAGEMENT_ENABLED: "true",
				TWIN_RIGHTS_MANAGEMENT_BASE_CALLBACK_URL: `https://localhost:${port}/rights-management`,
				TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity",
				TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "example",
				TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "example",
				TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "example",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "example",
				TWIN_RIGHTS_MANAGEMENT_DATA_ACCESS_HANDLERS: "example",
				TWIN_FEDERATED_CATALOGUE_ENABLED: "true",
				TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-example",
				TWIN_SYNCHRONISED_STORAGE_ENABLED: "true",
				TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID: "test-key",
				TWIN_DATA_SPACE_CONNECTOR_ENABLED: "true",
				TWIN_VC_AUTHENTICATION_ENABLED: "true",
				TWIN_MESSAGING_ENABLED: "true",
				TWIN_EXTENSIONS: "./tests/apps/test-app.js"
			}
		});
		expect(result).toBeDefined();

		const identityDocumentEntityStorage =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityDocument>>(
				"identity-document"
			);
		const identityDocumentStore = identityDocumentEntityStorage.getStore();

		const tenantAdminEntityStorage =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<Tenant>>("tenant");
		const tenantStore = tenantAdminEntityStorage.getStore();
		expect(tenantStore).toEqual([
			{
				id: expect.any(String),
				apiKey: expect.any(String),
				label: "node-tenant",
				dateCreated: expect.any(String),
				partitionId: Converter.bytesToBase64Url(
					Converter.hexToBytes(HexHelper.stripPrefix(Did.parse(identityDocumentStore[0].id).id))
				)
			}
		]);

		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can start and bootstrap the server with minimal config in memory", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_PORT: port.toString()
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_", stateStorage: memoryStateStorage };

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait a second for the server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start and bootstrap the server in memory", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
			TWIN_BLOB_STORAGE_CONNECTOR_PUBLIC: BlobStorageConnectorType.Memory,
			TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
			TWIN_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
			TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
			TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
			TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
			TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
			TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
			TWIN_DATA_PROCESSING_ENABLED: "true",
			TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
			TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
			TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
			TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
			TWIN_FEATURES: "node-identity,node-admin-user",
			TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
			TWIN_TASK_SCHEDULER_ENABLED: "true",
			TWIN_BACKGROUND_TASKS_ENABLED: "true",
			TWIN_TRUST_ENABLED: "true",
			TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
			TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
			TWIN_RIGHTS_MANAGEMENT_ENABLED: "true",
			TWIN_RIGHTS_MANAGEMENT_BASE_CALLBACK_URL: `https://localhost:${port}/rights-management`,
			TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity",
			TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "example",
			TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "example",
			TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "example",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "example",
			TWIN_RIGHTS_MANAGEMENT_DATA_ACCESS_HANDLERS: "example",
			TWIN_FEDERATED_CATALOGUE_ENABLED: "true",
			TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-example",
			TWIN_SYNCHRONISED_STORAGE_ENABLED: "true",
			TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID: "test-key",
			TWIN_DATA_SPACE_CONNECTOR_ENABLED: "true",
			TWIN_VC_AUTHENTICATION_ENABLED: "true",
			TWIN_MESSAGING_ENABLED: "true",
			TWIN_EXTENSIONS: "./tests/apps/test-app.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage<INodeEngineState>();

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage,
			executionDirectory: process.cwd()
		};

		// Call overrideModuleImport first to match the real application flow
		overrideModuleImport(nodeOptions.executionDirectory ?? "", undefined);

		// Use buildConfiguration to get the proper nodeEngineConfig structure
		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		// Use the start function which handles the correct flow automatically
		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait a second for the server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"logging-service",
			"background-task-service",
			"task-scheduler-service",
			"event-bus-service",
			"telemetry-service",
			"messaging-admin-service",
			"messaging-service",
			"blob-storage-service",
			"verifiable-storage-service",
			"identity-service",
			"identity-resolver-service",
			"identity-profile-service",
			"nft-service",
			"immutable-proof-service",
			"attestation-service",
			"auditable-item-graph-service",
			"auditable-item-stream-service",
			"data-processing-service",
			"document-management-service",
			"trust-service",
			"policy-administration-point-service",
			"policy-management-point-service",
			"policy-execution-point-service",
			"policy-information-point-service",
			"policy-decision-point-service",
			"policy-enforcement-point-service",
			"policy-negotiation-admin-point-service",
			"policy-negotiation-point-service",
			"data-access-point-service",
			"data-access-request-point-service",
			"synchronised-storage-service",
			"federated-catalogue-service",
			"data-space-connector-service",
			"did-context-id-handler",
			"entity-storage-authentication-admin-service",
			"entity-storage-authentication-service",
			"information-service"
		]);

		expect(DataSpaceConnectorAppFactory.names()).toEqual(["https://twin.example.org/app1"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/health",
			"/spec",
			"/authentication/login",
			"/authentication/logout",
			"/authentication/refresh",
			"/authentication/:email/password",
			"/logging",
			"/logging",
			"/telemetry/metric",
			"/telemetry/metric/:id",
			"/telemetry/metric/:id",
			"/telemetry/metric/:id/value",
			"/telemetry/metric/:id",
			"/telemetry/metric",
			"/telemetry/metric/:id/value",
			"/blob",
			"/blob/:id",
			"/blob/:id/content",
			"/blob/:id",
			"/blob/:id",
			"/blob",
			"/identity",
			"/identity/:identity",
			"/identity/:identity/verification-method",
			"/identity/:identity/verification-method/:verificationMethodId",
			"/identity/:identity/service",
			"/identity/:identity/service/:serviceId",
			"/identity/:identity/verifiable-credential/:verificationMethodId",
			"/identity/verifiable-credential/verify",
			"/identity/:identity/verifiable-credential/revoke/:revocationIndex",
			"/identity/:identity/verifiable-credential/unrevoke/:revocationIndex",
			"/identity/:identity/verifiable-presentation/:verificationMethodId",
			"/identity/verifiable-presentation/verify",
			"/identity/:identity/proof/:verificationMethodId",
			"/identity/proof/verify",
			"/identity/:identity",
			"/identity/profile",
			"/identity/profile",
			"/identity/profile/:identity/public",
			"/identity/profile",
			"/identity/profile",
			"/identity/profile/query",
			"/nft",
			"/nft/:id",
			"/nft/:id",
			"/nft/:id/transfer",
			"/nft/:id",
			"/verifiable",
			"/verifiable/:id",
			"/verifiable/:id",
			"/verifiable/:id",
			"/immutable-proof",
			"/immutable-proof/:id",
			"/immutable-proof/:id/verify",
			"/attestation",
			"/attestation/:id",
			"/attestation/:id/transfer",
			"/attestation/:id",
			"/aig",
			"/aig/:id",
			"/aig/:id",
			"/aig",
			"/ais",
			"/ais/:id",
			"/ais/:id",
			"/ais/:id",
			"/ais",
			"/ais/:id",
			"/ais/:id/:entryId",
			"/ais/:id/:entryId/object",
			"/ais/:id/:entryId",
			"/ais/:id/:entryId",
			"/ais/:id/entries",
			"/ais/:id/entries/objects",
			"/data-processing/rule-group/:id",
			"/data-processing/rule-group/:id",
			"/data-processing/rule-group/:id",
			"/data-processing/extract",
			"/data-processing/convert",
			"/data-processing/rule-group",
			"/documents",
			"/documents/:auditableItemGraphDocumentId",
			"/documents/:auditableItemGraphDocumentId",
			"/documents/:auditableItemGraphDocumentId/:revision",
			"/documents/:auditableItemGraphDocumentId/:revision",
			"/documents",
			"/rights-management/policy/admin",
			"/rights-management/policy/admin/:id",
			"/rights-management/policy/admin/:id",
			"/rights-management/policy/admin/:id",
			"/rights-management/policy/admin",
			"/rights-management/negotiations/:id",
			"/rights-management/negotiations/request",
			"/rights-management/negotiations/:id/request",
			"/rights-management/negotiations/:id/events",
			"/rights-management/negotiations/:id/agreement/verification",
			"/rights-management/negotiations/:id/termination",
			"/rights-management/negotiations/offers",
			"/rights-management/negotiations/:id/offers",
			"/rights-management/negotiations/:id/agreement",
			"/rights-management/negotiations/admin/:policyId",
			"/rights-management/negotiations/admin/:policyId",
			"/rights-management/negotiations/admin/:policyId",
			"/rights-management/negotiations/admin",
			"/rights-management/data/:assetType",
			"/rights-management/data/:assetType/:id",
			"/rights-management/data/:assetType/:id",
			"/rights-management/data/:assetType/:id",
			"/rights-management/data/:assetType/query",
			"/synchronised-storage/sync-changeset",
			"/synchronised-storage/decryption-key",
			"/federated-catalogue/request",
			"/federated-catalogue/datasets/:datasetId",
			"/data-space-connector/notify",
			"/data-space-connector/activity-logs/:id",
			"/data-space-connector/entities",
			"/data-space-connector/entities/query"
		]);

		const buildSocketRoutes = startResult?.server?.getSocketRoutes() ?? [];
		expect(buildSocketRoutes.map(r => r.path)).toEqual([
			"event-bus/subscribe",
			"event-bus/unsubscribe",
			"data-space-connector/activity-logs/status"
		]);

		if (startResult?.engine) {
			const memory = await memoryStateStorage.load(startResult?.engine);

			const identityDocumentEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityDocument>>(
					"identity-document"
				);
			const identityDocumentStore = identityDocumentEntityStorage.getStore();

			expect(identityDocumentStore.length).toEqual(3);
			expect(identityDocumentStore[0].id).toEqual(memory?.nodeId);
			expect(identityDocumentStore[0].document.assertionMethod?.length).toEqual(1);
			expect(identityDocumentStore[1].id).toEqual(memory?.nodeOrganizationId);
			expect(identityDocumentStore[1].document.assertionMethod?.length).toEqual(2);
			expect(identityDocumentStore[2].id).toEqual(memory?.nodeAdminUserId);
			expect(identityDocumentStore[2].document.assertionMethod).toBeUndefined();

			const vaultSecretStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultSecret>>(
					"vault-secret"
				);
			const secretStore = vaultSecretStorage.getStore();
			expect(secretStore[0].id).toBeDefined();
			expect((secretStore[0].data as string).split(" ").length).toEqual(24);

			const vaultKeyStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultKey>>("vault-key");
			const keyStore = vaultKeyStorage.getStore();
			expect(keyStore.length).toEqual(8);

			expect(keyStore[0].id).toEqual(`${identityDocumentStore[0].id}/did`);
			expect(keyStore[1].id).toEqual(`${identityDocumentStore[1].id}/did`);
			expect(keyStore[2].id).toEqual(`${identityDocumentStore[2].id}/did`);
			expect(keyStore[3].id).toEqual(`${identityDocumentStore[0].id}/auth-signing`);
			expect(keyStore[4].id).toEqual(`${identityDocumentStore[1].id}/blob-encryption`);
			expect(keyStore[5].id).toEqual(`${identityDocumentStore[1].id}/attestation-assertion`);
			expect(keyStore[6].id).toEqual(`${identityDocumentStore[1].id}/immutable-proof-assertion`);
			expect(keyStore[7].id).toEqual(
				`${identityDocumentStore[0].id}/node-authentication-assertion`
			);

			const authenticationUserEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<AuthenticationUser>>(
					"authentication-user"
				);
			const authUserStore = authenticationUserEntityStorage.getStore();
			expect(authUserStore.length).toEqual(1);
			expect(authUserStore[0].identity).toEqual(identityDocumentStore[2].id);
			expect(authUserStore[0].organization).toEqual(identityDocumentStore[1].id);

			const identityProfileEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityProfile>>(
					"identity-profile"
				);
			const identityProfileStore = identityProfileEntityStorage.getStore();
			expect(identityProfileStore.length).toEqual(1);
			expect(identityProfileStore[0].identity).toEqual(identityDocumentStore[2].id);

			const dataSpaceConnectorService = ComponentFactory.get("data-space-connector-service");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((dataSpaceConnectorService as any)._apps[0].appId).toEqual(
				"https://twin.example.org/app1"
			);

			expect(FederatedCatalogueFilterFactory.names()).toEqual(["FilterByExample"]);

			expect(DataAccessHandlerFactory.names()).toEqual(["example-data-access-handler"]);
			expect(PolicyArbiterFactory.names()).toEqual(["example-policy-arbiter"]);
			expect(PolicyEnforcementProcessorFactory.names()).toEqual([
				"example-policy-enforcement-processor"
			]);
			expect(PolicyExecutionActionFactory.names()).toEqual(["logging-policy-execution-action"]);
			expect(PolicyInformationSourceFactory.names()).toEqual([
				"static-policy-information-source",
				"identity-policy-information-source"
			]);
			expect(PolicyNegotiatorFactory.names()).toEqual(["example-policy-negotiator"]);
			expect(PolicyRequesterFactory.names()).toEqual(["example-policy-requester"]);

			expect(TrustGeneratorFactory.names()).toEqual(["jwt-verifiable-credential-generator"]);
			expect(TrustVerifierFactory.names()).toEqual(["jwt-verifiable-credential-verifier"]);
		}

		await startResult?.shutdown();
	});

	test("Can start and bootstrap the server in memory, and restart with existing data", async () => {
		const envVars: { [key: string]: string } = {
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
			TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
			TWIN_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
			TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
			TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
			TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
			TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
			TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
			TWIN_FEATURES: "node-identity,node-admin-user",
			TWIN_TASK_SCHEDULER_ENABLED: "true",
			TWIN_BACKGROUND_TASKS_ENABLED: "true",
			TWIN_TRUST_ENABLED: "true",
			TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
			TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
			TWIN_RIGHTS_MANAGEMENT_ENABLED: "true",
			TWIN_RIGHTS_MANAGEMENT_BASE_CALLBACK_URL: `https://localhost:${port}/rights-management`,
			TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity",
			TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "example",
			TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "example",
			TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "example",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "example",
			TWIN_RIGHTS_MANAGEMENT_DATA_ACCESS_HANDLERS: "example",
			TWIN_VC_AUTHENTICATION_ENABLED: "true"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage<INodeEngineState>();

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_", stateStorage: memoryStateStorage };

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);
		expect(startResult).toBeDefined();

		await startResult?.shutdown();

		if (startResult?.engine) {
			const mem = await memoryStateStorage.load(startResult?.engine);

			const memoryStateStorage2 = new MemoryStateStorage<INodeEngineState>(false, {
				nodeId: mem?.nodeId,
				nodeTenantId: mem?.nodeTenantId,
				nodeAdminUserId: mem?.nodeAdminUserId,
				nodeOrganizationId: mem?.nodeOrganizationId
			});

			const startResult2 = await start(
				{ envPrefix: "TWIN_", stateStorage: memoryStateStorage2 },
				nodeEngineConfig,
				nodeEnvVars
			);

			await startResult2?.server.stop();

			expect(memoryStateStorage2).toEqual(memoryStateStorage);

			const memory = await memoryStateStorage.load(startResult?.engine);

			const identityDocumentEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityDocument>>(
					"identity-document"
				);
			const identityDocumentStore = identityDocumentEntityStorage.getStore();

			expect(identityDocumentStore.length).toEqual(3);
			expect(identityDocumentStore[0].id).toEqual(memory?.nodeId);
			expect(identityDocumentStore[0].document.assertionMethod?.length).toEqual(1);
			expect(identityDocumentStore[1].id).toEqual(memory?.nodeOrganizationId);
			expect(identityDocumentStore[1].document.assertionMethod?.length).toEqual(2);
			expect(identityDocumentStore[2].id).toEqual(memory?.nodeAdminUserId);
			expect(identityDocumentStore[2].document.assertionMethod).toBeUndefined();

			const vaultSecretStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultSecret>>(
					"vault-secret"
				);
			const secretStore = vaultSecretStorage.getStore();
			expect(secretStore[0].id).toBeDefined();
			expect((secretStore[0].data as string).split(" ").length).toEqual(24);

			const vaultKeyStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<VaultKey>>("vault-key");
			const keyStore = vaultKeyStorage.getStore();
			expect(keyStore.length).toEqual(8);

			expect(keyStore[0].id).toEqual(`${identityDocumentStore[0].id}/did`);
			expect(keyStore[1].id).toEqual(`${identityDocumentStore[1].id}/did`);
			expect(keyStore[2].id).toEqual(`${identityDocumentStore[2].id}/did`);
			expect(keyStore[3].id).toEqual(`${identityDocumentStore[0].id}/auth-signing`);
			expect(keyStore[4].id).toEqual(`${identityDocumentStore[1].id}/blob-encryption`);
			expect(keyStore[5].id).toEqual(`${identityDocumentStore[1].id}/attestation-assertion`);
			expect(keyStore[6].id).toEqual(`${identityDocumentStore[1].id}/immutable-proof-assertion`);
			expect(keyStore[7].id).toEqual(
				`${identityDocumentStore[0].id}/node-authentication-assertion`
			);

			const authenticationUserEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<AuthenticationUser>>(
					"authentication-user"
				);
			const authUserStore = authenticationUserEntityStorage.getStore();
			expect(authUserStore.length).toEqual(1);
			expect(authUserStore[0].identity).toEqual(identityDocumentStore[2].id);
			expect(authUserStore[0].organization).toEqual(identityDocumentStore[1].id);

			const identityProfileEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityProfile>>(
					"identity-profile"
				);
			const identityProfileStore = identityProfileEntityStorage.getStore();
			expect(identityProfileStore.length).toEqual(1);
			expect(identityProfileStore[0].identity).toEqual(identityDocumentStore[2].id);
		}
	});

	test("Can start a server and intercept custom callbacks", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_TASK_SCHEDULER_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		let extendEnvVarsCalled = false;
		let extendConfigCalled = false;
		let extendEngineCalled = false;
		let extendEngineServerCalled = false;

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			extendEnvVars: async env => {
				extendEnvVarsCalled = true;
			},
			extendConfig: async config => {
				extendConfigCalled = true;
			},
			extendEngine: async engine => {
				extendEngineCalled = true;
			},
			extendEngineServer: async server => {
				extendEngineServerCalled = true;
			},
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait a second for the server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(extendEnvVarsCalled).toBe(true);
		expect(extendConfigCalled).toBe(true);
		expect(extendEngineCalled).toBe(true);
		expect(extendEngineServerCalled).toBe(true);

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load a custom env file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_TASK_SCHEDULER_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			envFilenames: ["tests/.test-env"],
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait a second for the server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(nodeEngineConfig.debug).toBe(true);

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load a custom config file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_PORT: port.toString()
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			configFilenames: ["tests/test-config.json"],
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait a second for the server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(nodeEngineConfig.debug).toBe(true);

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load an embedded config text file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_PORT: port.toString(),
			TWIN_TEST_EMBEDDED: "@text:tests/embedded.txt"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		expect(nodeEnvVars.testEmbedded).toEqual("Hello Node!");

		await startResult?.shutdown();
	});

	test("Can start a server and load an embedded JSON file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_TEST_EMBEDDED: "@json:tests/embedded.json"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		expect(nodeEnvVars.testEmbedded).toEqual({
			foo: "bar"
		});

		await startResult?.shutdown();
	});

	test("Can start the server with an extension", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_PORT: port.toString(),
			TWIN_EXTENSIONS: "./tests/extensions/my-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_", stateStorage: memoryStateStorage };

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		// Call overrideModuleImport after buildConfiguration to match real code flow
		overrideModuleImport(process.cwd(), nodeEnvVars);

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait a second for the server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("should reject insecure HTTP protocol extensions", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_PORT: port.toString(),
			TWIN_EXTENSIONS: "http://example.com/insecure-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage
		};

		await expect(async () => {
			overrideModuleImport(process.cwd(), {
				port: port.toString(),
				storageFileRoot: "./.local-data",
				extensions: "http://example.com/insecure-extension.js"
			});
			const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
				name: "foo",
				version: "0.0.0"
			});
			await start(nodeOptions, nodeEngineConfig, nodeEnvVars);
		}).rejects.toThrow();
	});

	test("should load multiple extensions in correct order", async () => {
		// Write first extension
		await writeFile(
			"./tests/extensions/first-extension.js",
			`
				export async function extensionInitialise() {
					global.extensionCallOrder = global.extensionCallOrder || [];
					global.extensionCallOrder.push("first-init");
				}

				export async function extensionInitialiseEngine() {
					global.extensionCallOrder.push("first-engine");
				}

				export async function extensionInitialiseEngineServer() {
					global.extensionCallOrder.push("first-server");
				}

				export async function extensionShutdown() {
					global.extensionCallOrder.push("first-shutdown");
				}
				`
		);

		// Write second extension
		await writeFile(
			"./tests/extensions/second-extension.js",
			`
				export async function extensionInitialise() {
					global.extensionCallOrder = global.extensionCallOrder || [];
					global.extensionCallOrder.push("second-init");
				}

				export async function extensionInitialiseEngine() {
					global.extensionCallOrder.push("second-engine");
				}

				export async function extensionInitialiseEngineServer() {
					global.extensionCallOrder.push("second-server");
				}

				export async function extensionShutdown() {
					global.extensionCallOrder.push("second-shutdown");
				}
				`
		);

		const envVars: { [id: string]: string } = {
			TWIN_PORT: port.toString(),
			TWIN_EXTENSIONS:
				"./tests/extensions/first-extension.js,./tests/extensions/second-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage
		};

		// Clear any previous call order
		(global as typeof globalThis & { extensionCallOrder?: string[] }).extensionCallOrder = [];

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		// Verify extensions loaded
		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		await startResult?.shutdown();

		// Verify call order
		const callOrder = (global as typeof globalThis & { extensionCallOrder?: string[] })
			.extensionCallOrder;
		expect(callOrder).toEqual([
			"first-init",
			"second-init",
			"first-engine",
			"second-engine",
			"first-server",
			"second-server",
			"first-shutdown",
			"second-shutdown"
		]);

		// Cleanup
		await rm("./tests/extensions/first-extension.js", { force: true });
		await rm("./tests/extensions/second-extension.js", { force: true });
	});

	test("should execute all extension lifecycle hooks in correct sequence", async () => {
		// Write extension that tracks all lifecycle hooks
		await writeFile(
			"./tests/extensions/lifecycle-test.js",
			`
				export async function extensionInitialise(config) {
					global.lifecycleOrder = global.lifecycleOrder || [];
					global.lifecycleOrder.push("initialise");
					global.lifecycleConfig = config;
				}

				export async function extensionInitialiseEngine(engine) {
					global.lifecycleOrder.push("engine");
					global.lifecycleEngine = engine;
				}

				export async function extensionInitialiseEngineServer(server) {
					global.lifecycleOrder.push("server");
					global.lifecycleServer = server;
				}

				export async function extensionShutdown() {
					global.lifecycleOrder.push("shutdown");
				}
				`
		);

		const envVars: { [id: string]: string } = {
			TWIN_PORT: port.toString(),
			TWIN_EXTENSIONS: "./tests/extensions/lifecycle-test.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage
		};

		// Clear previous lifecycle data
		(global as typeof globalThis & { lifecycleOrder?: string[] }).lifecycleOrder = [];

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for server
		await new Promise(resolve => setTimeout(resolve, 1500));

		// Verify server is running
		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		await startResult?.shutdown();

		// Verify lifecycle order
		const order = (global as typeof globalThis & { lifecycleOrder?: string[] }).lifecycleOrder;
		expect(order).toEqual(["initialise", "engine", "server", "shutdown"]);

		// Verify each hook received appropriate parameters
		const config = (global as typeof globalThis & { lifecycleConfig?: unknown }).lifecycleConfig;
		const engine = (global as typeof globalThis & { lifecycleEngine?: unknown }).lifecycleEngine;
		const server = (global as typeof globalThis & { lifecycleServer?: unknown }).lifecycleServer;

		expect(config).toBeDefined();
		expect(engine).toBeDefined();
		expect(server).toBeDefined();

		// Cleanup
		await rm("./tests/extensions/lifecycle-test.js", { force: true });
	});

	test("should handle extension initialization failure gracefully", async () => {
		// Write extension that throws error
		await writeFile(
			"./tests/extensions/failing-extension.js",
			`
				export async function extensionInitialise() {
					throw new Error("Extension initialization failed");
				}
				`
		);

		const envVars: { [id: string]: string } = {
			TWIN_PORT: port.toString(),
			TWIN_EXTENSIONS: "./tests/extensions/failing-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage
		};

		// Extension failure should cause start to fail
		await expect(async () => {
			const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
				name: "foo",
				version: "0.0.0"
			});
			await start(nodeOptions, nodeEngineConfig, nodeEnvVars);
		}).rejects.toThrow();

		// Cleanup
		await rm("./tests/extensions/failing-extension.js", { force: true });
	});

	test("should use custom cache directory when configured", async () => {
		// Write test extension
		await writeFile(
			"./tests/extensions/cache-test.js",
			`
	export async function extensionInitialise() {
		global.cacheTestCalled = true;
	}
	`
		);

		const customCacheDir = "custom-cache";
		const envVars = {
			TWIN_PORT: port.toString(),
			TWIN_STORAGE_FILE_ROOT: "./.local-data",
			TWIN_STORAGE_ENTITY_STORAGE_CONNECTOR: "memory",
			TWIN_EXTENSIONS: "./tests/extensions/cache-test.js",
			TWIN_EXTENSIONS_CACHE_DIRECTORY: customCacheDir
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage();

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage,
			executionDirectory: process.cwd()
		};

		// Clear any previous state BEFORE loading extensions
		(globalThis as typeof globalThis & { cacheTestCalled?: boolean }).cacheTestCalled = false;

		// Call overrideModuleImport first to match the real application flow
		overrideModuleImport(nodeOptions.executionDirectory ?? "");

		// Use buildConfiguration to get the proper nodeEngineConfig structure
		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for server to start
		await new Promise(resolve => setTimeout(resolve, 1500));

		// Verify server is running
		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		// Verify extension was called
		expect((global as typeof globalThis & { cacheTestCalled?: boolean }).cacheTestCalled).toBe(
			true
		);

		await startResult?.shutdown();

		// Cleanup
		await rm("./tests/extensions/cache-test.js", { force: true });
	});

	// test("should start node with real TWIN extension from npm protocol", async () => {
	// 	const envVars: { [id: string]: string } = {
	// 		TWIN_DEBUG: "true",
	// 		TWIN_PORT: port.toString(),
	// 		// Use npm protocol to download real TWIN extension
	// 		TWIN_EXTENSIONS: "npm:@twin.org/data-space-connector-test-app@0.0.1-next.7",
	// 		TWIN_DATA_SPACE_CONNECTOR_ENABLED: "true",
	// 		TWIN_FEDERATED_CATALOGUE_ENABLED: "true",
	// 		TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
	// 		TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
	// 		TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: "memory",
	// 		TWIN_ENTITY_STORAGE_TYPES: JSON.stringify({
	// 			"activity-log-details": "memory",
	// 			"activity-task": "memory"
	// 		}),
	// 		TWIN_BACKGROUND_TASKS_ENABLED: "true",
	// 		TWIN_TASK_SCHEDULER_ENABLED: "true"
	// 	};

	// 	await initialiseLocales("./dist/locales/");

	// 	const memoryStateStorage = new MemoryStateStorage(false, {
	// 		nodeId: "alice"
	// 	});

	// 	const nodeOptions: INodeOptions = {
	// 		envPrefix: "TWIN_",
	// 		stateStorage: memoryStateStorage
	// 	};

	// 	const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
	// 		name: "twin-node-with-real-extension",
	// 		version: "1.0.0"
	// 	});

	// 	// This will trigger the npm protocol handler to download and install the extension
	// 	const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

	// 	// Verify node started successfully with extension
	// 	expect(startResult).toBeDefined();

	// 	if (!startResult) {
	// 		throw new Error("Node failed to start with npm extension");
	// 	}

	// 	// Wait for server to be fully ready
	// 	await new Promise(resolve => setTimeout(resolve, 3000));

	// 	// Verify server is running
	// 	const res = await fetch(`http://localhost:${port}/info`);
	// 	expect(res.status).toBe(200);
	// 	expect(await res.json()).toEqual({
	// 		name: "twin-node-with-real-extension",
	// 		version: "1.0.0"
	// 	});

	// 	// Verify engine is running (this means the extension loaded successfully)
	// 	expect(startResult.engine.isStarted()).toBe(true);

	// 	const testAppType = startResult.engine.getRegisteredInstanceTypeOptional("testAppComponent");

	// 	// If extension loaded correctly, this component type should be registered
	// 	expect(testAppType).toBeDefined();

	// 	// Graceful shutdown
	// 	await startResult.shutdown();
	// }, 120000); // 2 minute timeout for npm download + node startup
});
