// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys } from "@3sixty/context";
import {
	AuthenticationComponentType,
	RestRouteProcessorType,
	SocketRouteProcessorType
} from "@3sixty/engine-server-types";
import { buildEngineServerConfiguration } from "../../src/builders/engineServerEnvBuilder.js";

const SERVER_INFO = { name: "test", version: "0.0.0" };
const BASE_VARS = { port: "3000" };

describe("buildEngineServerConfiguration - auth header processors", () => {
	test("mutex timeout default seeds the auth header token cache timeout", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				authProcessorType: AuthenticationComponentType.EntityStorage,
				mutexTimeoutDefault: "60000"
			},
			[],
			{ types: {} },
			SERVER_INFO
		);

		const processors = [
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.AuthHeader),
			config.types.socketRouteProcessor?.find(p => p.type === SocketRouteProcessorType.AuthHeader)
		];

		for (const processor of processors) {
			expect(
				(processor?.options as { config?: { tokenCacheMutexTimeoutMs?: number } })?.config
					?.tokenCacheMutexTimeoutMs
			).toBe(60000);
		}
	});
});

describe("buildEngineServerConfiguration - TenantOverride processors", () => {
	test("registers TenantOverride REST and socket processors when tenant mode and auth are enabled", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				authProcessorType: AuthenticationComponentType.EntityStorage
			},
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const socketTypes = (config.types.socketRouteProcessor ?? []).map(p => p.type);

		expect(restTypes).toContain(RestRouteProcessorType.TenantOverride);
		expect(socketTypes).toContain(SocketRouteProcessorType.TenantOverride);
	});

	test("TenantOverride processor is registered after AuthHeader processor", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				authProcessorType: AuthenticationComponentType.EntityStorage
			},
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const authHeaderIdx = restTypes.indexOf(RestRouteProcessorType.AuthHeader);
		const tenantOverrideIdx = restTypes.indexOf(RestRouteProcessorType.TenantOverride);

		expect(authHeaderIdx).toBeGreaterThanOrEqual(0);
		expect(tenantOverrideIdx).toBeGreaterThan(authHeaderIdx);
	});

	test("does not register TenantOverride processors when tenant mode is disabled", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, authProcessorType: AuthenticationComponentType.EntityStorage },
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const socketTypes = (config.types.socketRouteProcessor ?? []).map(p => p.type);

		expect(restTypes).not.toContain(RestRouteProcessorType.TenantOverride);
		expect(socketTypes).not.toContain(SocketRouteProcessorType.TenantOverride);
	});

	test("does not register TenantOverride processors when auth processor is not configured", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, tenantEnabled: "true" },
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const socketTypes = (config.types.socketRouteProcessor ?? []).map(p => p.type);

		expect(restTypes).not.toContain(RestRouteProcessorType.TenantOverride);
		expect(socketTypes).not.toContain(SocketRouteProcessorType.TenantOverride);
	});
});

describe("buildEngineServerConfiguration - auth context keys", () => {
	test("registers DID context keys and auth component when authProcessorType is set", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				authProcessorType: AuthenticationComponentType.EntityStorage
			},
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const keys = contextKeys.map(k => k.key);
		expect(keys).toContain(ContextIdKeys.Organization);
		expect(keys).toContain(ContextIdKeys.User);
		expect(config.types.authenticationComponent).toBeDefined();
	});

	test("does not register auth component when authProcessorType is not set", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS },
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const keys = contextKeys.map(k => k.key);
		expect(keys).not.toContain(ContextIdKeys.User);
		expect(config.types.authenticationComponent).toBeUndefined();
	});
});

describe("buildEngineServerConfiguration - custom web config", () => {
	test("defaults the Fastify plugin timeout to 30000 when the env var is not set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.customWebConfig).toEqual({ pluginTimeout: 30000 });
	});

	test("uses the Fastify plugin timeout from the env var when set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, fastifyPluginTimeout: "60000" },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.customWebConfig).toEqual({ pluginTimeout: 60000 });
	});

	test("throws when the Fastify plugin timeout is not an integer", async () => {
		await expect(
			buildEngineServerConfiguration(
				{ ...BASE_VARS, fastifyPluginTimeout: "not-a-number" },
				[],
				{ types: {} },
				SERVER_INFO
			)
		).rejects.toThrow("invalidEnvVarValue");
	});
});
