// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import type { IServerInfo } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { EnvHelper, Is } from "@twin.org/core";
import { ModuleHelper } from "@twin.org/modules";
import * as dotenv from "dotenv";
import { buildEngineConfiguration } from "./builders/engineEnvBuilder";
import { buildEngineServerConfiguration } from "./builders/engineServerEnvBuilder";
import { extensionsConfiguration } from "./builders/extensionsBuilder";
import type { INodeEngineConfig } from "./models/INodeEngineConfig";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables";
import type { INodeOptions } from "./models/INodeOptions";
import { start } from "./server";
import {
	fileExists,
	getExecutionDirectory,
	initialiseLocales,
	loadJsonFile,
	loadTextFile
} from "./utils";

/**
 * Run the TWIN Node server.
 * @param nodeOptions Optional configuration options for running the server.
 * @returns A promise that resolves when the server is started.
 */
export async function run(nodeOptions?: INodeOptions): Promise<void> {
	try {
		nodeOptions ??= {};

		const serverInfo: IServerInfo = {
			name: nodeOptions?.serverName ?? "TWIN Node Server",
			version: nodeOptions?.serverVersion ?? "0.0.2-next.19" // x-release-please-version
		};

		CLIDisplay.header(serverInfo.name, serverInfo.version, "🌩️ ");

		if (!Is.stringValue(nodeOptions?.executionDirectory)) {
			nodeOptions.executionDirectory = getExecutionDirectory();
		}
		CLIDisplay.value("Execution Directory", nodeOptions.executionDirectory);

		nodeOptions.localesDirectory =
			nodeOptions?.localesDirectory ??
			path.resolve(path.join(nodeOptions.executionDirectory, "dist", "locales"));
		CLIDisplay.value("Locales Directory", nodeOptions.localesDirectory);

		await initialiseLocales(nodeOptions.localesDirectory);

		if (Is.empty(nodeOptions?.openApiSpecFile)) {
			const specFile = path.resolve(
				path.join(nodeOptions.executionDirectory ?? "", "docs", "open-api", "spec.json")
			);
			CLIDisplay.value("Default OpenAPI Spec File", specFile);
			if (await fileExists(specFile)) {
				nodeOptions ??= {};
				nodeOptions.openApiSpecFile = specFile;
			}
		} else {
			CLIDisplay.value("OpenAPI Spec File", nodeOptions.openApiSpecFile);
		}

		if (Is.empty(nodeOptions?.favIconFile)) {
			const favIconFile = path.resolve(
				path.join(nodeOptions.executionDirectory ?? "", "static", "favicon.png")
			);
			CLIDisplay.value("Default Favicon File", favIconFile);
			if (await fileExists(favIconFile)) {
				nodeOptions ??= {};
				nodeOptions.favIconFile = favIconFile;
			}
		} else {
			CLIDisplay.value("Favicon File", nodeOptions.favIconFile);
		}

		nodeOptions.envPrefix ??= "TWIN_NODE_";
		CLIDisplay.value("Environment Variable Prefix", nodeOptions.envPrefix);

		overrideModuleImport(nodeOptions.executionDirectory ?? "");

		const { nodeEngineConfig, nodeEnvVars: envVars } = await buildConfiguration(
			// This is the only location in the code base that should access process.env directly
			// eslint-disable-next-line no-restricted-syntax
			process.env as {
				[id: string]: string;
			},
			nodeOptions,
			serverInfo
		);

		CLIDisplay.break();
		const startResult = await start(nodeOptions, nodeEngineConfig, envVars);

		if (!Is.empty(startResult)) {
			for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"]) {
				process.on(signal, async () => {
					await startResult.shutdown();
				});
			}
		}
	} catch (err) {
		CLIDisplay.error(err);
		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}
}

/**
 * Build the configuration for the TWIN Node server.
 * @param processEnv The environment variables from the process.
 * @param options The options for running the server.
 * @param serverInfo The server information.
 * @returns A promise that resolves to the engine server configuration, environment prefix, environment variables,
 * and options.
 */
