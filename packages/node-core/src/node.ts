// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import type { IServerInfo } from "@twin.org/api-models";
import { CLIDisplay, CLIUtils } from "@twin.org/cli-core";
import { Coerce, EnvHelper, GeneralError, Guards, I18n, Is } from "@twin.org/core";
import type { Engine } from "@twin.org/engine";
import type { EngineServer } from "@twin.org/engine-server";
import type { IEngineServerConfig } from "@twin.org/engine-server-types";
import { ModuleHelper } from "@twin.org/modules";
import * as dotenv from "dotenv";
import { buildEngineConfiguration } from "./builders/engineEnvBuilder.js";
import { buildEngineServerConfiguration } from "./builders/engineServerEnvBuilder.js";
import { extensionsConfiguration } from "./builders/extensionsBuilder.js";
import { commaSeparatedListToArray } from "./builders/helper/envHelpers.js";
import { constructCliCommand, parseCommandLineArgs, registerCommands } from "./cli.js";
import { getEnvDefaults } from "./defaults.js";
import { BOOTSTRAP_DEV_ENVIRONMENT_VARIABLE_KEYS } from "./models/bootstrapDevEnvironmentVariableKeys.js";
import { DEPRECATED_ENVIRONMENT_VARIABLE_KEYS } from "./models/deprecatedEnvironmentVariableKeys.js";
import { ENGINE_ENVIRONMENT_VARIABLE_KEYS } from "./models/engineEnvironmentVariableKeys.js";
import { ENGINE_SERVER_ENVIRONMENT_VARIABLE_KEYS } from "./models/engineServerEnvironmentVariableKeys.js";
import type { IEnvironmentVariables } from "./models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "./models/INodeEngineConfig.js";
import type { INodeEngineState } from "./models/INodeEngineState.js";
import type { INodeOptions } from "./models/INodeOptions.js";
import { ModuleProtocol } from "./models/moduleProtocol.js";
import { NODE_ENVIRONMENT_VARIABLE_KEYS } from "./models/nodeEnvironmentVariableKeys.js";
import { start } from "./start.js";
import {
	createModuleImportUrl,
	fileExists,
	getExecutionDirectory,
	getExtensionsCacheDir,
	getScriptDirectory,
	handleHttpsProtocol,
	handleNpmProtocol,
	initialiseLocales,
	loadJsonFile,
	loadTextFile,
	parseModuleProtocol,
	resolvePackageEntryPoint
} from "./utils.js";

const moduleCache: { [id: string]: unknown } = {};

/**
 * Run the node.
 * @param nodeOptions Optional configuration options for running the server.
 * @param args Optional command line arguments.
 * @returns A promise that resolves when the server is started containing a shutdown method.
 */
export async function run(
	nodeOptions?: INodeOptions,
	args?: string[]
): Promise<
	| {
			engine: Engine<IEngineServerConfig, INodeEngineState>;
			server: EngineServer;
			shutdown: () => Promise<void>;
	  }
	| undefined
