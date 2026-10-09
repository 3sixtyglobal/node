// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CLIDisplay } from "@3sixty/cli-core";
import { I18n } from "@3sixty/core";
import { ModuleHelper, ModuleResolutionHelper } from "@3sixty/modules";
import { DEPRECATED_ENVIRONMENT_VARIABLE_KEYS } from "../src/models/deprecatedEnvironmentVariableKeys.js";
import type { INodeOptions } from "../src/models/INodeOptions.js";
import {
	loadEnvironmentVariables,
	overrideModuleImport,
	processEnvironmentVariables
} from "../src/node.js";

vi.mock("../src/builders/engineEnvBuilder.js", () => ({
	buildEngineConfiguration: vi.fn().mockResolvedValue({ types: {} })
}));

vi.mock("../src/builders/engineServerEnvBuilder.js", () => ({
	buildEngineServerConfiguration: vi.fn().mockResolvedValue({ types: {} })
}));

vi.mock("../src/builders/extensionsBuilder.js", () => ({
	extensionsConfiguration: vi.fn().mockImplementation(async (e: unknown, cfg: unknown) => cfg)
}));

const ENV_PREFIX = "TWIN_";

/**
 * Load and process the env vars in the same way as the node.
 * @param processEnv The process environment variables.
 * @param options The node options.
 * @returns The processed env vars.
 */
