// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IPlatformComponent } from "@twin.org/api-models";
import type { IAuthorizationComponent } from "@twin.org/authorization-models";
import { ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Factory } from "@twin.org/core";
import { MemoryStateStorage } from "@twin.org/engine-core";
import {
	AuthenticationAdminComponentType,
	AuthenticationComponentType
} from "@twin.org/engine-server-types";
import {
	BlobStorageConnectorType,
	EntityStorageConnectorType,
	IdentityConnectorType,
	IdentityProfileConnectorType,
	IdentityResolverConnectorType,
	VaultConnectorType
} from "@twin.org/engine-types";
import { CI_ENV_VARS } from "./setupTestEnv.js";
import {
	AUTHORIZATION_MODEL_ID,
	DEFAULT_ESCALATED_PRIVILEGE_ROLE,
	DEFAULT_USER_ROLE
} from "../src/defaults.js";
import type { INodeEngineState } from "../src/models/INodeEngineState.js";
import type { INodeOptions } from "../src/models/INodeOptions.js";
import { buildConfiguration } from "../src/node.js";
import { start } from "../src/start.js";
import { initialiseLocales } from "../src/utils.js";

const TEST_NODE_ID =
	"did:iota:testnet:0x8f7b71cedde408974606e404bce76980fd17a570d03ec319788fefd5eabbe9e8";
const TEST_NODE_ORG_ID =
	"did:iota:testnet:0x7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b";

const basePort = Math.floor(Math.random() * 1000);
let port = 17000 + basePort;

