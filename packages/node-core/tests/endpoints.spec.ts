// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { rm } from "node:fs/promises";
import path from "node:path";
import type { ITenantAdminComponent } from "@3sixty/api-models";
import { ContextIdKeys, ContextIdStore } from "@3sixty/context";
import { ComponentFactory, DurationConstants, Factory, Is } from "@3sixty/core";
import { DataspaceAppFactory } from "@3sixty/dataspace-models";
import { MemoryStateStorage } from "@3sixty/engine-core";
import {
	AuthenticationAdminComponentType,
	AuthenticationComponentType
} from "@3sixty/engine-server-types";
import {
	AttestationConnectorType,
	AuthorizationConnectorType,
	BlobStorageConnectorType,
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
} from "@3sixty/engine-types";
import {
	EntityStorageConnectorFactory,
	type IEntityStorageConnector
} from "@3sixty/entity-storage-models";
import type { ITrustComponent } from "@3sixty/trust-models";
import {
	findUnprobedRoutes,
	loadAndRunGroups,
	runGroup,
	type IProbedStep,
	type IRunnerContext
} from "./endpoints/runner.js";
import { CI_ENV_VARS, getFreePort } from "./setupTestEnv.js";
import {
	DEFAULT_DEVOPS_ROLE,
	DEFAULT_ESCALATED_PRIVILEGE_ROLE,
	DEFAULT_IDENTITY_ADMIN_ROLE,
	DEFAULT_TENANT_ADMIN_ROLE,
	DEFAULT_USER_ADMIN_ROLE,
	DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE
} from "../src/defaults.js";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import { run } from "../src/node.js";

const TEST_PORT = await getFreePort();
const TEST_PORT_ST = await getFreePort();
const TEST_PORT_SO = await getFreePort();
const TEST_PORT_FC = await getFreePort();
const TEST_PORT_GA = await getFreePort();
const TEST_PORT_EM = await getFreePort();
const TEST_TENANT_API_KEY = "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d";
const TEST_TENANT_ID = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d";
const TEST_GA_TENANT_API_KEY = "aabb1122ccdd3344eeff5566aabb7788";
const TEST_GA_TENANT_ID = "bb2cc3dd4ee5ff6aa7bb8cc9dd0ee1ff";
const TEST_GA_TENANT2_ID = "cc3dd4ee5ff6aa7bb8cc9dd0ee1ff2aa";
const TEST_GA_TENANT2_API_KEY = "dd4ee5ff6aa7bb8cc9dd0ee1ff2aa33b";
const TEST_ADMIN_EMAIL = "admin@node";
const TEST_ADMIN_PASSWORD = "Admin@Node12345!";
const TEST_FEDCAT_DATASET_ID = "urn:uuid:test-dataset-endpoint-001";
const TEST_FEDCAT_ONLY_DATASET_ID = "urn:uuid:test-fedcat-only-dataset-001";
const OUTPUT_TMP_DIR = "./tests/.tmp/endpoints/";
const OUTPUT_TMP_DIR_ST = "./tests/.tmp/endpoints-st/";
const OUTPUT_TMP_DIR_SO = "./tests/.tmp/endpoints-so/";
const OUTPUT_TMP_DIR_FC = "./tests/.tmp/endpoints-fc/";
const OUTPUT_TMP_DIR_GA = "./tests/.tmp/endpoints-ga/";
const OUTPUT_TMP_DIR_EM = "./tests/.tmp/endpoints-em/";

const TEST_DATASPACE_APP_ID = "https://twin.example.org/test-app";
const TEST_TRANSFER_CONSUMER_PID = "urn:uuid:consumer-pid-endpoint-001";
const TEST_DATASPACE_DATASET_ID = "urn:uuid:dataspace-dataset-endpoint-001";

