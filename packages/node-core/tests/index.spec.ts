// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { AuthenticationUser } from "@twin.org/api-auth-entity-storage-service";
import { ComponentFactory, Factory } from "@twin.org/core";
import { DataSpaceConnectorAppFactory } from "@twin.org/data-space-connector-models";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	AuthenticationAdminComponentType,
	AuthenticationComponentType
} from "@twin.org/engine-server-types";
import {
	AttestationConnectorType,
	BackgroundTaskConnectorType,
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
import type {
	IdentityDocument,
	IdentityProfile
} from "@twin.org/identity-connector-entity-storage";
import type { IMessagingAdminComponent } from "@twin.org/messaging-models";
import type { VaultKey, VaultSecret } from "@twin.org/vault-connector-entity-storage";
import type { INodeOptions } from "../src/models/INodeOptions";
import { buildConfiguration, overrideModuleImport } from "../src/node";
import { start } from "../src/server";
import { initialiseLocales } from "../src/utils";

const basePort = Math.floor(Math.random() * 1000);
let port = 3000 + basePort;

describe("node-core", () => {
	beforeEach(() => {
		port++;

		Factory.clearFactories();
	});

	test("Can start and bootstrap the server with minimal config in memory", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_NODE_DEBUG: "true",
			TWIN_NODE_PORT: port.toString()
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_NODE_", stateStorage: memoryStateStorage };

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

		expect(ComponentFactory.names()).toEqual(["engine-logging-service", "information-service"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start and bootstrap the server in memory", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_NODE_DEBUG: "true",
			TWIN_NODE_SILENT: "true",
			TWIN_NODE_PORT: port.toString(),
			TWIN_NODE_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_NODE_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
			TWIN_NODE_BLOB_STORAGE_CONNECTOR_PUBLIC: BlobStorageConnectorType.Memory,
			TWIN_NODE_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_NODE_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_NODE_BACKGROUND_TASK_CONNECTOR: BackgroundTaskConnectorType.EntityStorage,
			TWIN_NODE_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_NODE_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_NODE_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_NODE_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_NODE_NFT_CONNECTOR: NftConnectorType.EntityStorage,
			TWIN_NODE_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
			TWIN_NODE_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
			TWIN_NODE_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
			TWIN_NODE_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
			TWIN_NODE_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
			TWIN_NODE_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
			TWIN_NODE_DATA_PROCESSING_ENABLED: "true",
			TWIN_NODE_DATA_CONVERTER_CONNECTORS: "json,xml",
			TWIN_NODE_DATA_EXTRACTOR_CONNECTORS: "json-path",
			TWIN_NODE_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
			TWIN_NODE_AUDITABLE_ITEM_STREAM_ENABLED: "true",
			TWIN_NODE_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_NODE_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_NODE_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
			TWIN_NODE_FEATURES: "node-identity,node-user",
			TWIN_NODE_DOCUMENT_MANAGEMENT_ENABLED: "true",
			TWIN_NODE_TASK_SCHEDULER_ENABLED: "true",
			TWIN_NODE_RIGHTS_MANAGEMENT_ENABLED: "true",
			TWIN_NODE_RIGHTS_MANAGEMENT_BASE_CALLBACK_URL: `https://localhost:${port}/rights-management`,
			TWIN_NODE_RIGHTS_MANAGEMENT_INFORMATION_SOURCES:
				"@json:tests/rights-management-information-sources.json",
			TWIN_NODE_RIGHTS_MANAGEMENT_EXECUTION_ACTIONS:
				"@json:tests/rights-management-execution-actions.json",
			TWIN_NODE_FEDERATED_CATALOGUE_ENABLED: "true",
			TWIN_NODE_SYNCHRONISED_STORAGE_ENABLED: "true",
			TWIN_NODE_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID: "test-key",
			TWIN_NODE_DATA_SPACE_CONNECTOR_ENABLED: "true",
			TWIN_NODE_VC_AUTHENTICATION_ENABLED: "true",
			TWIN_NODE_MESSAGING_ENABLED: "true",
			TWIN_NODE_MESSAGING_TEMPLATES: "@json:tests/templates.json",
			TWIN_NODE_EXTENSIONS: "./tests/apps/test-app.mjs"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage();

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_NODE_", stateStorage: memoryStateStorage };

		overrideModuleImport(process.cwd());

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
			"logging-service",
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
			"/identity/:identity/verifiable-credential",
			"/identity/verifiable-credential/verify",
			"/identity/:identity/verifiable-credential/revoke/:revocationIndex",
			"/identity/:identity/verifiable-credential/unrevoke/:revocationIndex",
			"/identity/:identity/verifiable-presentation",
			"/identity/verifiable-presentation/verify",
			"/identity/:identity/proof",
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
			"/federated-catalogue/participant-credentials",
			"/federated-catalogue/service-offering-credentials",
			"/federated-catalogue/data-resource-credentials",
			"/federated-catalogue/data-space-connector-credentials",
			"/federated-catalogue/participants",
			"/federated-catalogue/participants/:id",
			"/federated-catalogue/service-offerings",
			"/federated-catalogue/service-offerings/:id",
			"/federated-catalogue/data-resources",
			"/federated-catalogue/data-resources/:id",
			"/federated-catalogue/data-space-connectors",
			"/federated-catalogue/data-space-connectors/:id",
			"/data-space-connector/notify",
			"/data-space-connector/activity-logs/:id"
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

			expect(identityDocumentStore.length).toEqual(1);
			expect(identityDocumentStore[0].id).toEqual(memory?.nodeIdentity);
			expect(identityDocumentStore[0].document.assertionMethod?.length).toEqual(3);

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
			expect(keyStore.length).toEqual(6);

			expect(keyStore[0].id).toEqual(`${identityDocumentStore[0].id}/did`);
			expect(keyStore[1].id).toEqual(`${identityDocumentStore[0].id}/auth-signing`);
			expect(keyStore[2].id).toEqual(`${identityDocumentStore[0].id}/blob-encryption`);
			expect(keyStore[3].id).toEqual(`${identityDocumentStore[0].id}/attestation-assertion`);
			expect(keyStore[4].id).toEqual(`${identityDocumentStore[0].id}/immutable-proof-assertion`);
			expect(keyStore[5].id).toEqual(
				`${identityDocumentStore[0].id}/node-authentication-assertion`
			);

			const authenticationUserEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<AuthenticationUser>>(
					"authentication-user"
				);
			const authUserStore = authenticationUserEntityStorage.getStore();
			expect(authUserStore.length).toEqual(1);
			expect(authUserStore[0].identity).toEqual(identityDocumentStore[0].id);

			const identityProfileEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityProfile>>(
					"identity-profile"
				);
			const identityProfileStore = identityProfileEntityStorage.getStore();
			expect(authUserStore.length).toEqual(1);
			expect(identityProfileStore[0].identity).toEqual(identityDocumentStore[0].id);

			const dataSpaceConnectorService = ComponentFactory.get("data-space-connector-service");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((dataSpaceConnectorService as any)._apps[0].appId).toEqual(
				"https://twin.example.org/app1"
			);

			const pip = ComponentFactory.get("policy-information-point-service");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((pip as any)._sources.length).toEqual(2);

			const pxp = ComponentFactory.get("policy-execution-point-service");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((pxp as any)._executionActions.before.length).toEqual(1);

			const messagingAdminService =
				ComponentFactory.get<IMessagingAdminComponent>("messaging-admin-service");
			expect(await messagingAdminService.getTemplate("my-template", "en")).toBeDefined();
			expect(await messagingAdminService.getTemplate("my-template", "de")).toBeDefined();
		}

		await startResult?.shutdown();
	});

	test("Can start and bootstrap the server in memory, and restart with existing data", async () => {
		const envVars: { [key: string]: string } = {
			TWIN_NODE_PORT: port.toString(),
			TWIN_NODE_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_NODE_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
			TWIN_NODE_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_NODE_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_NODE_BACKGROUND_TASK_CONNECTOR: BackgroundTaskConnectorType.EntityStorage,
			TWIN_NODE_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_NODE_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_NODE_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_NODE_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_NODE_NFT_CONNECTOR: NftConnectorType.EntityStorage,
			TWIN_NODE_VERIFIABLE_STORAGE_CONNECTOR: VerifiableStorageConnectorType.EntityStorage,
			TWIN_NODE_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
			TWIN_NODE_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
			TWIN_NODE_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
			TWIN_NODE_DATA_CONVERTER_CONNECTORS: "json,xml",
			TWIN_NODE_DATA_EXTRACTOR_CONNECTORS: "json-path",
			TWIN_NODE_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_NODE_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_NODE_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
			TWIN_NODE_FEATURES: "node-identity,node-user",
			TWIN_NODE_TASK_SCHEDULER_ENABLED: "true",
			TWIN_NODE_RIGHTS_MANAGEMENT_ENABLED: "true",
			TWIN_NODE_RIGHTS_MANAGEMENT_BASE_CALLBACK_URL: `https://localhost:${port}/rights-management`,
			TWIN_NODE_VC_AUTHENTICATION_ENABLED: "true"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage();

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_NODE_", stateStorage: memoryStateStorage };

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);
		expect(startResult).toBeDefined();

		await startResult?.shutdown();

		if (startResult?.engine) {
			const mem = await memoryStateStorage.load(startResult?.engine);

			const memoryStateStorage2 = new MemoryStateStorage(false, {
				nodeIdentity: mem?.nodeIdentity
			});

			const startResult2 = await start(
				{ envPrefix: "TWIN_NODE_", stateStorage: memoryStateStorage2 },
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

			expect(identityDocumentStore.length).toEqual(1);
			expect(identityDocumentStore[0].id).toEqual(memory?.nodeIdentity);
			expect(identityDocumentStore[0].document.assertionMethod?.length).toEqual(3);

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
			expect(keyStore.length).toEqual(6);

			expect(keyStore[0].id).toEqual(`${identityDocumentStore[0].id}/did`);
			expect(keyStore[1].id).toEqual(`${identityDocumentStore[0].id}/auth-signing`);
			expect(keyStore[2].id).toEqual(`${identityDocumentStore[0].id}/blob-encryption`);
			expect(keyStore[3].id).toEqual(`${identityDocumentStore[0].id}/attestation-assertion`);
			expect(keyStore[4].id).toEqual(`${identityDocumentStore[0].id}/immutable-proof-assertion`);
			expect(keyStore[5].id).toEqual(
				`${identityDocumentStore[0].id}/node-authentication-assertion`
			);

			const authenticationUserEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<AuthenticationUser>>(
					"authentication-user"
				);
			const authUserStore = authenticationUserEntityStorage.getStore();
			expect(authUserStore.length).toEqual(1);
			expect(authUserStore[0].identity).toEqual(identityDocumentStore[0].id);

			const identityProfileEntityStorage =
				EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<IdentityProfile>>(
					"identity-profile"
				);
			const identityProfileStore = identityProfileEntityStorage.getStore();
			expect(authUserStore.length).toEqual(1);
			expect(identityProfileStore[0].identity).toEqual(identityDocumentStore[0].id);
		}
	});

	test("Can start a server and intercept custom callbacks", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_NODE_DEBUG: "true",
			TWIN_NODE_PORT: port.toString(),
			TWIN_NODE_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_NODE_TASK_SCHEDULER_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		let extendEnvVarsCalled = false;
		let extendConfigCalled = false;
		let extendEngineCalled = false;
		let extendEngineServerCalled = false;

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_NODE_",
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

		expect(ComponentFactory.names()).toEqual(["engine-logging-service", "information-service"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load a custom env file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_NODE_DEBUG: "true",
			TWIN_NODE_PORT: port.toString(),
			TWIN_NODE_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_NODE_TASK_SCHEDULER_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_NODE_",
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

		expect(ComponentFactory.names()).toEqual(["engine-logging-service", "information-service"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load a custom config file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_NODE_DEBUG: "true",
			TWIN_NODE_PORT: port.toString()
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_NODE_",
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

		expect(ComponentFactory.names()).toEqual(["engine-logging-service", "information-service"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load an embedded config text file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_NODE_PORT: port.toString(),
			TWIN_NODE_TEST_EMBEDDED: "@text:tests/embedded.txt"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_NODE_",
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
			TWIN_NODE_TEST_EMBEDDED: "@json:tests/embedded.json"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_NODE_",
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
			TWIN_NODE_DEBUG: "true",
			TWIN_NODE_PORT: port.toString(),
			TWIN_NODE_EXTENSIONS: "./tests/extensions/my-extension.mjs"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeIdentity: "bob"
		});

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_NODE_", stateStorage: memoryStateStorage };

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

		expect(ComponentFactory.names()).toEqual(["engine-logging-service", "information-service"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/health",
			"/spec"
		]);

		await startResult?.shutdown();
	});
});