describe("seedAuthorizationDefaults", () => {
	beforeEach(() => {
		port++;
		Factory.clearFactories();
	});

	afterEach(() => {
		const twin = (globalThis as { [key: string]: unknown }).__TWIN_SHARED__ as
			{ [key: string]: unknown } | undefined;
		if (twin) {
			twin.sharedObjectBuffers = {};
		}
	});

	async function startServer(envVars: { [key: string]: string }): ReturnType<typeof start> {
		await initialiseLocales("./dist/locales/");
		const nodeOptions: INodeOptions = {
			envPrefix: "TWIN_",
			stateStorage: new MemoryStateStorage<INodeEngineState>(false, {
				nodeId: TEST_NODE_ID,
				nodeOrganizationId: TEST_NODE_ORG_ID
			})
		};
		const { nodeEngineConfig, nodeEnvVars } = await buildConfiguration(envVars, nodeOptions, {
			name: "test",
			version: "0.0.0"
		});
		return start(nodeOptions, nodeEngineConfig, nodeEnvVars);
	}

	const baseMinimalEnvVars: { [key: string]: string } = {
		TWIN_DEBUG: "true",
		TWIN_SILENT: "true",
		TWIN_ENTITY_STORAGE_CONNECTOR_TYPE: EntityStorageConnectorType.Memory,
		TWIN_SCHEMA_MIGRATION_ENABLED: "false",
		TWIN_ENV_ALLOW_LIST: CI_ENV_VARS
	};

	const baseAuthEnvVars: { [key: string]: string } = {
		...baseMinimalEnvVars,
		TWIN_BLOB_STORAGE_CONNECTOR_TYPE: BlobStorageConnectorType.Memory,
		TWIN_AUTHORIZATION_CONNECTOR: "entity-storage",
		TWIN_VAULT_CONNECTOR: VaultConnectorType.EntityStorage,
		TWIN_IDENTITY_CONNECTOR: IdentityConnectorType.EntityStorage,
		TWIN_IDENTITY_RESOLVER_CONNECTOR: IdentityResolverConnectorType.EntityStorage,
		TWIN_IDENTITY_PROFILE_CONNECTOR: IdentityProfileConnectorType.EntityStorage,
		TWIN_AUTH_ADMIN_PROCESSOR_TYPE: AuthenticationAdminComponentType.EntityStorage,
		TWIN_AUTH_PROCESSOR_TYPE: AuthenticationComponentType.EntityStorage
	};

	test("seeds route-derived policies for all routes with defaultAuthorization on startup", async () => {
		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString()
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const protectedRoutes = routes.filter(r => r.defaultAuthorization && r.operationId);
		expect(protectedRoutes.length).toBeGreaterThan(0);

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const { entities: policies } = await authComponent.getAllPolicies(
					AUTHORIZATION_MODEL_ID,
					undefined,
					undefined,
					1000
				);
				for (const route of protectedRoutes) {
					const auth = route.defaultAuthorization;
					const operationId = route.operationId;
					if (auth && operationId) {
						const hasPolicy = policies.some(
							p =>
								p.subject === auth.permission && p.object === operationId && p.action === "execute"
						);
						expect(hasPolicy).toBe(true);
					}
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("global-admin inherits all roles derived from route defaultAuthorization", async () => {
		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString()
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const uniqueRoles = new Set<string>();
		for (const route of routes) {
			const role = route.defaultAuthorization?.role;
			if (role) {
				uniqueRoles.add(role);
			}
		}
		expect(uniqueRoles.size).toBeGreaterThan(0);

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const parentRoles = await authComponent.getParentRoles(
					AUTHORIZATION_MODEL_ID,
					DEFAULT_ESCALATED_PRIVILEGE_ROLE
				);
				for (const role of uniqueRoles) {
					expect(parentRoles).toContain(role);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("non-user roles derived from route defaultAuthorization inherit the user role", async () => {
		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString()
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const nonUserRoles = new Set<string>();
		for (const route of routes) {
			const role = route.defaultAuthorization?.role;
			if (role && role !== DEFAULT_USER_ROLE) {
				nonUserRoles.add(role);
			}
		}
		expect(nonUserRoles.size).toBeGreaterThan(0);

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				for (const role of nonUserRoles) {
					const parentRoles = await authComponent.getParentRoles(AUTHORIZATION_MODEL_ID, role);
					expect(parentRoles).toContain(DEFAULT_USER_ROLE);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("seeds only custom rules when authorizationModelMode is replace", async () => {
		const customRules = {
			policies: [{ subject: "custom-role", object: "custom-op", action: "execute" }],
			roleInheritances: []
		};

		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString(),
			TWIN_AUTHORIZATION_MODEL: JSON.stringify(customRules),
			TWIN_AUTHORIZATION_MODEL_MODE: "replace"
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const protectedRoute = routes.find(r => r.defaultAuthorization && r.operationId);
		expect(protectedRoute).toBeDefined();
		if (!protectedRoute) {
			return;
		}

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const { entities: policies } = await authComponent.getAllPolicies(
					AUTHORIZATION_MODEL_ID,
					undefined,
					undefined,
					1000
				);

				const hasCustomPolicy = policies.some(
					p => p.subject === "custom-role" && p.object === "custom-op"
				);
				expect(hasCustomPolicy).toBe(true);

				const auth = protectedRoute.defaultAuthorization;
				const operationId = protectedRoute.operationId;
				if (auth && operationId) {
					const hasRoutePolicy = policies.some(
						p => p.subject === auth.permission && p.object === operationId
					);
					expect(hasRoutePolicy).toBe(false);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("auto-derives user:read policy for GET routes without explicit defaultAuthorization", async () => {
		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString()
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const fallbackGetRoutes = routes.filter(
			r =>
				r.requiresAuthorization !== false &&
				!r.skipAuth &&
				!r.defaultAuthorization &&
				r.method.toUpperCase() === "GET"
		);

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const { entities: policies } = await authComponent.getAllPolicies(
					AUTHORIZATION_MODEL_ID,
					"user:read",
					undefined,
					1000
				);
				for (const route of fallbackGetRoutes) {
					const hasPolicy = policies.some(
						p =>
							p.subject === "user:read" && p.object === route.operationId && p.action === "execute"
					);
					expect(
						hasPolicy,
						`Expected user:read policy for route ${route.operationId} (method: ${route.method})`
					).toBe(true);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("auto-derives user:write policy for PUT/POST/PATCH/DELETE routes without explicit defaultAuthorization", async () => {
		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString()
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const fallbackWriteRoutes = routes.filter(r => {
			const method = r.method.toUpperCase();
			return (
				r.requiresAuthorization !== false &&
				!r.skipAuth &&
				!r.defaultAuthorization &&
				(method === "PUT" || method === "POST" || method === "PATCH" || method === "DELETE")
			);
		});

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const { entities: policies } = await authComponent.getAllPolicies(
					AUTHORIZATION_MODEL_ID,
					"user:write",
					undefined,
					1000
				);
				for (const route of fallbackWriteRoutes) {
					const hasPolicy = policies.some(
						p =>
							p.subject === "user:write" && p.object === route.operationId && p.action === "execute"
					);
					expect(hasPolicy).toBe(true);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("does not seed policy for route with requiresAuthorization false and no defaultAuthorization", async () => {
		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString()
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const skippedRoutes = routes.filter(
			r => r.requiresAuthorization === false && !r.defaultAuthorization
		);

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const { entities: policies } = await authComponent.getAllPolicies(
					AUTHORIZATION_MODEL_ID,
					undefined,
					undefined,
					1000
				);
				for (const route of skippedRoutes) {
					const hasPolicy = policies.some(p => p.object === route.operationId);
					expect(hasPolicy).toBe(false);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);

	test("merges custom rules with route-derived policies when authorizationModelMode is merge", async () => {
		const customRules = {
			policies: [{ subject: "custom-role", object: "custom-op", action: "execute" }],
			roleInheritances: []
		};

		const startResult = await startServer({
			...baseAuthEnvVars,
			TWIN_PORT: port.toString(),
			TWIN_AUTHORIZATION_MODEL: JSON.stringify(customRules),
			TWIN_AUTHORIZATION_MODEL_MODE: "merge"
		});
		expect(startResult).toBeDefined();
		if (!startResult) {
			return;
		}

		const authType = startResult.engine.getRegisteredInstanceType("authorizationComponent");
		const authComponent = ComponentFactory.get<IAuthorizationComponent>(authType);
		const platformType = startResult.engine.getRegisteredInstanceType("platformComponent");
		const platformComponent = ComponentFactory.get<IPlatformComponent>(platformType);
		const nodeContextIds = startResult.engine.getContextIds() ?? {};

		const routes = startResult.server.getRestRoutes();
		const protectedRoute = routes.find(r => r.defaultAuthorization && r.operationId);
		expect(protectedRoute).toBeDefined();
		if (!protectedRoute) {
			return;
		}

		await ContextIdStore.run(nodeContextIds, async () => {
			await platformComponent.execute(async () => {
				const { entities: policies } = await authComponent.getAllPolicies(
					AUTHORIZATION_MODEL_ID,
					undefined,
					undefined,
					1000
				);

				const hasCustomPolicy = policies.some(
					p => p.subject === "custom-role" && p.object === "custom-op"
				);
				expect(hasCustomPolicy).toBe(true);

				const auth = protectedRoute.defaultAuthorization;
				const operationId = protectedRoute.operationId;
				if (auth && operationId) {
					const hasRoutePolicy = policies.some(
						p => p.subject === auth.permission && p.object === operationId
					);
					expect(hasRoutePolicy).toBe(true);
				}
			});
		});

		await startResult.shutdown();
	}, 30000);
});
