// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys } from "@twin.org/context";
import {
	AuthenticationComponentType,
	RestRouteProcessorType,
	SocketRouteProcessorType
} from "@twin.org/engine-server-types";
import { buildEngineServerConfiguration } from "../../src/builders/engineServerEnvBuilder.js";

const SERVER_INFO = { name: "test", version: "0.0.0" };
const BASE_VARS = { port: "3000" };

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

describe("buildEngineServerConfiguration - body limits", () => {
	test("builds bodyLimits from the comma separated name=bytes pairs", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, httpBodyLimits: "default=2048,large=26214400" },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.bodyLimits).toEqual({ default: 2048, large: 26214400 });
	});

	test("leaves bodyLimits undefined when the env var is not set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.bodyLimits).toBeUndefined();
	});

	test("trims whitespace and ignores empty entries in the name=bytes pairs", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, httpBodyLimits: " default = 2048 ,, large=26214400 ," },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.bodyLimits).toEqual({ default: 2048, large: 26214400 });
	});

	test.each([
		["no separator", "large", "large"],
		["an empty name", "=2048", "=2048"],
		["more than one separator", "large=1=2", "large=1=2"],
		["a non numeric byte value", "large=abc", "large=abc"],
		["a non integer byte value", "large=1.5", "large=1.5"],
		["a duplicate name", "large=1,large=2", "large=2"]
	])(
		"throws naming the env var and the entry when an entry has %s",
		async (shape, httpBodyLimits, entry) => {
			await expect(
				buildEngineServerConfiguration(
					{ ...BASE_VARS, httpBodyLimits },
					[],
					{ types: {} },
					SERVER_INFO
				)
			).rejects.toMatchObject({
				name: "GeneralError",
				source: "node",
				message: expect.stringContaining("invalidEnvVarPair"),
				properties: { key: "httpBodyLimits", value: entry }
			});
		}
	);
});
