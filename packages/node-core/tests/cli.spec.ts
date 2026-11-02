// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { mkdir, rm, writeFile } from "node:fs/promises";
import {
	constructCliCommand,
	parseCommandLineArgs,
	processEnvOptions,
	registerCommands
} from "../src/cli.js";

const OUTPUT_TMP_DIR = "tests/.tmp/cli-parse/";

describe("cli", () => {
	beforeAll(async () => {
		registerCommands();
		await mkdir(OUTPUT_TMP_DIR, { recursive: true });
	});

	afterAll(async () => {
		await rm(OUTPUT_TMP_DIR, { recursive: true, force: true });
	});

	test("parses the options after the node and script paths", () => {
		expect(
			parseCommandLineArgs(["node", "index.js", "user-get", "--email=a=b@example.com", "--help"])
		).toEqual({
			nodePath: "node",
			scriptPath: "index.js",
			options: [
				{ key: "user-get", value: "" },
				{ key: "email", value: "a=b@example.com" },
				{ key: "--help", value: "" }
			]
		});
		expect(parseCommandLineArgs(["node", "index.js"]).options).toBeUndefined();
	});

	test("returns no command without options or with only an env prefix", () => {
		expect(constructCliCommand({}, parseCommandLineArgs(["node", "index.js"]))).toBeUndefined();
		expect(
			constructCliCommand({}, parseCommandLineArgs(["node", "index.js", "--env-prefix=TWIN_"]))
		).toBeUndefined();
	});

	test("builds the parameters of a command, with defaults and camel cased keys", () => {
		const command = constructCliCommand(
			{},
			parseCommandLineArgs([
				"node",
				"index.js",
				"user-create",
				"--user-identity=did:entity-storage:0x01",
				"--organization-identity=did:entity-storage:0x02",
				"--email=User@Example.com",
				"--output-env-prefix=user"
			])
		);

		expect(command?.definition.command).toBe("user-create");
		expect(command?.params).toEqual({
			userIdentity: "did:entity-storage:0x01",
			organizationIdentity: "did:entity-storage:0x02",
			email: "User@Example.com",
			overwriteMode: "skip",
			outputEnvPrefix: "USER_"
		});
	});

	test("shows the help of a command, or of every command", () => {
		expect(
			constructCliCommand({}, parseCommandLineArgs(["node", "index.js", "user-get", "--help"]))
		).toMatchObject({ definition: { command: "help" }, params: { command: "user-get" } });
		expect(
			constructCliCommand({}, parseCommandLineArgs(["node", "index.js", "--help"]))
		).toMatchObject({ definition: { command: "help" }, params: {} });
	});

	test("resolves a deprecated alias to its command", () => {
		expect(
			constructCliCommand({}, parseCommandLineArgs(["node", "index.js", "bootstrap-legacy"]))
				?.definition.command
		).toBe("bootstrap-dev");
	});

	test("fails for an unknown command, a missing parameter or an extra parameter", () => {
		expect(() =>
			constructCliCommand({}, parseCommandLineArgs(["node", "index.js", "no-such-command"]))
		).toThrow("cliCommandMissing");
		expect(() =>
			constructCliCommand({}, parseCommandLineArgs(["node", "index.js", "user-get"]))
		).toThrow("cliCommandParamMissing");
		expect(() =>
			constructCliCommand(
				{},
				parseCommandLineArgs(["node", "index.js", "user-get", "--email=a@b.com", "--unknown=1"])
			)
		).toThrow("cliCommandParamExtra");
	});

	test("substitutes parameters from the environment and from loaded env files", async () => {
		const envFile = `${OUTPUT_TMP_DIR}user.env`;
		await writeFile(envFile, 'USER_EMAIL="loaded@example.com"\n');
		const processEnv: { [id: string]: string } = { TENANT: "0123456789abcdef0123456789abcdef" };

		const command = constructCliCommand(
			processEnv,
			parseCommandLineArgs([
				"node",
				"index.js",
				"user-get",
				`--load-env=${envFile}`,
				"--email=!USER_EMAIL",
				"--tenant-id=!TENANT"
			])
		);

		expect(processEnv.USER_EMAIL).toBe("loaded@example.com");
		expect(command?.params).toMatchObject({
			email: "loaded@example.com",
			tenantId: "0123456789abcdef0123456789abcdef"
		});
	});

	test("fails when a substituted variable or an env file is missing", () => {
		expect(() =>
			constructCliCommand(
				{},
				parseCommandLineArgs(["node", "index.js", "user-get", "--email=!NOT_SET"])
			)
		).toThrow("cliEnvVarMissing");
		expect(() =>
			processEnvOptions({}, [{ key: "load-env", value: `${OUTPUT_TMP_DIR}missing.env` }])
		).toThrow();
	});
});
