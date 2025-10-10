// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { execSync } from "node:child_process";
import path from "node:path";
import type { IServerInfo } from "@twin.org/api-models";
import { CLIDisplay } from "@twin.org/cli-core";
import { Coerce, EnvHelper, GeneralError, Is } from "@twin.org/core";
import { ModuleHelper } from "@twin.org/modules";
import * as dotenv from "dotenv";
import { buildEngineConfiguration } from "./builders/engineEnvBuilder";
import { buildEngineServerConfiguration } from "./builders/engineServerEnvBuilder";
import { extensionsConfiguration } from "./builders/extensionsBuilder";
import type { INodeEngineConfig } from "./models/INodeEngineConfig";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables";
import type { INodeOptions } from "./models/INodeOptions";
import { ModuleProtocol } from "./models/moduleProtocol";
import { start } from "./server";
import {
	createModuleImportUrl,
	fileExists,
	getExecutionDirectory,
	handleHttpsProtocol,
	handleNpmProtocol,
	initialiseLocales,
	loadJsonFile,
	loadTextFile,
	parseModuleProtocol,
	getExtensionsCacheDir,
	resolvePackageEntryPoint
} from "./utils";

const moduleCache: { [id: string]: unknown } = {};

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
			version: nodeOptions?.serverVersion ?? "0.0.2-next.26" // x-release-please-version
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
			// So we can safely disable the linting rule here.
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
					CLIDisplay.value("Terminate Signal", signal);
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
 * Override module imports to support protocol-based loading (npm:, https:) and local files.
 * @param executionDirectory The execution directory for resolving local module paths.
 * @param envVars The environment variables containing extension configuration (optional, uses defaults if not provided).
 */
export function overrideModuleImport(
	executionDirectory: string,
	envVars?: INodeEnvironmentVariables
): void {
	const maxSizeMb = Coerce.number(envVars?.extensionsMaxSizeMb) ?? 10;
	const cacheDirectory = envVars?.extensionsCacheDirectory;

	ModuleHelper.overrideImport(async moduleName => {
		if (moduleCache[moduleName]) {
			return {
				module: moduleCache[moduleName],
				useDefault: false
			};
		}

		const parsed = parseModuleProtocol(moduleName);
		let resolvedPath: string | undefined;

		switch (parsed.protocol) {
			case ModuleProtocol.Npm: {
				const result = await handleNpmProtocol(
					parsed.identifier,
					executionDirectory,
					cacheDirectory
				);
				resolvedPath = result.resolvedPath;
				break;
			}

			case ModuleProtocol.Https: {
				const result = await handleHttpsProtocol(
					parsed.identifier,
					executionDirectory,
					maxSizeMb,
					cacheDirectory,
					envVars?.extensionsCacheTtlHours,
					envVars?.extensionsForceRefresh
				);
				resolvedPath = result.resolvedPath;
				break;
			}

			case ModuleProtocol.Http: {
				throw new GeneralError("node", "insecureProtocol", { protocol: ModuleProtocol.Http });
			}

			case ModuleProtocol.Local: {
				let localFilename = path.resolve(moduleName);

				let exists = await fileExists(localFilename);
				if (!exists) {
					localFilename = path.resolve(executionDirectory, moduleName);
					exists = await fileExists(localFilename);
				}

				if (exists) {
					resolvedPath = localFilename;
				}
				break;
			}

			case ModuleProtocol.Default: {
				try {
					const npmRoot = execSync("npm root").toString().trim().replace(/\\/g, "/");
					const packagePath = path.resolve(npmRoot, moduleName);
					const mainFile = await resolvePackageEntryPoint(packagePath, moduleName);
					const modulePath = path.resolve(packagePath, mainFile);
					const exists = await fileExists(modulePath);
					if (exists) {
						resolvedPath = modulePath;
						break;
					}
				} catch {
					// Continue to fallback resolution
				}

				// Fallback: resolve from npm protocol cache directory (installed via handleNpmProtocol)
				try {
					const cacheNpmRoot = path.resolve(
						getExtensionsCacheDir(executionDirectory, ModuleProtocol.Npm, cacheDirectory),
						"node_modules"
					);

					const packagePath = path.resolve(cacheNpmRoot, moduleName);
					const mainFile = await resolvePackageEntryPoint(packagePath, moduleName);
					const modulePath = path.resolve(packagePath, mainFile);
					const exists = await fileExists(modulePath);
					if (exists) {
						resolvedPath = modulePath;
					}
				} catch {
					// No cached resolution either; fall through
				}
				break;
			}
		}

		// Common module loading and caching logic
		if (resolvedPath) {
			const module = await import(createModuleImportUrl(resolvedPath));
			moduleCache[moduleName] = module;
			return {
				module,
				useDefault: false
			};
		}

		return {
			module: undefined,
			useDefault: true
		};
	});
}