> {
	let showErrorDetails = true;
	let debugEnabled = true;
	try {
		nodeOptions ??= {};

		const serverInfo: IServerInfo = {
			name: nodeOptions?.serverName ?? "TWIN Node",
			version: nodeOptions?.serverVersion ?? "0.10.0" // x-release-please-version
		};

		CLIDisplay.header(serverInfo.name, serverInfo.version, "🌩️ ");

		if (!Is.stringValue(nodeOptions?.executionDirectory)) {
			nodeOptions.executionDirectory = getExecutionDirectory();
		}
		CLIDisplay.value("Execution Directory", nodeOptions.executionDirectory);

		if (!Is.stringValue(nodeOptions?.scriptDirectory)) {
			nodeOptions.scriptDirectory = getScriptDirectory(args);
		}
		CLIDisplay.value("Script Directory", nodeOptions.scriptDirectory);

		nodeOptions.localesDirectory =
			nodeOptions?.localesDirectory ??
			path.resolve(path.join(nodeOptions.scriptDirectory, "dist", "locales"));

		CLIDisplay.value("Locales Directory", nodeOptions.localesDirectory);
		await initialiseLocales(nodeOptions.localesDirectory);

		nodeOptions.envPrefix ??= "TWIN_";

		overrideModuleImport(nodeOptions.executionDirectory ?? "");

		const commandLineArgs = parseCommandLineArgs(args);

		const hasEnvPrefix = commandLineArgs.options?.find(option => option.key === "env-prefix");
		if (hasEnvPrefix) {
			nodeOptions.envPrefix = Coerce.string(hasEnvPrefix.value) ?? nodeOptions.envPrefix;
		}

		CLIDisplay.value("Environment Variable Prefix", nodeOptions.envPrefix);

		// This is the only location in the code base that should access process.env directly
		// So we can safely disable the linting rule here.
		let finalEnvVars =
			// eslint-disable-next-line no-restricted-syntax
			process.env as {
				[id: string]: string;
			};

		if (Is.objectValue(nodeOptions?.envVars)) {
			finalEnvVars = {
				...finalEnvVars,
				...nodeOptions.envVars
			};
		}

		finalEnvVars = {
			...getEnvDefaults(nodeOptions.envPrefix),
			...finalEnvVars
		};

		let cliCommand;
		if (Is.arrayValue(commandLineArgs.options)) {
			registerCommands();
			cliCommand = constructCliCommand(finalEnvVars, commandLineArgs);
		}

		if (Is.object(cliCommand)) {
			finalEnvVars[`${nodeOptions.envPrefix}SILENT`] ??= "true";
		} else {
			if (Is.empty(nodeOptions?.openApiSpecFile)) {
				const specFile = path.resolve(
					path.join(nodeOptions.scriptDirectory ?? "", "docs", "open-api", "spec.json")
				);
				if (await fileExists(specFile)) {
					nodeOptions ??= {};
					nodeOptions.openApiSpecFile = specFile;
				}
			}
			if (Is.stringValue(nodeOptions.openApiSpecFile)) {
				CLIDisplay.value("OpenAPI Spec File", nodeOptions.openApiSpecFile);
			}

			if (Is.empty(nodeOptions?.favIconFile)) {
				const favIconFile = path.resolve(
					path.join(nodeOptions.scriptDirectory ?? "", "static", "favicon.png")
				);
				if (await fileExists(favIconFile)) {
					nodeOptions ??= {};
					nodeOptions.favIconFile = favIconFile;
				}
			}
			if (Is.stringValue(nodeOptions.favIconFile)) {
				CLIDisplay.value("Favicon File", nodeOptions.favIconFile);
			}
		}

		const { nodeEngineConfig, nodeEnvVars, availableContextIdKeys } = await buildConfiguration(
			finalEnvVars,
			nodeOptions,
			serverInfo
		);

		debugEnabled = Coerce.boolean(nodeEnvVars.debug) ?? debugEnabled;

		CLIDisplay.break();

		const startResult = await start(
			nodeOptions,
			nodeEngineConfig,
			nodeEnvVars,
			cliCommand,
			availableContextIdKeys
		);

		if (Is.notEmpty(startResult)) {
			showErrorDetails = false;

			let isShuttingDown = false;
			for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"]) {
				process.on(signal, async () => {
					if (!isShuttingDown) {
						isShuttingDown = true;
						CLIDisplay.value("Terminate Signal", signal);
						await startResult.shutdown();
						process.exit(0);
					}
				});
			}
		}

		return startResult;
	} catch (err) {
		if (nodeOptions?.disableProcessExitOnFailure ?? false) {
			throw err;
		}

		if (showErrorDetails) {
			CLIDisplay.error(err, true, { includeAdditional: true, includeStack: debugEnabled });
		}

		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(1);
	}
}

/**
 * Test whether a camelCase key matches an entry in a pattern set.
 * Entries ending with "*" are treated as prefix patterns; all others require an exact match.
 * @param camelKey The camelCase key to test.
 * @param patternSet The set of exact keys and/or wildcard patterns (e.g. "restPath*").
 * @returns True if the key matches any entry.
 */
function matchesPatternSet(
	camelKey: string,
	patternSet: ReadonlySet<string> | Set<string>
): boolean {
	if (patternSet.has(camelKey)) {
		return true;
	}
	for (const pattern of patternSet) {
		if (pattern.endsWith("*") && camelKey.startsWith(pattern.slice(0, -1))) {
			return true;
		}
	}
	return false;
}

/**
 * Report any environment variables which are still recognised but no longer used.
 * @param envVars The already-converted camelCase env variables.
 * @param prefix The prefix used for the environment variables (e.g. "TWIN_").
 */
function warnDeprecatedEnvVarKeys(
	envVars: { [id: string]: string | unknown },
	prefix: string
): void {
	for (const camelKey of Object.keys(envVars)) {
		const replacements = DEPRECATED_ENVIRONMENT_VARIABLE_KEYS.get(camelKey);
		if (!Is.undefined(replacements)) {
			const key = EnvHelper.jsonKeyToEnvVarKey(camelKey, prefix);

			if (Is.arrayValue(replacements)) {
				CLIDisplay.warning(
					I18n.formatMessage("warn.node.deprecatedEnvVar", {
						key,
						replacements: replacements
							.map(replacement => EnvHelper.jsonKeyToEnvVarKey(replacement, prefix))
							.join(", ")
					})
				);
			} else {
				CLIDisplay.warning(I18n.formatMessage("warn.node.deprecatedEnvVarNoReplacement", { key }));
			}
		}
	}
}

