// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys } from "@twin.org/context";
import { AuthenticationComponentType } from "@twin.org/engine-server-types";
import { buildEngineServerConfiguration } from "../../src/builders/engineServerEnvBuilder.js";

const SERVER_INFO = { name: "test", version: "0.0.0" };
const BASE_VARS = { port: "3000" };

describe("buildEngineServerConfiguration — auth context keys", () => {
	test("registers DID context keys and auth component when nodeIdentityEnabled is true", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				authProcessorType: AuthenticationComponentType.EntityStorage,
				nodeIdentityEnabled: "true"
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

	test("registers auth component but skips DID context keys when nodeIdentityEnabled is false", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				authProcessorType: AuthenticationComponentType.EntityStorage,
				nodeIdentityEnabled: "false"
			},
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const keys = contextKeys.map(k => k.key);
		expect(keys).not.toContain(ContextIdKeys.Organization);
		expect(keys).not.toContain(ContextIdKeys.User);
		expect(config.types.authenticationComponent).toBeDefined();
	});

	test("does not register auth component when authProcessorType is not set", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, nodeIdentityEnabled: "false" },
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const keys = contextKeys.map(k => k.key);
		expect(keys).not.toContain(ContextIdKeys.Organization);
		expect(keys).not.toContain(ContextIdKeys.User);
		expect(config.types.authenticationComponent).toBeUndefined();
	});
});
