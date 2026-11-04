// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { FeatureFactory, type IFeatureDefinition } from "@3sixty/api-auth-models";
import { CLIDisplay } from "@3sixty/cli-core";
import { BaseError, EnvHelper, GeneralError, I18n, Is } from "@3sixty/core";
import type { IEngineCore, IEngineServer } from "@3sixty/engine-models";
import { ModuleHelper } from "@3sixty/modules";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { NodeExtensionFeaturesMethod } from "../models/nodeExtensionFeaturesMethod.js";
import type { NodeExtensionInitialiseEngineMethod } from "../models/nodeExtensionInitialiseEngineMethod.js";
import type { NodeExtensionInitialiseEngineServerMethod } from "../models/nodeExtensionInitialiseEngineServerMethod.js";
import type { NodeExtensionInitialiseMethod } from "../models/nodeExtensionInitialiseMethod.js";
import type { NodeExtensionShutdownMethod } from "../models/nodeExtensionShutdownMethod.js";

const extensionState: { [id: string]: { initialised: boolean } } = {};

/**
 * Handles the configuration of the extensions, and registers the features they provide with the feature factory.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 * @returns The config for the core and the server.
 * @throws GeneralError if an extension cannot be loaded, two extensions provide a feature with the same
 * name, or extensions provide features without a feature component to list them.
 */
export async function extensionsConfiguration(
	envVars: IEnvironmentVariables,
	nodeEngineConfig: INodeEngineConfig
): Promise<INodeEngineConfig> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = EnvHelper.commaSeparatedListToArray<string>(envVars.extensions);
		const features: IFeatureDefinition[] = [];

		for (const extension of extensions) {
			let initialiseConfigMethod: NodeExtensionInitialiseMethod | undefined;
			try {
				CLIDisplay.value(I18n.formatMessage("node.extensionLoading"), extension);

				initialiseConfigMethod = await ModuleHelper.getModuleMethod<NodeExtensionInitialiseMethod>(
					extension,
					"extensionInitialise"
				);
			} catch (err) {
				throw new GeneralError("node", "extensionLoadingError", { extension }, err);
			}

			if (Is.function(initialiseConfigMethod)) {
				await initialiseConfigMethod(envVars, nodeEngineConfig);
			}

			try {
				const featuresMethod = await ModuleHelper.getModuleMethod<NodeExtensionFeaturesMethod>(
					extension,
					"extensionFeatures"
				);

				for (const feature of await featuresMethod(envVars)) {
					if (features.some(existing => existing.name === feature.name)) {
						throw new GeneralError("node", "extensionFeatureDuplicate", {
							extension,
							feature: feature.name
						});
					}
					features.push(feature);
				}
			} catch (err) {
				// The method is optional, so only an extension without it provides no features.
				if (!BaseError.isErrorMessage(err, /\.entryNotFound$/)) {
					throw new GeneralError("node", "extensionLoadingError", { extension }, err);
				}
			}
		}

		if (features.length > 0) {
			if (!Is.arrayValue(nodeEngineConfig.types.featureComponent)) {
				throw new GeneralError("node", "extensionFeaturesUnavailable", {
					features: features.map(feature => feature.name).join(", ")
				});
			}
			for (const feature of features) {
				FeatureFactory.register(feature.name, () => feature);
			}
		}
	}

	return nodeEngineConfig;
}

/**
 * Handles the initialisation of the extensions when the engine has been constructed.
 * @param envVars The environment variables for the node.
 * @param engineCore The engine core instance.
 * @returns A promise that resolves when all extension engine initialisation methods have completed.
 */
export async function extensionsInitialiseEngine(
	envVars: IEnvironmentVariables,
	engineCore: IEngineCore
): Promise<void> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = EnvHelper.commaSeparatedListToArray<string>(envVars.extensions);

		for (const extension of extensions) {
			extensionState[extension] ??= { initialised: false };

			if (!extensionState[extension].initialised) {
				extensionState[extension].initialised = true;

				let initialiseEngineMethod: NodeExtensionInitialiseEngineMethod | undefined;
				try {
					await engineCore.logInfo(
						I18n.formatMessage("node.extensionInitialisingEngine", { extension })
					);
					initialiseEngineMethod =
						await ModuleHelper.getModuleMethod<NodeExtensionInitialiseEngineMethod>(
							extension,
							"extensionInitialiseEngine"
						);
				} catch {}

				if (Is.function(initialiseEngineMethod)) {
					await initialiseEngineMethod(engineCore);
				}
			}
		}
	}
}

/**
 * Handles the initialisation of the extensions when the engine server has been constructed.
 * @param envVars The environment variables for the node.
 * @param engineCore The engine core instance.
 * @param engineServer The engine server instance.
 * @returns A promise that resolves when all extension engine-server initialisation methods have completed.
 */
export async function extensionsInitialiseEngineServer(
	envVars: IEnvironmentVariables,
	engineCore: IEngineCore,
	engineServer: IEngineServer
): Promise<void> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = EnvHelper.commaSeparatedListToArray<string>(envVars.extensions);

		for (const extension of extensions) {
			let initialiseEngineServerMethod: NodeExtensionInitialiseEngineServerMethod | undefined;
			try {
				await engineCore.logInfo(
					I18n.formatMessage("node.extensionInitialisingEngineServer", { extension })
				);
				initialiseEngineServerMethod =
					await ModuleHelper.getModuleMethod<NodeExtensionInitialiseEngineServerMethod>(
						extension,
						"extensionInitialiseEngineServer"
					);
			} catch {}

			if (Is.function(initialiseEngineServerMethod)) {
				await initialiseEngineServerMethod(engineCore, engineServer);
			}
		}
	}
}

/**
 * Handles the shutdown of the extensions.
 * @param envVars The environment variables for the node.
 * @param engineCore The engine core instance.
 * @returns A promise that resolves when all extension shutdown methods have completed.
 */
export async function shutdownExtensions(
	envVars: IEnvironmentVariables,
	engineCore: IEngineCore
): Promise<void> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = EnvHelper.commaSeparatedListToArray<string>(envVars.extensions);

		for (const extension of extensions) {
			extensionState[extension] ??= { initialised: false };

			if (extensionState[extension].initialised) {
				extensionState[extension].initialised = false;
				let shutdownMethod: NodeExtensionShutdownMethod | undefined;
				try {
					await engineCore.logInfo(I18n.formatMessage("node.extensionShutdown", { extension }));
					shutdownMethod = await ModuleHelper.getModuleMethod<NodeExtensionShutdownMethod>(
						extension,
						"extensionShutdown"
					);
				} catch {}

				if (Is.function(shutdownMethod)) {
					await shutdownMethod();
				}
			}
		}
	}
}
