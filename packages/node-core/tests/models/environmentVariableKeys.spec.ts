// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { EnvHelper } from "@3sixty/core";
import { BOOTSTRAP_DEV_ENVIRONMENT_VARIABLE_KEYS } from "../../src/models/bootstrapDevEnvironmentVariableKeys.js";
import { ENGINE_ENVIRONMENT_VARIABLE_KEYS } from "../../src/models/engineEnvironmentVariableKeys.js";
import { ENGINE_SERVER_ENVIRONMENT_VARIABLE_KEYS } from "../../src/models/engineServerEnvironmentVariableKeys.js";
import { NODE_ENVIRONMENT_VARIABLE_KEYS } from "../../src/models/nodeEnvironmentVariableKeys.js";

describe("environment variable keys", () => {
	test.each([
		{ name: "engine", keys: ENGINE_ENVIRONMENT_VARIABLE_KEYS },
		{ name: "engine server", keys: ENGINE_SERVER_ENVIRONMENT_VARIABLE_KEYS },
		{ name: "node", keys: NODE_ENVIRONMENT_VARIABLE_KEYS },
		{ name: "bootstrap dev", keys: BOOTSTRAP_DEV_ENVIRONMENT_VARIABLE_KEYS }
	])("names every $name key so it has one environment variable name", ({ keys }) => {
		// A capital that follows another, such as in authOAuthSuccessRedirectUrl, makes a one letter part,
		// TWIN_AUTH_O_AUTH_..., while TWIN_AUTH_OAUTH_... reads back as another key, so neither works.
		const ambiguous = [...keys]
			.filter(key => !key.endsWith("*"))
			.filter(key =>
				EnvHelper.jsonKeyToEnvVarKey(key)
					.split("_")
					.some(part => part.length === 1)
			);

		expect(ambiguous).toEqual([]);
	});

	test("reads the OAuth sign in redirect addresses from their documented names", () => {
		const envVars = EnvHelper.envToJson<{ [key: string]: string }>(
			{
				TWIN_AUTH_OAUTH_SUCCESS_REDIRECT_URL: "https://app.example.com/",
				TWIN_AUTH_OAUTH_FAILURE_REDIRECT_URL: "https://app.example.com/login"
			},
			"TWIN_"
		);

		expect(envVars).toEqual({
			authOauthSuccessRedirectUrl: "https://app.example.com/",
			authOauthFailureRedirectUrl: "https://app.example.com/login"
		});
		for (const key of Object.keys(envVars)) {
			expect(ENGINE_SERVER_ENVIRONMENT_VARIABLE_KEYS.has(key)).toBe(true);
		}
	});
});