async function buildEnvVars(
	processEnv: { [id: string]: string },
	options: INodeOptions
): Promise<{ nodeEnvVars: Awaited<ReturnType<typeof processEnvironmentVariables>> }> {
	return {
		nodeEnvVars: await processEnvironmentVariables(
			loadEnvironmentVariables(processEnv, options),
			options
		)
	};
}
describe("node", () => {
	let tempDir: string;

	beforeAll(async () => {
		tempDir = await mkdtemp(path.join(tmpdir(), "twin-node-test-"));
	});

	afterAll(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("Can load and process environment variables", () => {
		test("env vars from processEnv appear in nodeEnvVars", async () => {
			const envFile = path.join(tempDir, ".env.basic");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_PORT: "4000", TWIN_DEBUG: "true" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect(nodeEnvVars.port).toBe("4000");
			expect(nodeEnvVars.debug).toBe("true");
		});

		test("native modules env var is recognised", async () => {
			const envFile = path.join(tempDir, ".env.native-modules");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_NATIVE_MODULES: "node:buffer, node:crypto" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect(nodeEnvVars.nativeModules).toBe("node:buffer, node:crypto");
		});

		test("processEnv value takes precedence over same key in env file", async () => {
			const envFile = path.join(tempDir, ".env.precedence");
			await writeFile(envFile, "TWIN_PORT=9999\n");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_PORT: "4000" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect(nodeEnvVars.port).toBe("4000");
		});

		test("env file fills in values absent from processEnv", async () => {
			const envFile = path.join(tempDir, ".env.fill");
			await writeFile(envFile, "TWIN_PORT=7777\n");

			const { nodeEnvVars } = await buildEnvVars(
				{},
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect(nodeEnvVars.port).toBe("7777");
		});

		test("processEnv wins over values from multiple env files", async () => {
			const envFile1 = path.join(tempDir, ".env.multi1");
			const envFile2 = path.join(tempDir, ".env.multi2");
			await writeFile(envFile1, "TWIN_PORT=1111\n");
			await writeFile(envFile2, "TWIN_PORT=2222\n");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_PORT: "8080" },
				{
					envFilenames: [envFile1, envFile2],
					envPrefix: ENV_PREFIX,
					executionDirectory: tempDir
				}
			);

			expect(nodeEnvVars.port).toBe("8080");
		});

		test("multiple env files each contribute distinct keys", async () => {
			const envFile1 = path.join(tempDir, ".env.distinct1");
			const envFile2 = path.join(tempDir, ".env.distinct2");
			await writeFile(envFile1, "TWIN_PORT=3001\n");
			await writeFile(envFile2, "TWIN_DEBUG=true\n");

			const { nodeEnvVars } = await buildEnvVars(
				{},
				{
					envFilenames: [envFile1, envFile2],
					envPrefix: ENV_PREFIX,
					executionDirectory: tempDir
				}
			);

			expect(nodeEnvVars.port).toBe("3001");
			expect(nodeEnvVars.debug).toBe("true");
		});

		test("missing custom env file throws an error", async () => {
			const missingFile = path.join(tempDir, "does-not-exist.env");

			await expect(
				buildEnvVars(
					{},
					{ envFilenames: [missingFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).rejects.toThrow();
		});

		test("missing default .env file does not throw", async () => {
			// When envFilenames is omitted, loadEnvironmentVariables defaults to .env in executionDirectory.
			// A missing default file is silently ignored (defaultEnvOnly path).
			await expect(
				buildEnvVars({ TWIN_PORT: "3000" }, { executionDirectory: tempDir, envPrefix: ENV_PREFIX })
			).resolves.toBeDefined();
		});

		test("@text: value is expanded to the contents of the referenced file", async () => {
			await writeFile(path.join(tempDir, "secret.txt"), "my-secret-value");
			const envFile = path.join(tempDir, ".env.textref");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_VAULT_PREFIX: "@text:secret.txt" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect(nodeEnvVars.vaultPrefix).toBe("my-secret-value");
		});

		test("@json: value is expanded to a parsed JSON object from the referenced file", async () => {
			await writeFile(
				path.join(tempDir, "config.json"),
				JSON.stringify({ key: "value", count: 42 })
			);
			const envFile = path.join(tempDir, ".env.jsonref");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_VAULT_PREFIX: "@json:config.json" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect((nodeEnvVars as { [key: string]: unknown }).vaultPrefix).toEqual({
				key: "value",
				count: 42
			});
		});

		test("extendEnvVars callback can override values after loading", async () => {
			const envFile = path.join(tempDir, ".env.extend");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_PORT: "3000" },
				{
					envFilenames: [envFile],
					envPrefix: ENV_PREFIX,
					executionDirectory: tempDir,
					extendEnvVars: async envVars => {
						(envVars as { [key: string]: unknown }).port = "5555";
					}
				}
			);

			expect(nodeEnvVars.port).toBe("5555");
		});

		test("envPrefix filters out vars that do not match the prefix", async () => {
			const envFile = path.join(tempDir, ".env.prefix");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildEnvVars(
				{ TWIN_PORT: "3000", OTHER_VAR: "should-not-appear" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
			);

			expect(nodeEnvVars.port).toBe("3000");
			expect((nodeEnvVars as { [key: string]: unknown }).otherVar).toBeUndefined();
		});

		test("throws on an unrecognised TWIN_* variable in strict mode (default)", async () => {
			const envFile = path.join(tempDir, ".env.strict-throw");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{ TWIN_HEALTH_CHECK_STARTUP_INTERVAL: "500" },
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).rejects.toMatchObject({
				source: "EnvHelper",
				message: expect.stringContaining("unknownEnvVars"),
				properties: { keys: expect.stringContaining("TWIN_HEALTH_CHECK_STARTUP_INTERVAL") }
			});
		});

		test("warns but does not throw on an unrecognised TWIN_* variable when TWIN_STRICT_ENV=warn", async () => {
			const envFile = path.join(tempDir, ".env.strict-warn");
			await writeFile(envFile, "");
			const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
			const formatSpy = vi.spyOn(I18n, "formatMessage");

			try {
				await buildEnvVars(
					{ TWIN_HEALTH_CHECK_STARTUP_INTERVAL: "500", TWIN_STRICT_ENV: "warn" },
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				);
				expect(formatSpy).toHaveBeenCalledWith(
					"warn.node.unknownEnvVars",
					expect.objectContaining({
						keys: expect.stringContaining("TWIN_HEALTH_CHECK_STARTUP_INTERVAL")
					})
				);
				expect(warnSpy).toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
				formatSpy.mockRestore();
			}
		});

		test("warns and does not throw for the deprecated TWIN_MESSAGING_ENABLED", async () => {
			const envFile = path.join(tempDir, ".env.deprecated-messaging");
			await writeFile(envFile, "");
			const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
			const formatSpy = vi.spyOn(I18n, "formatMessage");

			try {
				await expect(
					buildEnvVars(
						{ TWIN_MESSAGING_ENABLED: "true" },
						{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
					)
				).resolves.toBeDefined();

				expect(formatSpy).toHaveBeenCalledWith("warn.node.deprecatedEnvVar", {
					key: "TWIN_MESSAGING_ENABLED",
					replacements:
						"TWIN_MESSAGING_EMAIL_CONNECTOR, TWIN_MESSAGING_SMS_CONNECTOR, TWIN_MESSAGING_PUSH_NOTIFICATION_CONNECTOR"
				});
				expect(warnSpy).toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
				formatSpy.mockRestore();
			}
		});

		test("warns and does not throw for the deprecated TWIN_DATA_PROCESSING_ENABLED", async () => {
			const envFile = path.join(tempDir, ".env.deprecated-data-processing");
			await writeFile(envFile, "");
			const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
			const formatSpy = vi.spyOn(I18n, "formatMessage");

			try {
				await expect(
					buildEnvVars(
						{ TWIN_DATA_PROCESSING_ENABLED: "true" },
						{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
					)
				).resolves.toBeDefined();

				expect(formatSpy).toHaveBeenCalledWith("warn.node.deprecatedEnvVar", {
					key: "TWIN_DATA_PROCESSING_ENABLED",
					replacements: "TWIN_DATA_CONVERTER_CONNECTORS, TWIN_DATA_EXTRACTOR_CONNECTORS"
				});
				expect(warnSpy).toHaveBeenCalled();
			} finally {
				warnSpy.mockRestore();
				formatSpy.mockRestore();
			}
		});

		test("warns without a replacement when a deprecated key has none", async () => {
			const envFile = path.join(tempDir, ".env.deprecated-no-replacement");
			await writeFile(envFile, "");
			const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
			const formatSpy = vi.spyOn(I18n, "formatMessage");
			const deprecated = DEPRECATED_ENVIRONMENT_VARIABLE_KEYS as Map<string, readonly string[]>;
			deprecated.set("withdrawnSetting", []);

			try {
				await expect(
					buildEnvVars(
						{ TWIN_WITHDRAWN_SETTING: "true" },
						{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
					)
				).resolves.toBeDefined();

				expect(formatSpy).toHaveBeenCalledWith("warn.node.deprecatedEnvVarNoReplacement", {
					key: "TWIN_WITHDRAWN_SETTING"
				});
				expect(warnSpy).toHaveBeenCalled();
			} finally {
				deprecated.delete("withdrawnSetting");
				warnSpy.mockRestore();
				formatSpy.mockRestore();
			}
		});

		test("does not throw for a variable listed in TWIN_ENV_ALLOW_LIST", async () => {
			const envFile = path.join(tempDir, ".env.allowlist");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{
						TWIN_MY_EXTENSION_SECRET: "value",
						TWIN_ENV_ALLOW_LIST: "TWIN_MY_EXTENSION_SECRET"
					},
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).resolves.toBeDefined();
		});

		test("throws on an invalid TWIN_STRICT_ENV value", async () => {
			const envFile = path.join(tempDir, ".env.strict-invalid");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{ TWIN_STRICT_ENV: "strict" },
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).rejects.toThrow();
		});

		test("does not flag variables that lack the TWIN_ prefix", async () => {
			const envFile = path.join(tempDir, ".env.no-prefix");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{ TWIN_PORT: "3000", OTHER_TOOL_SETTING: "any-value" },
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).resolves.toBeDefined();
		});

		test("does not throw for TWIN_REST_PATH_* variables", async () => {
			const envFile = path.join(tempDir, ".env.rest-path");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{
						TWIN_REST_PATH_TENANT_ADMIN: "my-tenants",
						TWIN_REST_PATH_IDENTITY: "id"
					},
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).resolves.toBeDefined();
		});

		test("throws for a TWIN_REST_* variable that does not match the restPath prefix", async () => {
			const envFile = path.join(tempDir, ".env.rest-route");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{ TWIN_REST_ROUTE_TENANT_ADMIN: "my-tenants" },
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).rejects.toMatchObject({
				source: "EnvHelper",
				message: expect.stringContaining("unknownEnvVars"),
				properties: { keys: expect.stringContaining("TWIN_REST_ROUTE_TENANT_ADMIN") }
			});
		});

		test("wildcard in TWIN_ENV_ALLOW_LIST accepts any matching variable", async () => {
			const envFile = path.join(tempDir, ".env.allowlist-wildcard");
			await writeFile(envFile, "");

			await expect(
				buildEnvVars(
					{
						TWIN_MY_EXT_SECRET: "value",
						TWIN_MY_EXT_API_KEY: "key",
						TWIN_ENV_ALLOW_LIST: "TWIN_MY_EXT_*"
					},
					{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir }
				)
			).resolves.toBeDefined();
		});

		describe("with a custom env prefix", () => {
			const CUSTOM_PREFIX = "MYAPP_";

			test("throws on an unrecognised variable in strict mode", async () => {
				const envFile = path.join(tempDir, ".env.custom-strict-throw");
				await writeFile(envFile, "");

				await expect(
					buildEnvVars(
						{ MYAPP_UNKNOWN_SETTING: "value" },
						{ envFilenames: [envFile], envPrefix: CUSTOM_PREFIX, executionDirectory: tempDir }
					)
				).rejects.toMatchObject({
					source: "EnvHelper",
					message: expect.stringContaining("unknownEnvVars"),
					properties: { keys: expect.stringContaining("MYAPP_UNKNOWN_SETTING") }
				});
			});

			test("warns but does not throw when MYAPP_STRICT_ENV=warn", async () => {
				const envFile = path.join(tempDir, ".env.custom-strict-warn");
				await writeFile(envFile, "");
				const warnSpy = vi.spyOn(CLIDisplay, "warning").mockImplementation(() => {});
				const formatSpy = vi.spyOn(I18n, "formatMessage");

				try {
					await buildEnvVars(
						{ MYAPP_UNKNOWN_SETTING: "value", MYAPP_STRICT_ENV: "warn" },
						{ envFilenames: [envFile], envPrefix: CUSTOM_PREFIX, executionDirectory: tempDir }
					);
					expect(formatSpy).toHaveBeenCalledWith(
						"warn.node.unknownEnvVars",
						expect.objectContaining({ keys: expect.stringContaining("MYAPP_UNKNOWN_SETTING") })
					);
					expect(warnSpy).toHaveBeenCalled();
				} finally {
					warnSpy.mockRestore();
					formatSpy.mockRestore();
				}
			});

			test("does not throw for a variable listed in MYAPP_ENV_ALLOW_LIST", async () => {
				const envFile = path.join(tempDir, ".env.custom-allowlist");
				await writeFile(envFile, "");

				await expect(
					buildEnvVars(
						{
							MYAPP_MY_EXTENSION_SECRET: "value",
							MYAPP_ENV_ALLOW_LIST: "MYAPP_MY_EXTENSION_SECRET"
						},
						{ envFilenames: [envFile], envPrefix: CUSTOM_PREFIX, executionDirectory: tempDir }
					)
				).resolves.toBeDefined();
			});
		});
	});

	describe("overrideModuleImport", () => {
		test("worker threads import local modules from the execution directory", async () => {
			await writeFile(
				path.join(tempDir, "workerModule.js"),
				"export function add(a, b) { return a + b; }"
			);

			overrideModuleImport(tempDir);

			await expect(
				ModuleHelper.execModuleMethodThread("./workerModule.js", "add", [2, 3])
			).resolves.toEqual(5);
		});

		describe("nested dependencies", () => {
			let hostDir: string;

			beforeAll(async () => {
				// The host only depends on host-dep, nested-dep is installed below host-dep and not hoisted.
				hostDir = path.join(tempDir, "nested-host");
				const hostDepDir = path.join(hostDir, "node_modules", "host-dep");
				const nestedDepDir = path.join(hostDepDir, "node_modules", "nested-dep");
				await mkdir(nestedDepDir, { recursive: true });
				await writeFile(
					path.join(hostDir, "package.json"),
					JSON.stringify({ name: "nested-host", dependencies: { "host-dep": "1.0.0" } })
				);
				await writeFile(
					path.join(hostDepDir, "package.json"),
					JSON.stringify({ name: "host-dep", dependencies: { "nested-dep": "1.0.0" } })
				);
				await writeFile(
					path.join(nestedDepDir, "package.json"),
					JSON.stringify({ name: "nested-dep", type: "module", main: "index.js" })
				);
				await writeFile(
					path.join(nestedDepDir, "index.js"),
					"export function multiply(a, b) { return a * b; }"
				);
			});

			test("worker threads import a package only installed as a nested dependency", async () => {
				overrideModuleImport(hostDir);

				await expect(
					ModuleHelper.execModuleMethodThread("nested-dep", "multiply", [2, 3])
				).resolves.toEqual(6);
			});

			test("main thread imports a package only installed as a nested dependency", async () => {
				overrideModuleImport(hostDir);

				const multiply = await ModuleHelper.getModuleEntry<(a: number, b: number) => number>(
					"nested-dep",
					"multiply"
				);
				expect(multiply(3, 4)).toEqual(12);
			});

			test("resolves a file URL to the module path", async () => {
				overrideModuleImport(hostDir);

				const modulePath = path.join(
					hostDir,
					"node_modules",
					"host-dep",
					"node_modules",
					"nested-dep",
					"index.js"
				);
				await expect(ModuleHelper.resolveModule(pathToFileURL(modulePath).href)).resolves.toEqual(
					ModuleResolutionHelper.createModuleImportUrl(modulePath)
				);
			});
		});
	});
});