const SHARED_ENV_VARS: { [id: string]: string } = {
	TWIN_DEBUG: "true",
	TWIN_SILENT: "true",
	TWIN_TENANT_ENABLED: "true",
	TWIN_TENANT_ID: TEST_TENANT_ID,
	TWIN_PORT: TEST_PORT.toString(),
	TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR}db`,
	TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
	TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
	TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
	TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
	TWIN_TRACING_CONNECTOR: TracingConnectorType.EntityStorage,
	TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage,
	TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
	TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
	TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
	TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
	TWIN_IDENTITY_PROFILE_SELF_UPDATE_DENIED_PROPERTIES: "roles",
	TWIN_NFT_CONNECTOR: NftConnectorType.EntityStorage,
	TWIN_NOTARIZATION_CONNECTOR: NotarizationConnectorType.EntityStorage,
	TWIN_ATTESTATION_CONNECTOR: AttestationConnectorType.Nft,
	TWIN_FAUCET_CONNECTOR: FaucetConnectorType.EntityStorage,
	TWIN_WALLET_CONNECTOR: WalletConnectorType.EntityStorage,
	TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
	TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
	TWIN_HEALTH_ENABLED: "true",
	TWIN_AUDITABLE_ITEM_GRAPH_ENABLED: "true",
	TWIN_AUDITABLE_ITEM_STREAM_ENABLED: "true",
	TWIN_DATA_CONVERTER_CONNECTORS: "json,xml",
	TWIN_DATA_EXTRACTOR_CONNECTORS: "json-path",
	TWIN_DOCUMENT_MANAGEMENT_ENABLED: "true",
	TWIN_AUTOMATION_ACTION_TYPES: "fetch",
	TWIN_EMAIL_PROTOCOL_CONNECTOR: "imap",
	TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
	TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
	// Entity storage authentication sends the password reset and sign up e-mails.
	TWIN_MESSAGING_EMAIL_CONNECTOR: MessagingEmailConnectorType.EntityStorage,
	TWIN_MESSAGING_TEMPLATES_DIRECTORY: "../../apps/node/templates",
	TWIN_AUTH_EMAIL_SENDER: "no-reply@example.org",
	TWIN_AUTH_REGISTRATION_VERIFICATION_URL: "https://app.example.org/verify",
	TWIN_AUTH_PASSWORD_RESET_URL: "https://app.example.org/reset",
	// Publishes the OAuth 2.0 authorization server metadata of the node.
	TWIN_AUTH_LOGIN_PAGE_URL: "https://app.example.org/login",
	TWIN_DATASPACE_ENABLED: "true",
	TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
	TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
	TWIN_TRUST_VERIFICATION_METHOD_ID: "trust-assertion",
	TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH: "/rights-management",
	TWIN_RIGHTS_MANAGEMENT_POLICY_INFORMATION_SOURCES: "static,identity,identity-profile",
	TWIN_RIGHTS_MANAGEMENT_POLICY_NEGOTIATORS: "pass-through",
	TWIN_RIGHTS_MANAGEMENT_POLICY_REQUESTERS: "pass-through",
	TWIN_RIGHTS_MANAGEMENT_POLICY_EXECUTION_ACTIONS: "logging",
	TWIN_RIGHTS_MANAGEMENT_POLICY_ENFORCEMENT_PROCESSORS: "pass-through",
	TWIN_RIGHTS_MANAGEMENT_POLICY_ARBITERS: "pass-through",
	TWIN_DATASPACE_DATA_PLANE_PATH: "dataspace/entities",
	TWIN_SCHEMA_MIGRATION_ENABLED: "false",
	TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
};

describe("node-core", () => {
	beforeAll(async () => {
		await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_ST, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_SO, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_FC, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_GA, { recursive: true, force: true });
	});

	afterAll(async () => {
		await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_ST, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_SO, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_FC, { recursive: true, force: true });
		await rm(OUTPUT_TMP_DIR_GA, { recursive: true, force: true });
	});

	test("Can bootstrap a standalone federated catalogue node and exercise its endpoints", async () => {
		Factory.clearFactories();

		// Cannot spread from SHARED_ENV_VARS: that block enables TWIN_DATASPACE_ENABLED, RM, NFT,
		// notarization, attestation, faucet, wallet, and other domain components that must be absent
		// to prove a catalogue-only deployment. This literal is intentionally minimal.
		const catalogueEnvVars: { [id: string]: string } = {
			TWIN_DEBUG: "true",
			TWIN_SILENT: "true",
			TWIN_PORT: TEST_PORT_FC.toString(),
			TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR_FC}db`,
			TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.File,
			TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
			TWIN_LOGGING_CONNECTOR: LoggingConnectorType.EntityStorage,
			TWIN_TELEMETRY_CONNECTOR: TelemetryConnectorType.EntityStorage,
			TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
			TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
			TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
			TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
			TWIN_EVENT_BUS_CONNECTOR: EventBusConnectorType.Local,
			TWIN_EVENT_BUS_COMPONENT: EventBusComponentType.Service,
			TWIN_HEALTH_ENABLED: "true",
			TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
			TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage,
			TWIN_AUTHORIZATION_CONNECTOR: AuthorizationConnectorType.EntityStorage,
			// Entity storage authentication sends the password reset and sign up e-mails.
			TWIN_MESSAGING_EMAIL_CONNECTOR: MessagingEmailConnectorType.EntityStorage,
			TWIN_MESSAGING_TEMPLATES_DIRECTORY: "../../apps/node/templates",
			TWIN_AUTH_EMAIL_SENDER: "no-reply@example.org",
			TWIN_AUTH_REGISTRATION_VERIFICATION_URL: "https://app.example.org/verify",
			TWIN_AUTH_PASSWORD_RESET_URL: "https://app.example.org/reset",
			TWIN_TRUST_GENERATORS: "jwt-verifiable-credential",
			TWIN_TRUST_VERIFIERS: "jwt-verifiable-credential",
			TWIN_TRUST_VERIFICATION_METHOD_ID: "trust-assertion",
			TWIN_FEDERATED_CATALOGUE_ENABLED: "true",
			TWIN_FEDERATED_CATALOGUE_FILTERS: "filter-by-metadata",
			TWIN_FEDERATED_CATALOGUE_MUTEX_TIMEOUT: "30000",
			TWIN_SCHEMA_MIGRATION_ENABLED: "false",
			TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
		};

		// Phase 1: Bootstrap - creates node identity and admin user (single-tenant).
		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: {
					...catalogueEnvVars,
					TWIN_FEATURES: "admin-user",
					TWIN_ADMIN_USER_NAME: TEST_ADMIN_EMAIL,
					TWIN_ADMIN_USER_PASSWORD: TEST_ADMIN_PASSWORD,
					TWIN_ADMIN_USER_ROLES: [
						DEFAULT_ESCALATED_PRIVILEGE_ROLE,
						DEFAULT_TENANT_ADMIN_ROLE,
						DEFAULT_USER_ADMIN_ROLE,
						DEFAULT_IDENTITY_ADMIN_ROLE,
						DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
						DEFAULT_DEVOPS_ROLE
					].join(","),
					TWIN_HEALTH_STARTUP_INTERVAL: "1"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		expect(bootstrapState.nodeId).toBeDefined();

		Factory.clearFactories();

		// Phase 2: Start the catalogue-only server.
		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			openApiSpecFile: path.resolve("./tests/fixtures/spec.json"),
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId,
				nodeOrganizationId: bootstrapState.nodeOrganizationId
			}),
			envVars: catalogueEnvVars
		});

		expect(serverResult).toBeDefined();
		expect(serverResult?.engine).toBeDefined();

		// In single-tenant mode the org DID is in bootstrapState.nodeOrganizationId.
		const trustComponentType = serverResult?.engine.getRegisteredInstanceType("trustComponent");
		expect(trustComponentType).toBeDefined();

		const trustComponent = ComponentFactory.get<ITrustComponent>(trustComponentType ?? "");
		const trustBearerToken = await trustComponent.generate(
			bootstrapState.nodeOrganizationId ?? "",
			undefined,
			{ subject: {} }
		);

		const serverStartTime = Date.now();

		// Phase 3: Exercise catalogue endpoints - no dataspace or RM groups.
		try {
			await loadAndRunGroups(path.resolve("tests/endpoints/federated-catalogue-only-index.json"), {
				baseUrl: `http://localhost:${TEST_PORT_FC}`,
				apiKeyQuery: "",
				authToken: "",
				isSingleTenant: true,
				vars: {
					trustAuthorization: `Bearer ${String(trustBearerToken)}`,
					adminEmail: TEST_ADMIN_EMAIL,
					adminPassword: TEST_ADMIN_PASSWORD,
					fedCatDatasetId: TEST_FEDCAT_ONLY_DATASET_ID,
					fakeId: "fake:nonexistent-resource-id",
					baseUrl: `http://localhost:${TEST_PORT_FC}`
				},
				serverStartTime
			});
		} finally {
			await serverResult?.shutdown();
		}
	});

	test("Can bootstrap the node and exercise all connected endpoints", async () => {
		Factory.clearFactories();

		// Phase 1: Bootstrap - creates node identity, auth signing key, tenant, admin user.
		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: {
					...SHARED_ENV_VARS,
					TWIN_FEATURES: "admin-user",
					TWIN_TENANT_API_KEY: TEST_TENANT_API_KEY,
					TWIN_TENANT_ID: TEST_TENANT_ID,
					TWIN_ADMIN_USER_NAME: TEST_ADMIN_EMAIL,
					TWIN_ADMIN_USER_PASSWORD: TEST_ADMIN_PASSWORD,
					TWIN_ADMIN_USER_ROLES: [
						DEFAULT_ESCALATED_PRIVILEGE_ROLE,
						DEFAULT_TENANT_ADMIN_ROLE,
						DEFAULT_USER_ADMIN_ROLE,
						DEFAULT_IDENTITY_ADMIN_ROLE,
						DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
						DEFAULT_DEVOPS_ROLE
					].join(","),
					TWIN_HEALTH_STARTUP_INTERVAL: "500"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		expect(bootstrapState.nodeId).toBeDefined();

		Factory.clearFactories();

		// Phase 2: Start the server using the bootstrapped identity/tenant state.
		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			openApiSpecFile: path.resolve("./tests/fixtures/spec.json"),
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId
			}),
			envVars: SHARED_ENV_VARS
		});

		expect(serverResult).toBeDefined();
		expect(serverResult?.engine).toBeDefined();

		const trustComponentType = serverResult?.engine.getRegisteredInstanceType("trustComponent");
		expect(trustComponentType).toBeDefined();

		// In multi-tenant mode, the org DID is on the tenant, not in node state - look it up.
		const tenantAdminType =
			serverResult?.engine.getRegisteredInstanceTypeOptional("tenantAdminComponent");
		expect(tenantAdminType).toBeDefined();
		let orgDid: string | undefined;
		await ContextIdStore.run({ [ContextIdKeys.Node]: bootstrapState.nodeId ?? "" }, async () => {
			const tenantAdmin = ComponentFactory.get<ITenantAdminComponent>(tenantAdminType ?? "");
			const tenant = await tenantAdmin.get(TEST_TENANT_ID);
			orgDid = tenant.organizationId;
		});
		expect(orgDid).toBeDefined();

		const trustComponent = ComponentFactory.get<ITrustComponent>(trustComponentType ?? "");
		const trustBearerToken = await trustComponent.generate(orgDid ?? "", undefined, {
			subject: {}
		});

		// Register minimal IDataspaceApp so happy-path app-dataset and transfer tests can succeed.
		DataspaceAppFactory.register(TEST_DATASPACE_APP_ID, () => ({
			className: () => "EndpointTestApp",
			activitiesHandled: () => [],
			supportedQueryTypes: () => ["https://vocabulary.uncefact.org/Consignment"],
			handleDataRequest: async () => ({
				data: {
					"@context": "https://vocabulary.uncefact.org/",
					"@type": "Consignment",
					"@id": "urn:test:consignment-001"
				}
			})
		}));

		const serverStartTime = Date.now();

		// Phase 3: Exercise endpoints as a client, using the test definitions in tests/endpoints.
		// The rights-negotiations-agreement group runs the full DSP negotiation flow to create
		// a real ODRL Agreement and captures its ID into dataspaceAgreementId for the transfer tests.
		const probed: IProbedStep[] = [];
		try {
			await loadAndRunGroups(path.resolve("tests/endpoints/index.json"), {
				probed,
				baseUrl: `http://localhost:${TEST_PORT}`,
				apiKeyQuery: `x-api-key=${TEST_TENANT_API_KEY}`,
				authToken: "",
				appendOrgParam: true,
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
					fakeId: "fake:nonexistent-resource-id",
					fedCatDatasetId: TEST_FEDCAT_DATASET_ID,
					dataspaceAppId: TEST_DATASPACE_APP_ID,
					dataspaceDatasetId: TEST_DATASPACE_DATASET_ID,
					transferConsumerPid: TEST_TRANSFER_CONSUMER_PID,
					baseUrl: `http://localhost:${TEST_PORT}`
				},
				serverStartTime
			});

			// Every route the node serves is reached with a success and a failure response, apart
			// from the public status routes, which have no failure to probe.
			expect(
				findUnprobedRoutes(serverResult?.server?.getRestRoutes() ?? [], probed, [
					"GET /",
					"GET /favicon.ico",
					"GET /.well-known/dspace-version",
					"GET /health",
					"GET /info",
					"GET /livez",
					"GET /readyz",
					"GET /spec",
					"GET /authentication/policy",
					"GET /authentication/providers",
					"GET /.well-known/oauth-authorization-server",
					"POST /authentication/logout"
				])
			).toEqual({
				unreached: [],
				// The routes only reached with a failure here: the deprecated identity profile routes,
				// which always refuse, those another test reaches with a success, such as signing up,
				// and those that need data this run does not create. A new route must not join them.
				noSuccess: [
					"GET /favicon.ico",
					"POST /authentication/login/:authProviderId",
					"POST /authentication/register/verify",
					"POST /authentication/password/reset",
					"POST /authentication/account/organization/create",
					"POST /authentication/admin/account/:accountId/identity",
					"POST /authentication/admin/account/:accountId/identity/import",
					"GET /authentication/admin/account/managed",
					"DELETE /authentication/admin/account/:id",
					"PUT /authentication/organization/:id/admin/:accountId",
					"DELETE /authentication/organization/:id/admin/:accountId",
					"GET /tenants/organization/:organizationId",
					"GET /tenants/public-origin/:publicOrigin",
					"POST /identity/profile",
					"GET /identity/profile",
					"GET /identity/profile/:userIdentity",
					"GET /identity/profile/:identity/public",
					"PUT /identity/profile",
					"PUT /identity/profile/:userIdentity",
					"DELETE /identity/profile",
					"DELETE /identity/profile/:userIdentity",
					"GET /identity/profile/query",
					"GET /identity/profile/admin/query",
					"GET /mailbox/mail/:id",
					"DELETE /mailbox/mail/:id",
					"GET /mailbox/authcallback",
					"POST /catalog/request",
					"POST /dataspace/transfers/:pid/suspend",
					"POST /dataspace/transfers/:pid/terminate",
					"POST /dataspace/inbox",
					"GET /dataspace/activity-logs/:id"
				],
				noFailure: []
			});
		} finally {
			await serverResult?.shutdown();
			await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
		}
	});

	test("Can bootstrap the node and exercise all connected endpoints on a single-tenant node", async () => {
		const singleTenantEnvVars: { [id: string]: string } = {
			...SHARED_ENV_VARS,
			TWIN_TENANT_ENABLED: "false",
			TWIN_PORT: TEST_PORT_ST.toString(),
			TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR_ST}db`
		};

		await rm(OUTPUT_TMP_DIR_ST, { recursive: true, force: true });
		Factory.clearFactories();

		// Phase 1: Bootstrap - creates node identity and admin user (no tenant in single-tenant mode).
		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: {
					...singleTenantEnvVars,
					TWIN_FEATURES: "admin-user",
					TWIN_TENANT_API_KEY: TEST_TENANT_API_KEY,
					TWIN_ADMIN_USER_NAME: TEST_ADMIN_EMAIL,
					TWIN_ADMIN_USER_PASSWORD: TEST_ADMIN_PASSWORD,
					TWIN_ADMIN_USER_ROLES: [
						DEFAULT_ESCALATED_PRIVILEGE_ROLE,
						DEFAULT_TENANT_ADMIN_ROLE,
						DEFAULT_USER_ADMIN_ROLE,
						DEFAULT_IDENTITY_ADMIN_ROLE,
						DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
						DEFAULT_DEVOPS_ROLE
					].join(","),
					TWIN_HEALTH_STARTUP_INTERVAL: "500"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		expect(bootstrapState.nodeId).toBeDefined();

		Factory.clearFactories();

		// Phase 2: Start the server using the bootstrapped identity/org state.
		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			openApiSpecFile: path.resolve("./tests/fixtures/spec.json"),
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId,
				nodeOrganizationId: bootstrapState.nodeOrganizationId
			}),
			envVars: singleTenantEnvVars
		});

		expect(serverResult).toBeDefined();
		expect(serverResult?.engine).toBeDefined();

		const trustComponentType = serverResult?.engine.getRegisteredInstanceType("trustComponent");
		expect(trustComponentType).toBeDefined();

		const trustComponent = ComponentFactory.get<ITrustComponent>(trustComponentType ?? "");
		const trustBearerToken = await trustComponent.generate(
			bootstrapState.nodeOrganizationId ?? "",
			undefined,
			{ subject: {} }
		);

		DataspaceAppFactory.register(TEST_DATASPACE_APP_ID, () => ({
			className: () => "EndpointTestApp",
			activitiesHandled: () => [],
			supportedQueryTypes: () => ["https://vocabulary.uncefact.org/Consignment"],
			handleDataRequest: async () => ({
				data: {
					"@context": "https://vocabulary.uncefact.org/",
					"@type": "Consignment",
					"@id": "urn:test:consignment-001"
				}
			})
		}));

		const serverStartTime = Date.now();

		// Phase 3: Exercise endpoints using the single-tenant group index.
		// The rights-negotiations-agreement group runs the full DSP negotiation flow to create
		// a real ODRL Agreement and captures its ID into dataspaceAgreementId for the transfer tests.
		try {
			await loadAndRunGroups(path.resolve("tests/endpoints/index.json"), {
				baseUrl: `http://localhost:${TEST_PORT_ST}`,
				apiKeyQuery: `x-api-key=${TEST_TENANT_API_KEY}`,
				authToken: "",
				isSingleTenant: true,
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
					fakeId: "fake:nonexistent-resource-id",
					fedCatDatasetId: TEST_FEDCAT_DATASET_ID,
					dataspaceAppId: TEST_DATASPACE_APP_ID,
					dataspaceDatasetId: TEST_DATASPACE_DATASET_ID,
					transferConsumerPid: TEST_TRANSFER_CONSUMER_PID,
					baseUrl: `http://localhost:${TEST_PORT_ST}`
				},
				serverStartTime
			});
		} finally {
			await serverResult?.shutdown();
			await rm(OUTPUT_TMP_DIR_ST, { recursive: true, force: true });
		}
	});

	test("Can sign up with e-mail verification and reset a forgotten password", async () => {
		const emailEnvVars: { [id: string]: string } = {
			...SHARED_ENV_VARS,
			TWIN_TENANT_ENABLED: "false",
			TWIN_PORT: TEST_PORT_EM.toString(),
			TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR_EM}db`,
			TWIN_CORS_ORIGINS: "https://app.example.org",
			TWIN_ORIGIN_CHECK_ENABLED: "true",
			// Short, so a session can be let age past it.
			TWIN_AUTH_RECENT_SIGN_IN_SECONDS: "2",
			// Deliver the queued e-mails every second rather than every minute.
			TWIN_AUTH_DELIVERY_INTERVAL_SECONDS: "1",
			TWIN_TASK_SCHEDULER_INTERVAL: DurationConstants.MsPerSecond.toString()
		};

		await rm(OUTPUT_TMP_DIR_EM, { recursive: true, force: true });
		Factory.clearFactories();

		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: emailEnvVars
			},
			["node", "index.js", "bootstrap-dev"]
		);
		Factory.clearFactories();

		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId,
				nodeOrganizationId: bootstrapState.nodeOrganizationId
			}),
			envVars: emailEnvVars
		});
		expect(serverResult?.engine).toBeDefined();

		const linkToken = async (
			recipient: string,
			linkUrl: string,
			after: number
		): Promise<string> => {
			const emails =
				EntityStorageConnectorFactory.get<
					IEntityStorageConnector<{ recipients: string[]; message: string; ts: number }>
				>("email-entry");
			for (let attempt = 0; attempt < 50; attempt++) {
				const { entities } = await ContextIdStore.run(
					serverResult?.engine.getContextIds() ?? {},
					async () => emails.query()
				);
				const email = entities.find(
					e =>
						(e.recipients ?? []).includes(recipient) &&
						(e.ts ?? 0) > after &&
						(e.message ?? "").includes(linkUrl)
				);
				const token = /token=([\w-]+)/.exec(email?.message ?? "")?.[1];
				if (Is.stringValue(token)) {
					return token;
				}
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			throw new Error(`No link was sent to ${recipient}`);
		};

		const ctx: IRunnerContext = {
			baseUrl: `http://localhost:${TEST_PORT_EM}`,
			apiKeyQuery: "",
			authToken: "",
			isSingleTenant: true,
			appendOrgParam: false,
			vars: {
				email: "sign-up@example.org",
				password: "SignUp@Node12345!",
				newPassword: "Reset@Node123456!"
			},
			serverStartTime: Date.now()
		};

		try {
			const signUpTime = Date.now() - 1;
			await runGroup(
				{
					group: "Authentication - sign up",
					steps: [
						{
							description: "POST /authentication/register - accepted, the address must be verified",
							method: "POST",
							path: "/authentication/register",
							body: { email: "{{email}}", password: "{{password}}", givenName: "Sign" },
							expectedStatus: 202
						}
					]
				},
				ctx
			);

			// The account is stored with the e-mail, after the response.
			ctx.vars.verifyToken = await linkToken(
				"sign-up@example.org",
				"https://app.example.org/verify",
				signUpTime
			);
			await runGroup(
				{
					group: "Authentication - unverified sign up",
					steps: [
						{
							description: "POST /authentication/login - 401 accountNotVerified with the password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "{{email}}", password: "{{password}}" },
							expectedStatus: 401,
							assert: { "body.message": "entityStorageAuthenticationService.accountNotVerified" }
						},
						{
							description: "POST /authentication/login - 401 loginFailed with a wrong password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "{{email}}", password: "{{newPassword}}" },
							expectedStatus: 401,
							assert: { "body.message": "entityStorageAuthenticationService.loginFailed" }
						},
						{
							description: "POST /authentication/register/verify - 401 for an unknown token",
							method: "POST",
							path: "/authentication/register/verify",
							body: { token: "not-a-token" },
							expectedStatus: 401
						}
					]
				},
				ctx
			);

			await runGroup(
				{
					group: "Authentication - verify the sign up",
					steps: [
						{
							description: "POST /authentication/register/verify - verify the sign up",
							method: "POST",
							path: "/authentication/register/verify",
							body: { token: "{{verifyToken}}" },
							expectedStatus: 204
						},
						{
							description: "POST /authentication/register/verify - 401 as the link is used once",
							method: "POST",
							path: "/authentication/register/verify",
							body: { token: "{{verifyToken}}" },
							expectedStatus: 401
						},
						{
							description: "POST /authentication/login - the verified account signs in",
							method: "POST",
							path: "/authentication/login",
							body: { email: "{{email}}", password: "{{password}}" },
							expectedStatus: 200,
							capture: { authToken: "cookie:access_token" }
						},
						{
							description: "GET /authentication/me - the signed in account",
							method: "GET",
							path: "/authentication/me",
							expectedStatus: 200,
							assert: { "body.email": "{{email}}" }
						}
					]
				},
				ctx
			);

			const forgotTime = Date.now() - 1;
			await runGroup(
				{
					group: "Authentication - forgotten password",
					steps: [
						{
							description: "POST /authentication/password/forgot - accepted for an unknown address",
							method: "POST",
							path: "/authentication/password/forgot",
							body: { email: "unknown@example.org" },
							expectedStatus: 204
						},
						{
							description: "POST /authentication/password/forgot - send a reset link",
							method: "POST",
							path: "/authentication/password/forgot",
							body: { email: "{{email}}" },
							expectedStatus: 204
						}
					]
				},
				ctx
			);

			ctx.vars.resetToken = await linkToken(
				"sign-up@example.org",
				"https://app.example.org/reset",
				forgotTime
			);
			await runGroup(
				{
					group: "Authentication - reset the password",
					steps: [
						{
							description: "POST /authentication/password/reset - 401 for an unknown token",
							method: "POST",
							path: "/authentication/password/reset",
							body: { token: "not-a-token", newPassword: "{{newPassword}}" },
							expectedStatus: 401
						},
						{
							description: "POST /authentication/password/reset - set a new password",
							method: "POST",
							path: "/authentication/password/reset",
							body: { token: "{{resetToken}}", newPassword: "{{newPassword}}" },
							expectedStatus: 204
						},
						{
							description: "POST /authentication/login - 401 with the old password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "{{email}}", password: "{{password}}" },
							expectedStatus: 401
						},
						{
							description: "POST /authentication/login - sign in with the new password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "{{email}}", password: "{{newPassword}}" },
							expectedStatus: 200,
							capture: { authToken: "cookie:access_token" }
						},
						{
							description: "POST /authentication/password/reset - 401 as the link is used once",
							method: "POST",
							path: "/authentication/password/reset",
							body: { token: "{{resetToken}}", newPassword: "{{password}}" },
							expectedStatus: 401
						}
					]
				},
				ctx
			);

			// With the origin check on, a cookie authenticated change is only accepted from an allowed origin.
			await runGroup(
				{
					group: "Authentication - origin check",
					steps: [
						{
							description: "POST /authentication/account - 403 from an origin that is not allowed",
							method: "POST",
							path: "/authentication/account",
							headers: { origin: "https://attacker.example.org" },
							body: { type: "profile", data: { name: "Changed" } },
							expectedStatus: 403,
							assert: { "body.message": "originCheckProcessor.originNotAllowed" }
						},
						{
							description: "POST /authentication/account - accepted from an allowed origin",
							method: "POST",
							path: "/authentication/account",
							headers: { origin: "https://app.example.org" },
							body: { type: "profile", data: { name: "Changed" } },
							expectedStatus: 201
						}
					]
				},
				ctx
			);

			// A second sign up for an address waiting to be verified replaces the first, so whoever signed
			// up first with someone else's address cannot keep their password.
			const firstSignUpTime = Date.now() - 1;
			await runGroup(
				{
					group: "Authentication - sign up for someone else's address",
					steps: [
						{
							description: "POST /authentication/register - a sign up with the first password",
							method: "POST",
							path: "/authentication/register",
							body: { email: "taken@example.org", password: "{{password}}" },
							expectedStatus: 202
						}
					]
				},
				ctx
			);
			ctx.vars.firstVerifyToken = await linkToken(
				"taken@example.org",
				"https://app.example.org/verify",
				firstSignUpTime
			);
			const secondSignUpTime = Date.now() - 1;
			await runGroup(
				{
					group: "Authentication - sign up again for the address",
					steps: [
						{
							description: "POST /authentication/register - a sign up with another password",
							method: "POST",
							path: "/authentication/register",
							body: { email: "taken@example.org", password: "{{newPassword}}" },
							expectedStatus: 202
						}
					]
				},
				ctx
			);
			ctx.vars.secondVerifyToken = await linkToken(
				"taken@example.org",
				"https://app.example.org/verify",
				secondSignUpTime
			);
			await runGroup(
				{
					group: "Authentication - only the latest sign up is verified",
					steps: [
						{
							description: "POST /authentication/register/verify - 401 for the earlier link",
							method: "POST",
							path: "/authentication/register/verify",
							body: { token: "{{firstVerifyToken}}" },
							expectedStatus: 401
						},
						{
							description: "POST /authentication/register/verify - verify the latest sign up",
							method: "POST",
							path: "/authentication/register/verify",
							body: { token: "{{secondVerifyToken}}" },
							expectedStatus: 204
						},
						{
							description: "POST /authentication/login - 401 with the first password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "taken@example.org", password: "{{password}}" },
							expectedStatus: 401
						},
						{
							description: "POST /authentication/login - sign in with the latest password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "taken@example.org", password: "{{newPassword}}" },
							expectedStatus: 200
						}
					]
				},
				ctx
			);

			// A reset link is sent to the address, so following it also verifies an unverified account.
			const unverifiedSignUpTime = Date.now() - 1;
			await runGroup(
				{
					group: "Authentication - sign up without verifying",
					steps: [
						{
							description: "POST /authentication/register - a sign up that is never verified",
							method: "POST",
							path: "/authentication/register",
							body: { email: "unverified@example.org", password: "{{password}}" },
							expectedStatus: 202
						}
					]
				},
				ctx
			);
			ctx.vars.unverifiedToken = await linkToken(
				"unverified@example.org",
				"https://app.example.org/verify",
				unverifiedSignUpTime
			);
			const unverifiedForgotTime = Date.now() - 1;
			await runGroup(
				{
					group: "Authentication - forgotten password before verifying",
					steps: [
						{
							description:
								"POST /authentication/password/forgot - send a reset link to the unverified account",
							method: "POST",
							path: "/authentication/password/forgot",
							body: { email: "unverified@example.org" },
							expectedStatus: 204
						}
					]
				},
				ctx
			);
			ctx.vars.unverifiedResetToken = await linkToken(
				"unverified@example.org",
				"https://app.example.org/reset",
				unverifiedForgotTime
			);
			await runGroup(
				{
					group: "Authentication - the reset verifies the account",
					steps: [
						{
							description: "POST /authentication/password/reset - set a new password",
							method: "POST",
							path: "/authentication/password/reset",
							body: { token: "{{unverifiedResetToken}}", newPassword: "{{newPassword}}" },
							expectedStatus: 204
						},
						{
							description:
								"POST /authentication/register/verify - 401 as the account is already verified",
							method: "POST",
							path: "/authentication/register/verify",
							body: { token: "{{unverifiedToken}}" },
							expectedStatus: 401
						},
						{
							description:
								"POST /authentication/login - the account signs in with the new password",
							method: "POST",
							path: "/authentication/login",
							body: { email: "unverified@example.org", password: "{{newPassword}}" },
							expectedStatus: 200
						}
					]
				},
				ctx
			);

			// Deleting the account needs a session that started recently, two seconds on this node.
			await runGroup(
				{
					group: "Authentication - recent sign in",
					steps: [
						{
							description: "POST /authentication/login - sign in",
							method: "POST",
							path: "/authentication/login",
							headers: { origin: "https://app.example.org" },
							body: { email: "{{email}}", password: "{{newPassword}}" },
							expectedStatus: 200,
							capture: { authToken: "cookie:access_token" }
						},
						{
							description: "DELETE /authentication/me - 401 once the session is no longer recent",
							method: "DELETE",
							path: "/authentication/me",
							headers: { origin: "https://app.example.org" },
							delayMs: 3500,
							expectedStatus: 401,
							assert: {
								"body.message": "recentSignInHelper.recentSignInRequired",
								"body.properties.maxAgeSeconds": 2
							}
						},
						{
							description: "GET /authentication/me - the session itself is still valid",
							method: "GET",
							path: "/authentication/me",
							expectedStatus: 200,
							assert: { "body.email": "{{email}}" }
						},
						{
							description: "POST /authentication/login - sign in again",
							method: "POST",
							path: "/authentication/login",
							headers: { origin: "https://app.example.org" },
							body: { email: "{{email}}", password: "{{newPassword}}" },
							expectedStatus: 200,
							capture: { authToken: "cookie:access_token" }
						},
						{
							description: "DELETE /authentication/me - deleted after signing in again",
							method: "DELETE",
							path: "/authentication/me",
							headers: { origin: "https://app.example.org" },
							expectedStatus: 204
						},
						{
							description: "POST /authentication/login - 401 once the account is deleted",
							method: "POST",
							path: "/authentication/login",
							body: { email: "{{email}}", password: "{{newPassword}}" },
							expectedStatus: 401
						}
					]
				},
				ctx
			);
		} finally {
			await serverResult?.shutdown();
			await rm(OUTPUT_TMP_DIR_EM, { recursive: true, force: true });
		}
	});

	test("Can bootstrap a global-admin user and exercise cross-tenant override endpoints", async () => {
		const globalAdminEnvVars: { [id: string]: string } = {
			...SHARED_ENV_VARS,
			TWIN_PORT: TEST_PORT_GA.toString(),
			TWIN_TENANT_ID: TEST_GA_TENANT_ID,
			TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR_GA}db`
		};

		await rm(OUTPUT_TMP_DIR_GA, { recursive: true, force: true });
		Factory.clearFactories();

		// Phase 1: Bootstrap admin user receives global-admin role so it can use override-tenant.
		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: {
					...globalAdminEnvVars,
					TWIN_FEATURES: "admin-user",
					TWIN_TENANT_API_KEY: TEST_GA_TENANT_API_KEY,
					TWIN_ADMIN_USER_NAME: TEST_ADMIN_EMAIL,
					TWIN_ADMIN_USER_PASSWORD: TEST_ADMIN_PASSWORD,
					TWIN_ADMIN_USER_ROLES: "tenant-admin,user-admin,global-admin",
					TWIN_HEALTH_STARTUP_INTERVAL: "500"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		expect(bootstrapState.nodeId).toBeDefined();

		// Phase 1.5: Bootstrap a second tenant for cross-partition override tests.
		// Reuses the existing node identity and storage root so tenant 2 lives in the same store.
		Factory.clearFactories();
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, {
					nodeId: bootstrapState.nodeId
				}),
				disableProcessExitOnFailure: true,
				envVars: {
					...globalAdminEnvVars,
					TWIN_TENANT_ID: TEST_GA_TENANT2_ID,
					TWIN_TENANT_API_KEY: TEST_GA_TENANT2_API_KEY,
					TWIN_FEATURES: "tenant",
					TWIN_HEALTH_STARTUP_INTERVAL: "1"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		Factory.clearFactories();

		// Phase 2: Start the server using the bootstrapped state.
		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			openApiSpecFile: path.resolve("./tests/fixtures/spec.json"),
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId
			}),
			envVars: globalAdminEnvVars
		});

		expect(serverResult).toBeDefined();
		expect(serverResult?.engine).toBeDefined();

		const serverStartTime = Date.now();

		// Phase 3: Exercise global-admin override-tenant cross-partition endpoints.
		try {
			await loadAndRunGroups(path.resolve("tests/endpoints/global-admin-index.json"), {
				baseUrl: `http://localhost:${TEST_PORT_GA}`,
				apiKeyQuery: `x-api-key=${TEST_GA_TENANT_API_KEY}`,
				authToken: "",
				appendOrgParam: true,
				vars: {
					adminEmail: TEST_ADMIN_EMAIL,
					adminPassword: TEST_ADMIN_PASSWORD,
					secondTenantId: TEST_GA_TENANT2_ID
				},
				serverStartTime
			});
		} finally {
			await serverResult?.shutdown();
			await rm(OUTPUT_TMP_DIR_GA, { recursive: true, force: true });
		}
	});

	test("Can auto-generate a same-org agreement", async () => {
		const sameOrgEnvVars: { [id: string]: string } = {
			...SHARED_ENV_VARS,
			TWIN_TENANT_ENABLED: "false",
			TWIN_PORT: TEST_PORT_SO.toString(),
			TWIN_STORAGE_FILE_ROOT: `${OUTPUT_TMP_DIR_SO}db`
		};

		await rm(OUTPUT_TMP_DIR_SO, { recursive: true, force: true });
		Factory.clearFactories();

		// Phase 1: Bootstrap - creates node identity and admin user (single-tenant, no tenant admin).
		const bootstrapState: INodeEngineState = {};
		await run(
			{
				localesDirectory: "./dist/locales/",
				stateStorage: new MemoryStateStorage(false, bootstrapState),
				disableProcessExitOnFailure: true,
				envVars: {
					...sameOrgEnvVars,
					TWIN_FEATURES: "admin-user",
					TWIN_TENANT_API_KEY: TEST_TENANT_API_KEY,
					TWIN_ADMIN_USER_NAME: TEST_ADMIN_EMAIL,
					TWIN_ADMIN_USER_PASSWORD: TEST_ADMIN_PASSWORD,
					TWIN_ADMIN_USER_ROLES: [
						DEFAULT_ESCALATED_PRIVILEGE_ROLE,
						DEFAULT_TENANT_ADMIN_ROLE,
						DEFAULT_USER_ADMIN_ROLE,
						DEFAULT_IDENTITY_ADMIN_ROLE,
						DEFAULT_IDENTITY_PROFILE_ADMIN_ROLE,
						DEFAULT_DEVOPS_ROLE
					].join(","),
					TWIN_HEALTH_STARTUP_INTERVAL: "500"
				}
			},
			["node", "index.js", "bootstrap-dev"]
		);

		expect(bootstrapState.nodeId).toBeDefined();

		Factory.clearFactories();

		// Phase 2: Start the server with the same-org auto-agreement flag enabled.
		const serverResult = await run({
			localesDirectory: "./dist/locales/",
			openApiSpecFile: path.resolve("./tests/fixtures/spec.json"),
			stateStorage: new MemoryStateStorage(false, {
				nodeId: bootstrapState.nodeId,
				nodeOrganizationId: bootstrapState.nodeOrganizationId
			}),
			envVars: sameOrgEnvVars
		});

		expect(serverResult).toBeDefined();
		expect(serverResult?.engine).toBeDefined();

		const trustComponentType = serverResult?.engine.getRegisteredInstanceType("trustComponent");
		expect(trustComponentType).toBeDefined();

		const trustComponent = ComponentFactory.get<ITrustComponent>(trustComponentType ?? "");
		// Trust token whose identity is the node org DID - matches the context org, triggering
		// the same-org short-circuit in requestFromConsumer().
		const trustBearerToken = await trustComponent.generate(
			bootstrapState.nodeOrganizationId ?? "",
			undefined,
			{ subject: {} }
		);

		const serverStartTime = Date.now();

		// Phase 3: Login (captures organizationId + authToken), create an offer, then negotiate.
		// The provider returns FINALIZED immediately with an embedded agreement - no PAP pre-seed.
		try {
			await loadAndRunGroups(path.resolve("tests/endpoints/same-org-index.json"), {
				baseUrl: `http://localhost:${TEST_PORT_SO}`,
				apiKeyQuery: `x-api-key=${TEST_TENANT_API_KEY}`,
				authToken: "",
				isSingleTenant: true,
				vars: {
					trustAuthorization: `Bearer ${String(trustBearerToken)}`,
					adminEmail: TEST_ADMIN_EMAIL,
					adminPassword: TEST_ADMIN_PASSWORD
				},
				serverStartTime
			});
		} finally {
			await serverResult?.shutdown();
			await rm(OUTPUT_TMP_DIR_SO, { recursive: true, force: true });
		}
	});
});