export async function buildConfiguration(
	processEnv: {
		[id: string]: string;
	},
	options: INodeOptions,
	serverInfo: IServerInfo
): Promise<{
	nodeEnvVars: INodeEnvironmentVariables & { [id: string]: string | unknown };
	nodeEngineConfig: INodeEngineConfig;
}> {
	let defaultEnvOnly = false;
	if (Is.empty(options?.envFilenames)) {
		const envFile = path.resolve(path.join(options.executionDirectory ?? "", ".env"));
		CLIDisplay.value("Default Environment File", envFile);
		options ??= {};
		options.envFilenames = [envFile];
		defaultEnvOnly = true;
	}

	if (Is.arrayValue(options?.envFilenames)) {
		const output = dotenv.config({
			path: options?.envFilenames,
			quiet: true
		});

		// We don't want to throw an error if the default environment file is not found.
		// Only if we have custom environment files.
		if (!defaultEnvOnly && output.error) {
			throw output.error;
		}

		if (Is.objectValue(output.parsed)) {
			Object.assign(processEnv, output.parsed);
		}
	}

	const envVars = EnvHelper.envToJson<{ [id: string]: string | unknown }>(
		processEnv,
		options.envPrefix ?? ""
	);

	// Expand any environment variables that use the @file: syntax
	const keys = Object.keys(envVars);
	for (const key of keys) {
		if (
			Is.stringValue(envVars[key]) &&
			(envVars[key].startsWith("@text:") || envVars[key].startsWith("@json:"))
		) {
			const filePath = envVars[key].slice(6).trim();
			const embeddedFile = path.resolve(path.join(options.executionDirectory ?? "", filePath));

			if (envVars[key].startsWith("@text:")) {
				CLIDisplay.value(`Expanding Environment Variable: ${key} from text file`, embeddedFile);
				envVars[key] = await loadTextFile(embeddedFile);
			} else if (envVars[key].startsWith("@json:")) {
				CLIDisplay.value(`Expanding Environment Variable: ${key} from JSON file`, embeddedFile);
				envVars[key] = await loadJsonFile(embeddedFile);
			}
		}
	}

	// Extend the environment variables with any additional custom configuration.
	if (Is.function(options?.extendEnvVars)) {
		CLIDisplay.task("Extending Environment Variables");
		await options.extendEnvVars(envVars);
	}

	// Build the engine configuration from the environment variables.
	const coreConfig = await buildEngineConfiguration(envVars);
	const engineServerConfig = await buildEngineServerConfiguration(
		envVars,
		coreConfig,
		serverInfo,
		options?.openApiSpecFile,
		options?.favIconFile
	);

	// Merge any custom configuration provided in the options.
	if (Is.arrayValue(options?.configFilenames)) {
		for (const configFile of options.configFilenames) {
			CLIDisplay.value("Loading Configuration File", configFile);
			const configFilePath = path.resolve(path.join(options.executionDirectory ?? "", configFile));
			const config = await loadJsonFile(configFilePath);
			Object.assign(engineServerConfig, config);
		}
	}

	if (Is.objectValue(options?.config)) {
		CLIDisplay.task("Merging Custom Configuration");
		Object.assign(engineServerConfig, options.config);
	}

	// Merge any custom configuration provided in the options.
	if (Is.function(options?.extendConfig)) {
		CLIDisplay.task("Extending Configuration");
		await options.extendConfig(envVars, engineServerConfig);
	}

	const nodeEngineConfig = await extensionsConfiguration(envVars, engineServerConfig);

	return { nodeEngineConfig, nodeEnvVars: envVars };
}

/**
 * Override module imports to use local files where possible.
 * @param executionDirectory The execution directory for resolving local module paths.
 */
export function overrideModuleImport(executionDirectory: string): void {
	ModuleHelper.overrideImport(async moduleName => {
		// If the module path for example when dynamically loading
		// modules looks like a local file then we try to resolve
		// using the local file system
		const isLocal = ModuleHelper.isLocalModule(moduleName);
		if (isLocal) {
			// See if we can just resolve the filename locally
			let localFilename = path.resolve(moduleName);

			let exists = await fileExists(localFilename);
			if (!exists) {
				// Doesn't exist in the current directory, try the execution directory
				localFilename = path.resolve(executionDirectory, moduleName);
				exists = await fileExists(localFilename);
			}

			if (exists) {
				// If the module exists then we can load it, otherwise
				// we fallback to regular handling to see if that can import it
				return {
					module: await import(
						process.platform === "win32" ? `file://${localFilename}` : localFilename
					),
					useDefault: false
				};
			}
		}

		// The filename doesn't look like a local module, so just use default handling
		return {
			useDefault: true
		};
	});
}
