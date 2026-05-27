// Copyright 2025 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { IServerInfo } from "@twin.org/api-models";
import { buildConfiguration } from "../src/node.js";

vi.mock("../src/builders/engineEnvBuilder.js", () => ({
	buildEngineConfiguration: vi.fn().mockResolvedValue({ types: {} })
}));

vi.mock("../src/builders/engineServerEnvBuilder.js", () => ({
	buildEngineServerConfiguration: vi.fn().mockResolvedValue({ types: {} })
}));

vi.mock("../src/builders/extensionsBuilder.js", () => ({
	extensionsConfiguration: vi.fn().mockImplementation(async (e: unknown, cfg: unknown) => cfg)
}));

const SERVER_INFO: IServerInfo = { name: "test-node", version: "0.0.0" };
const ENV_PREFIX = "TWIN_";

describe("node", () => {
	let tempDir: string;

	beforeAll(async () => {
		tempDir = await mkdtemp(path.join(tmpdir(), "twin-node-test-"));
	});

	afterAll(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("Can buildConfiguration", () => {
		test("env vars from processEnv appear in nodeEnvVars", async () => {
			const envFile = path.join(tempDir, ".env.basic");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_PORT: "4000", TWIN_DEBUG: "true" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("4000");
			expect(nodeEnvVars.debug).toBe("true");
		});

		test("processEnv value takes precedence over same key in env file", async () => {
			const envFile = path.join(tempDir, ".env.precedence");
			await writeFile(envFile, "TWIN_PORT=9999\n");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_PORT: "4000" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("4000");
		});

		test("env file fills in values absent from processEnv", async () => {
			const envFile = path.join(tempDir, ".env.fill");
			await writeFile(envFile, "TWIN_PORT=7777\n");

			const { nodeEnvVars } = await buildConfiguration(
				{},
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("7777");
		});

		test("processEnv wins over values from multiple env files", async () => {
			const envFile1 = path.join(tempDir, ".env.multi1");
			const envFile2 = path.join(tempDir, ".env.multi2");
			await writeFile(envFile1, "TWIN_PORT=1111\n");
			await writeFile(envFile2, "TWIN_PORT=2222\n");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_PORT: "8080" },
				{
					envFilenames: [envFile1, envFile2],
					envPrefix: ENV_PREFIX,
					executionDirectory: tempDir
				},
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("8080");
		});

		test("multiple env files each contribute distinct keys", async () => {
			const envFile1 = path.join(tempDir, ".env.distinct1");
			const envFile2 = path.join(tempDir, ".env.distinct2");
			await writeFile(envFile1, "TWIN_PORT=3001\n");
			await writeFile(envFile2, "TWIN_DEBUG=true\n");

			const { nodeEnvVars } = await buildConfiguration(
				{},
				{
					envFilenames: [envFile1, envFile2],
					envPrefix: ENV_PREFIX,
					executionDirectory: tempDir
				},
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("3001");
			expect(nodeEnvVars.debug).toBe("true");
		});

		test("missing custom env file throws an error", async () => {
			const missingFile = path.join(tempDir, "does-not-exist.env");

			await expect(
				buildConfiguration(
					{},
					{ envFilenames: [missingFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
					SERVER_INFO
				)
			).rejects.toThrow();
		});

		test("missing default .env file does not throw", async () => {
			// When envFilenames is omitted, buildConfiguration defaults to .env in executionDirectory.
			// A missing default file is silently ignored (defaultEnvOnly path).
			await expect(
				buildConfiguration(
					{ TWIN_PORT: "3000" },
					{ executionDirectory: tempDir, envPrefix: ENV_PREFIX },
					SERVER_INFO
				)
			).resolves.toBeDefined();
		});

		test("@text: value is expanded to the contents of the referenced file", async () => {
			await writeFile(path.join(tempDir, "secret.txt"), "my-secret-value");
			const envFile = path.join(tempDir, ".env.textref");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_MY_SECRET: "@text:secret.txt" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
				SERVER_INFO
			);

			expect(nodeEnvVars.mySecret).toBe("my-secret-value");
		});

		test("@json: value is expanded to a parsed JSON object from the referenced file", async () => {
			await writeFile(
				path.join(tempDir, "config.json"),
				JSON.stringify({ key: "value", count: 42 })
			);
			const envFile = path.join(tempDir, ".env.jsonref");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_MY_CONFIG: "@json:config.json" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
				SERVER_INFO
			);

			expect(nodeEnvVars.myConfig).toEqual({ key: "value", count: 42 });
		});

		test("extendEnvVars callback can override values after loading", async () => {
			const envFile = path.join(tempDir, ".env.extend");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_PORT: "3000" },
				{
					envFilenames: [envFile],
					envPrefix: ENV_PREFIX,
					executionDirectory: tempDir,
					extendEnvVars: async envVars => {
						(envVars as { [key: string]: unknown }).port = "5555";
					}
				},
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("5555");
		});

		test("envPrefix filters out vars that do not match the prefix", async () => {
			const envFile = path.join(tempDir, ".env.prefix");
			await writeFile(envFile, "");

			const { nodeEnvVars } = await buildConfiguration(
				{ TWIN_PORT: "3000", OTHER_VAR: "should-not-appear" },
				{ envFilenames: [envFile], envPrefix: ENV_PREFIX, executionDirectory: tempDir },
				SERVER_INFO
			);

			expect(nodeEnvVars.port).toBe("3000");
			expect((nodeEnvVars as { [key: string]: unknown }).otherVar).toBeUndefined();
		});
	});
});