/**
 * Validate that every key in envVars maps to a recognised property.
 * All unknown keys are collected, then reported together as a single error or warning.
 * Raw env var names listed in the allow list (e.g. TWIN_MY_EXTENSION_SECRET, TWIN_REST_PATH_*) are always accepted.
 * Wildcard patterns ending with * are supported in both allow sets and the allow list.
 * @param envVars The already-converted camelCase env variables.
 * @param prefix The prefix used for the environment variables (e.g. "TWIN_").
 * @param allowSets An array of sets of allowed keys and/or wildcard patterns.
 * @throws GeneralError If any unknown env var properties are found and strict mode is "error", or if the strict mode value is invalid.
 */
function validateEnvVarKeys(
	envVars: { [id: string]: string | unknown },
	prefix: string,
	allowSets: ReadonlySet<string>[]
): void {
	const mode = Is.stringValue(envVars.strictEnv) ? envVars.strictEnv : "error";
	Guards.arrayOneOf("node", `${prefix}STRICT_ENV`, mode, ["error", "warn", "ignore"]);

	if (mode === "ignore") {
		return;
	}

	const customSet = new Set(
		commaSeparatedListToArray<string>(envVars.envAllowList as string).map(k =>
			EnvHelper.envVarKeyToJsonKey(k.trim(), prefix)
		)
	);

	const unknown = Object.keys(envVars)
		.filter(
			camelKey =>
				!allowSets.some(set => matchesPatternSet(camelKey, set)) &&
				!matchesPatternSet(camelKey, customSet) &&
				!DEPRECATED_ENVIRONMENT_VARIABLE_KEYS.has(camelKey)
		)
		.map(camelKey => EnvHelper.jsonKeyToEnvVarKey(camelKey, prefix));

	if (unknown.length > 0) {
		if (mode === "error") {
			throw new GeneralError("node", "unknownEnvVars", { keys: unknown.join(", "), prefix });
		}
		CLIDisplay.warning(
			I18n.formatMessage("warn.node.unknownEnvVars", { keys: unknown.join(", "), prefix })
		);
	}
}

/**
 * Build the configuration for the TWIN Node.
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
	nodeEnvVars: IEnvironmentVariables & { [id: string]: string | unknown };
	nodeEngineConfig: INodeEngineConfig;
	availableContextIdKeys: { key: string; requiredHandlerFeatures: string[] }[];
}> {
	const availableContextIdKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];

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
			for (const [key, value] of Object.entries(output.parsed)) {
				// Only set environment variables that are not already set in
				// the process environment or provided via options.envVars
				processEnv[key] ??= value;
			}
		}
	}

	const envVars = EnvHelper.envToJson<{ [id: string]: string | unknown }>(
		processEnv,
		options.envPrefix ?? ""
	);

	warnDeprecatedEnvVarKeys(envVars, options.envPrefix ?? "");

	validateEnvVarKeys(envVars, options.envPrefix ?? "", [
		ENGINE_ENVIRONMENT_VARIABLE_KEYS,
		ENGINE_SERVER_ENVIRONMENT_VARIABLE_KEYS,
		NODE_ENVIRONMENT_VARIABLE_KEYS,
		BOOTSTRAP_DEV_ENVIRONMENT_VARIABLE_KEYS
	]);

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
		availableContextIdKeys,
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

	return { nodeEngineConfig, nodeEnvVars: envVars, availableContextIdKeys };
}

/**
 * Override module imports to support protocol-based loading (npm:, https:) and local files.
 * @param executionDirectory The execution directory for resolving local module paths.
 * @param envVars The environment variables containing extension configuration (optional, uses defaults if not provided).
 */
export function overrideModuleImport(
	executionDirectory: string,
	envVars?: IEnvironmentVariables
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
					const packagePath = await CLIUtils.findPackageRoot(moduleName, executionDirectory);
					if (Is.stringValue(packagePath)) {
						const mainFile = await resolvePackageEntryPoint(packagePath, moduleName);
						const modulePath = path.resolve(packagePath, mainFile);
						const exists = await fileExists(modulePath);
						if (exists) {
							resolvedPath = modulePath;
							break;
						}
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
