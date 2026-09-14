// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { AutomationActionFactory } from "@twin.org/automation-models";
import { ComponentFactory, Factory } from "@twin.org/core";
import { DataspaceAppFactory } from "@twin.org/dataspace-models";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	AuthenticationAdminComponentType,
	AuthenticationComponentType
} from "@twin.org/engine-server-types";
import {
	AttestationConnectorType,
	BlobStorageConnectorType,
	EmailProtocolConnectorType,
	EntityStorageConnectorType,
	EventBusComponentType,
	EventBusConnectorType,
	FaucetConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	IdentityResolverConnectorType,
	LoggingConnectorType,
	MessagingEmailConnectorType,
	NftConnectorType,
	NotarizationConnectorType,
	TelemetryConnectorType,
	TracingConnectorType,
	VaultConnectorType,
	WalletConnectorType
} from "@twin.org/engine-types";
import { FederatedCatalogueFilterFactory } from "@twin.org/federated-catalogue-models";
import {
	PolicyArbiterFactory,
	PolicyEnforcementProcessorFactory,
	PolicyExecutionActionFactory,
	PolicyInformationSourceFactory,
	PolicyNegotiatorFactory,
	PolicyRequesterFactory
} from "@twin.org/rights-management-models";
import { TrustGeneratorFactory, TrustVerifierFactory } from "@twin.org/trust-models";
import { CI_ENV_VARS, getFreePort } from "./setupTestEnv.js";
import { getEnvDefaults } from "../src/defaults.js";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import type { INodeOptions } from "../src/models/INodeOptions.js";
import { buildConfiguration, overrideModuleImport, run } from "../src/node.js";
import { start } from "../src/start.js";
import { initialiseLocales } from "../src/utils.js";

const TEST_NODE_ID =
	"did:iota:testnet:0x8f7b71cedde408974606e404bce76980fd17a570d03ec319788fefd5eabbe9e8";
const TEST_NODE_ORG_ID =
	"did:iota:testnet:0x7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b";
const TEST_NODE_TENANT_ID = "4cfc10fd12d2a206f681ea9b01b306c0";

let port = 0;

/**
 * Wait for the web server to start accepting connections on the given port.
 * @param serverPort The port the server should be listening on.
 */
async function waitForServer(serverPort: number): Promise<void> {
	const expiry = Date.now() + 30000;
	let lastError: unknown;

	while (Date.now() < expiry) {
		try {
			await fetch(`http://localhost:${serverPort}/info`);
			return;
		} catch (err) {
			lastError = err;
			await new Promise(resolve => setTimeout(resolve, 100));
		}
	}

	throw new Error(`The server did not start on port ${serverPort}`, { cause: lastError });
}

