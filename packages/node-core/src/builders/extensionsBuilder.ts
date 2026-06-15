// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { CLIDisplay } from "@twin.org/cli-core";
import { GeneralError, I18n, Is } from "@twin.org/core";
import type { IEngineCore, IEngineServer } from "@twin.org/engine-models";
import { ModuleHelper } from "@twin.org/modules";
import type { INodeEngineConfig } from "../models/INodeEngineConfig.js";
import type { INodeEnvironmentVariables } from "../models/INodeEnvironmentVariables.js";
import type { NodeExtensionInitialiseEngineMethod } from "../models/nodeExtensionInitialiseEngineMethod.js";
import type { NodeExtensionInitialiseEngineServerMethod } from "../models/nodeExtensionInitialiseEngineServerMethod.js";
import type { NodeExtensionInitialiseMethod } from "../models/nodeExtensionInitialiseMethod.js";
import type { NodeExtensionShutdownMethod } from "../models/nodeExtensionShutdownMethod.js";

const extensionState: { [id: string]: { initialised: boolean } } = {};

/**
 * Handles the configuration of the extensions.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 * @returns The config for the core and the server.
 */
export async function extensionsConfiguration(
	envVars: INodeEnvironmentVariables,
	nodeEngineConfig: INodeEngineConfig
): Promise<INodeEngineConfig> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = envVars.extensions.split(",");

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
	envVars: INodeEnvironmentVariables,
	engineCore: IEngineCore
): Promise<void> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = envVars.extensions.split(",");

		for (const extension of extensions) {
			extensionState[extension] ??= { initialised: false };

			if (!extensionState[extension].initialised) {
				extensionState[extension].initialised = true;

				let initialiseEngineMethod: NodeExtensionInitialiseEngineMethod | undefined;
				try {
					engineCore.logInfo(I18n.formatMessage("node.extensionInitialisingEngine", { extension }));
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
	envVars: INodeEnvironmentVariables,
	engineCore: IEngineCore,
	engineServer: IEngineServer
): Promise<void> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = envVars.extensions.split(",");

		for (const extension of extensions) {
			let initialiseEngineServerMethod: NodeExtensionInitialiseEngineServerMethod | undefined;
			try {
				engineCore.logInfo(
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
	envVars: INodeEnvironmentVariables,
	engineCore: IEngineCore
): Promise<void> {
	if (Is.stringValue(envVars.extensions)) {
		const extensions = envVars.extensions.split(",");

		for (const extension of extensions) {
			extensionState[extension] ??= { initialised: false };

			if (extensionState[extension].initialised) {
				extensionState[extension].initialised = false;
				let shutdownMethod: NodeExtensionShutdownMethod | undefined;
				try {
					engineCore.logInfo(I18n.formatMessage("node.extensionShutdown", { extension }));
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