describe("node-core", () => {
	beforeEach(async () => {
		port = await getFreePort();

		Factory.clearFactories();

		await mkdir("./tests/.tmp/index", { recursive: true });
	});

	afterEach(async () => {
		await rm("./tests/.tmp/index", { recursive: true, force: true });
	});

	test("Can fail to run the node with no config as default is for file storage and this requires a storageFileRoot", async () => {
		await expect(
			run({ disableProcessExitOnFailure: true, localesDirectory: "./dist/locales/" })
		).rejects.toThrow();
	});

	test("Can run the node with minimal config and shut it down", async () => {
		const result = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_SCHEMA_MIGRATION_ENABLED: "false",
				TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node with config", async () => {
		const result = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
				TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
				TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
				TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
				TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
				TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
				TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
				TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
				TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
				TWIN_MESSAGING_EMAIL_CONNECTOR: MessagingEmailConnectorType.EntityStorage,
				TWIN_EMAIL_PROTOCOL_CONNECTOR: `${EmailProtocolConnectorType.Imap},${EmailProtocolConnectorType.Pop3},${EmailProtocolConnectorType.Gmail},${EmailProtocolConnectorType.Outlook}`,
				TWIN_AUTOMATION_ACTION_TYPES: "fetch",
				TWIN_HEALTH_ENABLED: "true",
				TWIN_SCHEMA_MIGRATION_ENABLED: "false",
				TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node with config and node id enabled", async () => {
		const result = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
				TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
				TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
				TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
				TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
				TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
				TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
				TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
				TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
				TWIN_TASK_SCHEDULER_ENABLED: "true",
				TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
				TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
				TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH: "/rights-management",
				TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity,identity-profile",
				TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "pass-through",
				TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "pass-through",
				TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "pass-through",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "pass-through",
				TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-metadata",
				TWIN_DATASPACE_ENABLED: "true",
				TWIN_AUTOMATION_ACTION_TYPES: "fetch",
				TWIN_HEALTH_ENABLED: "true",
				TWIN_SCHEMA_MIGRATION_ENABLED: "false",
				TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node with config and node id enabled and multi tenant enabled", async () => {
		const result = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID
			}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_TENANT_ENABLED: "true",
				TWIN_TENANT_ID: TEST_NODE_TENANT_ID,
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
				TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
				TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
				TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
				TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
				TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
				TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
				TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
				TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
				TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
				TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
				TWIN_TASK_SCHEDULER_ENABLED: "true",
				TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
				TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
				TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH: "/rights-management",
				TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity,identity-profile",
				TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "pass-through",
				TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "pass-through",
				TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "pass-through",
				TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "pass-through",
				TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-metadata",
				TWIN_DATASPACE_ENABLED: "true",
				TWIN_AUTOMATION_ACTION_TYPES: "fetch",
				TWIN_HEALTH_ENABLED: "true",
				TWIN_SCHEMA_MIGRATION_ENABLED: "false",
				TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		await result?.shutdown();
	});

	test("Can run the node as a standalone federated catalogue", async () => {
		const result = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			}),
			envVars: {
				TWIN_DEBUG: "true",
				TWIN_SILENT: "true",
				TWIN_PORT: port.toString(),
				TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
				TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
				TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
				TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
				TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
				TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
				TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
				TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
				TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
				TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
				TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
				TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
				TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
				TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
				TWIN_TRUST_VERIFICATION_METHOD_ID: "trust-assertion",
				TWIN_FEDERATED_CATALOGUE_ENABLED: "true",
				TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-metadata",
				TWIN_FEDERATED_CATALOGUE_MUTEX_TIMEOUT: "30000",
				TWIN_SCHEMA_MIGRATION_ENABLED: "false",
				TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
			}
		});
		expect(result).toBeDefined();
		expect(result?.shutdown).toBeInstanceOf(Function);
		expect(result?.engine).toBeDefined();

		const names = ComponentFactory.names();
		expect(names).toContain("federated-catalogue-service");
		expect(names).not.toContain("dataspace-control-plane-service");
		expect(names).not.toContain("policy-negotiation-point-service");
		expect(FederatedCatalogueFilterFactory.names()).toContain("FilterByMetadata");

		await result?.shutdown();
	});

	test("Can start and bootstrap the server with minimal config in memory", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
		});

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_", stateStorage: memoryStateStorage };

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for the server to start
		await waitForServer(port);

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"schema-version-service",
			"platform-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/readyz",
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
			TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
			TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
			TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
			TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
			TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
			TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
			TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
			TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
			TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
			TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
			TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
			TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
			TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
			TWIN_TASK_SCHEDULER_ENABLED: "true",
			TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
			TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
			TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH: "/rights-management",
			TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity,identity-profile",
			TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "pass-through",
			TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "pass-through",
			TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "pass-through",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "pass-through",
			TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-metadata",
			TWIN_DATASPACE_ENABLED: "true",
			TWIN_MESSAGING_EMAIL_CONNECTOR: MessagingEmailConnectorType.EntityStorage,
			TWIN_EMAIL_PROTOCOL_CONNECTOR: `${EmailProtocolConnectorType.Imap},${EmailProtocolConnectorType.Pop3},${EmailProtocolConnectorType.Gmail},${EmailProtocolConnectorType.Outlook}`,
			TWIN_AUTOMATION_ACTION_TYPES: "fetch",
			TWIN_HEALTH_ENABLED: "true",
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS: "./tests/fixtures/testApp.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage<INodeEngineState>(false, {
			nodeId: TEST_NODE_ID,
			nodeOrganizationId: TEST_NODE_ORG_ID
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: memoryStateStorage,
			executionDirectory: process.cwd()
		};

		// Call overrideModuleImport first to match the real application flow
		overrideModuleImport(nodeOptions.executionDirectory ?? "", undefined);

		// Use buildConfiguration to get the proper nodeEngineConfig structure
		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(
			{
				...getEnvDefaults("TWIN_"),
				...envVars
			},
			nodeOptions,
			{
				name: "foo",
				version: "0.0.0"
			}
		);

		// Use the start function which handles the correct flow automatically
		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for the server to start
		await waitForServer(port);

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"schema-version-service",
			"platform-service",
			"logging-service",
			"background-task-service",
			"task-scheduler-service",
			"event-bus-service",
			"telemetry-service",
			"tracing-service",
			"metrics-collector-service",
			"automation-service",
			"messaging-admin-service",
			"messaging-service",
			"mail-storage-service",
			"mailbox-service",
			"blob-storage-service",
			"identity-service",
			"identity-resolver-service",
			"identity-profile-service",
			"nft-service",
			"notarization-service",
			"immutable-proof-service",
			"attestation-service",
			"auditable-item-graph-service",
			"auditable-item-stream-service",
			"data-processing-service",
			"health-service",
			"document-management-service",
			"trust-service",
			"policy-administration-point-service",
			"policy-management-point-service",
			"policy-execution-point-service",
			"policy-information-point-service",
			"policy-decision-point-service",
			"policy-enforcement-point-service",
			"policy-negotiation-admin-point-service",
			"policy-negotiation-point-rest-client",
			"policy-negotiation-point-service",
			"federated-catalogue-service",
			"dataspace-data-plane-service",
			"dataspace-control-plane-rest-client",
			"dataspace-control-plane-service",
			"did-context-id-handler",
			"entity-storage-authentication-audit-service",
			"entity-storage-authentication-rate-service",
			"entity-storage-authentication-admin-service",
			"entity-storage-authentication-service",
			"information-service"
		]);

		expect(DataspaceAppFactory.names()).toEqual(["https://twin.example.org/app1"]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => `${r.method.padEnd(8, " ")} ${r.path}`)).toEqual([
			"GET      /",
			"GET      /favicon.ico",
			"GET      /info",
			"GET      /livez",
			"GET      /readyz",
			"GET      /spec",
			"GET      /health",
			"POST     /authentication/login",
			"POST     /authentication/logout",
			"POST     /authentication/refresh",
			"PUT      /authentication/password",
			"POST     /authentication/admin/users",
			"PUT      /authentication/admin/users/:email",
			"PUT      /authentication/admin/users/:email/password",
			"GET      /authentication/admin/users/:email",
			"GET      /authentication/admin/users/identity/:identity",
			"DELETE   /authentication/admin/users/:email",
			"POST     /authentication/audit",
			"GET      /authentication/audit/:id",
			"PUT      /authentication/audit/:id",
			"DELETE   /authentication/audit/:id",
			"GET      /authentication/audit",
			"POST     /logging",
			"GET      /logging",
			"POST     /telemetry/metric",
			"GET      /telemetry/metric/:id",
			"PUT      /telemetry/metric/:id",
			"POST     /telemetry/metric/:id/value",
			"DELETE   /telemetry/metric/:id",
			"GET      /telemetry/metric",
			"GET      /telemetry/metric/:id/value/:valueId",
			"GET      /telemetry/metric/:id/value",
			"POST     /tracing",
			"PUT      /tracing/:spanId",
			"GET      /tracing",
			"GET      /tracing/trace/:traceId",
			"POST     /automation/trigger/:trigger",
			"POST     /automation",
			"DELETE   /automation/:actionId",
			"GET      /automation/:actionId",
			"GET      /automation",
			"POST     /blob",
			"GET      /blob/:id",
			"GET      /blob/:id/content",
			"PUT      /blob/:id",
			"DELETE   /blob/:id",
			"DELETE   /blob",
			"GET      /blob",
			"POST     /identity",
			"DELETE   /identity/:identity",
			"POST     /identity/:identity/verification-method",
			"DELETE   /identity/:identity/verification-method/:verificationMethodId",
			"POST     /identity/:identity/service",
			"DELETE   /identity/:identity/service/:serviceId",
			"POST     /identity/:identity/alias",
			"DELETE   /identity/:identity/alias/:alias",
			"POST     /identity/:identity/verifiable-credential/:verificationMethodId",
			"POST     /identity/verifiable-credential/verify/document",
			"GET      /identity/verifiable-credential/verify",
			"GET      /identity/:identity/verifiable-credential/revoke/:revocationIndex",
			"GET      /identity/:identity/verifiable-credential/unrevoke/:revocationIndex",
			"POST     /identity/:identity/verifiable-presentation/:verificationMethodId",
			"POST     /identity/verifiable-presentation/verify/document",
			"GET      /identity/verifiable-presentation/verify",
			"POST     /identity/:identity/proof/:verificationMethodId",
			"POST     /identity/proof/verify",
			"GET      /identity/:identity",
			"POST     /identity/profile",
			"GET      /identity/profile",
			"GET      /identity/profile/:userIdentity",
			"GET      /identity/profile/:identity/public",
			"PUT      /identity/profile",
			"PUT      /identity/profile/:userIdentity",
			"DELETE   /identity/profile",
			"DELETE   /identity/profile/:userIdentity",
			"GET      /identity/profile/query",
			"GET      /identity/profile/admin/query",
			"POST     /nft",
			"GET      /nft/:id",
			"DELETE   /nft/:id",
			"POST     /nft/:id/transfer",
			"PUT      /nft/:id",
			"POST     /notarization",
			"GET      /notarization/:id",
			"DELETE   /notarization/:id",
			"PUT      /notarization/:id",
			"POST     /notarization/:id/transfer",
			"POST     /immutable-proof",
			"GET      /immutable-proof/:id",
			"GET      /immutable-proof/:id/verify",
			"DELETE   /immutable-proof/:id",
			"DELETE   /immutable-proof/:id/notarization",
			"POST     /attestation",
			"GET      /attestation/:id",
			"PUT      /attestation/:id/transfer",
			"DELETE   /attestation/:id",
			"POST     /aig",
			"GET      /aig/:id",
			"GET      /aig/:id/versions/:version",
			"GET      /aig/:id/versions",
			"GET      /aig/:id/changesets/:changesetId",
			"GET      /aig/:id/changesets",
			"PUT      /aig/:id",
			"PATCH    /aig/:id",
			"GET      /aig",
			"DELETE   /aig/:id/proof",
			"POST     /ais",
			"GET      /ais/:id",
			"PUT      /ais/:id",
			"DELETE   /ais/:id",
			"PUT      /ais/:id/close",
			"GET      /ais",
			"POST     /ais/:id/entries",
			"GET      /ais/:id/entries/:entryId",
			"GET      /ais/:id/entries/:entryId/object",
			"DELETE   /ais/:id/entries/:entryId",
			"PUT      /ais/:id/entries/:entryId",
			"GET      /ais/:id/entries",
			"GET      /ais/entries",
			"GET      /ais/:id/entries/objects",
			"GET      /ais/entries/objects",
			"DELETE   /ais/:id/proof",
			"PUT      /data-processing/rule-group/:id",
			"GET      /data-processing/rule-group/:id",
			"DELETE   /data-processing/rule-group/:id",
			"POST     /data-processing/extract",
			"POST     /data-processing/convert",
			"GET      /data-processing/rule-group",
			"POST     /documents",
			"PATCH    /documents/:auditableItemGraphDocumentId",
			"GET      /documents/:auditableItemGraphDocumentId",
			"GET      /documents/:auditableItemGraphDocumentId/:revision",
			"DELETE   /documents/:auditableItemGraphDocumentId/:revision",
			"GET      /documents",
			"GET      /mailbox/mail",
			"GET      /mailbox/mail/:id",
			"DELETE   /mailbox/mail/:id",
			"GET      /mailbox/connectors/:connectorType/schema",
			"GET      /mailbox/authcallback",
			"POST     /mailbox",
			"GET      /mailbox",
			"GET      /mailbox/:id",
			"PUT      /mailbox/:id",
			"DELETE   /mailbox/:id",
			"POST     /rights-management/policy/admin",
			"PUT      /rights-management/policy/admin/:id",
			"GET      /rights-management/policy/admin/:id",
			"GET      /rights-management/policy/admin/agreement/:id",
			"GET      /rights-management/policy/admin/offer/:id",
			"GET      /rights-management/policy/admin/set/:id",
			"DELETE   /rights-management/policy/admin/:id",
			"GET      /rights-management/policy/admin",
			"GET      /rights-management/negotiations/:id",
			"POST     /rights-management/negotiations/request",
			"POST     /rights-management/negotiations/:id/request",
			"POST     /rights-management/negotiations/:id/events",
			"POST     /rights-management/negotiations/:id/agreement/verification",
			"POST     /rights-management/negotiations/:id/termination",
			"POST     /rights-management/negotiations/offers",
			"POST     /rights-management/negotiations/:id/offers",
			"POST     /rights-management/negotiations/:id/agreement",
			"POST     /rights-management/negotiations/admin",
			"GET      /rights-management/negotiations/admin/:policyId",
			"PUT      /rights-management/negotiations/admin/:policyId",
			"DELETE   /rights-management/negotiations/admin/:policyId",
			"GET      /rights-management/negotiations/admin",
			"POST     /catalog/request",
			"GET      /catalog/datasets/:datasetId",
			"POST     /catalog/datasets",
			"DELETE   /catalog/datasets/:datasetId",
			"GET      /.well-known/dspace-version",
			"POST     /dataspace/transfers/request",
			"GET      /dataspace/transfers/:pid",
			"POST     /dataspace/transfers/:pid/start",
			"POST     /dataspace/transfers/:pid/complete",
			"POST     /dataspace/transfers/:pid/suspend",
			"POST     /dataspace/transfers/:pid/terminate",
			"POST     /dataspace/app-datasets",
			"GET      /dataspace/app-datasets",
			"GET      /dataspace/app-datasets/:id",
			"PUT      /dataspace/app-datasets/:id",
			"DELETE   /dataspace/app-datasets/:id",
			"POST     /dataspace/inbox",
			"GET      /dataspace/activity-logs/:id",
			"GET      /dataspace/entities",
			"POST     /dataspace/entities/query"
		]);

		const buildSocketRoutes = startResult?.server?.getSocketRoutes() ?? [];
		expect(buildSocketRoutes.map(r => r.path)).toEqual([
			"event-bus/subscribe",
			"event-bus/unsubscribe",
			"dataspace/activity-logs/status"
		]);

		if (startResult?.engine) {
			expect(DataspaceAppFactory.names()).toEqual(["https://twin.example.org/app1"]);

			expect(FederatedCatalogueFilterFactory.names()).toEqual(["FilterByMetadata"]);

			expect(PolicyArbiterFactory.names()).toEqual(["pass-through-policy-arbiter"]);
			expect(PolicyEnforcementProcessorFactory.names()).toEqual([
				"pass-through-policy-enforcement-processor"
			]);
			expect(PolicyExecutionActionFactory.names()).toEqual(["logging-policy-execution-action"]);
			expect(PolicyInformationSourceFactory.names()).toEqual([
				"static-policy-information-source",
				"identity-policy-information-source",
				"identity-profile-policy-information-source"
			]);
			expect(PolicyNegotiatorFactory.names()).toEqual(["pass-through-policy-negotiator"]);
			expect(PolicyRequesterFactory.names()).toEqual([
				"pass-through-policy-requester",
				"dataspace-control-plane-requester"
			]);

			expect(TrustGeneratorFactory.names()).toEqual(["jwt-verifiable-credential-generator"]);
			expect(TrustVerifierFactory.names()).toEqual(["jwt-verifiable-credential-verifier"]);

			expect(AutomationActionFactory.names()).toEqual(["fetch-action"]);
		}

		await startResult?.shutdown();
	});

	test("Can start and bootstrap the server in memory, and restart with existing data", async () => {
		const envVars: { [key: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
			TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
			TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
			TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
			TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
			TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
			TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
			TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
			TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_BLOB_STORAGE_ENABLE_ENCRYPTION: "true",
			TWIN_TASK_SCHEDULER_ENABLED: "true",
			TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
			TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
			TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH: "/rights-management",
			TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity,identity-profile",
			TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "pass-through",
			TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "pass-through",
			TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "pass-through",
			TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "pass-through",
			TWIN_AUTOMATION_ACTION_TYPES: "fetch",
			TWIN_HEALTH_ENABLED: "true",
			TWIN_SCHEMA_MIGRATION_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage<INodeEngineState>(false, {
			nodeId: TEST_NODE_ID,
			nodeOrganizationId: TEST_NODE_ORG_ID
		});

		const nodeOptions: INodeOptions = { envPrefix: "TWIN_", stateStorage: memoryStateStorage };

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(
			{
				...getEnvDefaults("TWIN_"),
				...envVars
			},
			nodeOptions,
			{
				name: "foo",
				version: "0.0.0"
			}
		);

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);
		expect(startResult).toBeDefined();

		await startResult?.shutdown();

		if (startResult?.engine) {
			const mem = await memoryStateStorage.load(startResult?.engine);

			const memoryStateStorage2 = new MemoryStateStorage<INodeEngineState>(false, {
				nodeId: mem?.nodeId,
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

			expect(memory).toEqual({
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			});
		}
	});

	test("Can start a server and intercept custom callbacks", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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

		// Wait for the server to start
		await waitForServer(port);

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
			"schema-version-service",
			"platform-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/readyz",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load a custom env file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			envFilenames: ["tests/fixtures/.test-env"],
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for the server to start
		await waitForServer(port);

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(nodeEngineConfig.debug).toBe(true);

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"schema-version-service",
			"platform-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/readyz",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load a custom config file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
		});

		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			configFilenames: ["tests/testConfig.json"],
			stateStorage: memoryStateStorage
		};

		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "foo",
			version: "0.0.0"
		});

		const startResult = await start(nodeOptions, nodeEngineConfig, nodeEnvVars);

		expect(startResult).toBeDefined();

		// Wait for the server to start
		await waitForServer(port);

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(nodeEngineConfig.debug).toBe(true);

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"schema-version-service",
			"platform-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/readyz",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("Can start a server and load an embedded config text file", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_TEST_EMBEDDED: "@text:tests/fixtures/embedded.txt",
			TWIN_ENV_ALLOW_LIST: [CI_ENV_VARS, "TWIN_TEST_EMBEDDED"].filter(Boolean).join(",")
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_TEST_EMBEDDED: "@json:tests/fixtures/embedded.json",
			TWIN_ENV_ALLOW_LIST: [CI_ENV_VARS, "TWIN_TEST_EMBEDDED"].filter(Boolean).join(",")
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS: "./tests/fixtures//myExtension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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

		// Wait for the server to start
		await waitForServer(port);

		const res = await fetch(`http://localhost:${port}/info`);
		expect(await res.json()).toEqual({
			name: "foo",
			version: "0.0.0"
		});

		expect(ComponentFactory.names()).toEqual([
			"engine-logging-service",
			"schema-version-service",
			"platform-service",
			"did-context-id-handler",
			"information-service"
		]);

		const buildRestRoutes = startResult?.server?.getRestRoutes() ?? [];
		expect(buildRestRoutes.map(r => r.path)).toEqual([
			"/",
			"/favicon.ico",
			"/info",
			"/livez",
			"/readyz",
			"/spec"
		]);

		await startResult?.shutdown();
	});

	test("should reject insecure HTTP protocol extensions", async () => {
		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS: "http://example.com/insecure-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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
			"./tests/.tmp/index/first-extension.js",
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
			"./tests/.tmp/index/second-extension.js",
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
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS:
				"./tests/.tmp/index/first-extension.js,./tests/.tmp/index/second-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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

		// Wait for the server to start
		await waitForServer(port);

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
		await rm("./tests/.tmp/index/first-extension.js", { force: true });
		await rm("./tests/.tmp/index/second-extension.js", { force: true });
	});

	test("should execute all extension lifecycle hooks in correct sequence", async () => {
		// Write extension that tracks all lifecycle hooks
		await writeFile(
			"./tests/.tmp/index/lifecycle-test.js",
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
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS: "./tests/.tmp/index/lifecycle-test.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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

		// Wait for the server to start
		await waitForServer(port);

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
		await rm("./tests/.tmp/index/lifecycle-test.js", { force: true });
	});

	test("should handle extension initialization failure gracefully", async () => {
		// Write extension that throws error
		await writeFile(
			"./tests/.tmp/index/failing-extension.js",
			`
				export async function extensionInitialise() {
					throw new Error("Extension initialization failed");
				}
				`
		);

		const envVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS: "./tests/.tmp/index/failing-extension.js"
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: "bob",
			nodeOrganizationId: TEST_NODE_ORG_ID
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
	});

	test("should use custom cache directory when configured", async () => {
		// Write test extension
		await writeFile(
			"./tests/.tmp/index/cache-test.js",
			`
	export async function extensionInitialise() {
		global.cacheTestCalled = true;
	}
	`
		);

		const customCacheDir = "./tests/.tmp/index/custom-cache";
		const envVars = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: port.toString(),
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_EXTENSIONS: "./tests/.tmp/index/cache-test.js",
			TWIN_EXTENSIONS_CACHE_DIRECTORY: customCacheDir
		};

		await initialiseLocales("./dist/locales/");

		const memoryStateStorage = new MemoryStateStorage(false, {
			nodeId: TEST_NODE_ID,
			nodeOrganizationId: TEST_NODE_ORG_ID
		});

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

		// Wait for the server to start
		await waitForServer(port);

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
	});
});
