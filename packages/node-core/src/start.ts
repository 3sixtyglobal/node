// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys } from "@twin.org/context";
import { Coerce, GeneralError, I18n, Is } from "@twin.org/core";
import { Engine } from "@twin.org/engine";
import { FileStateStorage } from "@twin.org/engine-core";
import {
	EngineCoreFactory,
	type IEngineCore,
	type IEngineCoreConfig
} from "@twin.org/engine-models";
import { EngineServer } from "@twin.org/engine-server";
import type { IEngineServerConfig } from "@twin.org/engine-server-types";
import { BlobStorageConnectorType, EntityStorageConnectorType } from "@twin.org/engine-types";
import {
	extensionsInitialiseEngine,
	extensionsInitialiseEngineServer,
	shutdownExtensions
} from "./builders/extensionsBuilder.js";
import { executeCommand } from "./cli.js";
import type { ICliCommand } from "./models/ICliCommand.js";
import type { INodeEngineConfig } from "./models/INodeEngineConfig.js";
import type { INodeEngineState } from "./models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables.js";
import type { INodeOptions } from "./models/INodeOptions.js";

/**
 * Start the engine server.
 * @param nodeOptions Optional run options for the engine server.
 * @param nodeEngineConfig The configuration for the engine server.
 * @param envVars The environment variables.
 * @param cliCommand The constructed CLI command (optional).
 * @param availableContextIdKeys The context ID keys available for operation.
 * @returns The engine server.
 */
export async function start(
	nodeOptions: INodeOptions | undefined,
	nodeEngineConfig: INodeEngineConfig,
	envVars: INodeEnvironmentVariables,
	cliCommand?: ICliCommand,
	availableContextIdKeys?: { key: string; requiredHandlerFeatures: string[] }[]
): Promise<
	| {
			engine: Engine<IEngineServerConfig, INodeEngineState>;
			server: EngineServer;
			shutdown: () => Promise<void>;
	  }
	| undefined
> {
	const entityStorageConnectorType = envVars.entityStorageConnectorType?.split(",") ?? [];
	const blobStorageConnectorType = envVars.blobStorageConnectorType?.split(",") ?? [];

	const requiresEngineStarted = cliCommand?.definition?.requiresEngineStarted ?? true;
	const requiresNodeIdentity = cliCommand?.definition?.requiresNodeIdentity ?? true;

	// If the blob storage or entity storage is configured with file connectors
	// then we need to make sure the storageFileRoot is set
	if (
		(entityStorageConnectorType.includes(EntityStorageConnectorType.File) ||
			blobStorageConnectorType.includes(BlobStorageConnectorType.File) ||
			Is.empty(nodeOptions?.stateStorage)) &&
		!Is.stringValue(envVars.storageFileRoot) &&
		requiresEngineStarted
	) {
		throw new GeneralError("node", "storageFileRootNotSet", {
			storageFileRoot: `${nodeOptions?.envPrefix ?? ""}STORAGE_FILE_ROOT`
		});
	}

	// Create the engine instance using file state storage unless one is configured in options
	const engine = new Engine<IEngineServerConfig, INodeEngineState>({
		config: nodeEngineConfig,
		stateStorage: requiresEngineStarted
			? (nodeOptions?.stateStorage ?? new FileStateStorage(envVars.stateFilename ?? ""))
			: undefined,
		customBootstrap: async (engineCore, context) => {
			configureContextIds(engineCore, envVars, requiresEngineStarted, requiresNodeIdentity);
		}
	});

	configureContextIdKeys(engine, availableContextIdKeys);

	// Construct the server with the engine.
	const server = new EngineServer({ engineCore: engine });

	// Extend the engine.
	if (Is.function(nodeOptions?.extendEngine)) {
		await engine.logInfo(I18n.formatMessage("node.extendingEngine"));
		await nodeOptions.extendEngine(engine);
	}

	await extensionsInitialiseEngine(envVars, engine);

	// Extend the engine server.
	if (Is.function(nodeOptions?.extendEngineServer)) {
		await engine.logInfo(I18n.formatMessage("node.extendingEngineServer"));
		await nodeOptions?.extendEngineServer(server);
	}

	await extensionsInitialiseEngineServer(envVars, engine, server);

	// Need to register the engine with the factory so that background tasks
	// can clone it to spawn new instances.
	EngineCoreFactory.register("engine", () => engine);

	if (Is.objectValue(cliCommand)) {
		await executeCommand(engine, envVars, cliCommand);
	} else {
		try {
			// Start the server, which also starts the engine.
			await server.start();

			return {
				engine,
				server,
				shutdown: async () => {
					await shutdownExtensions(envVars, engine);
					await server.stop();
				}
			};
		} catch (err) {
			await shutdownExtensions(envVars, engine);
			throw err;
		}
	}
}

/**
 * Configure the context IDs for the engine.
 * @param engine The engine to configure.
 * @param envVars The environment variables.
 * @param requiresEngineStarted Whether the engine is required to be started.
 * @param requiresNodeIdentity Whether the node identity is required.
 * @throws GeneralError Throws if the node identity or tenant is required but not set.
 */
function configureContextIds(
	engine: IEngineCore<IEngineCoreConfig, INodeEngineState>,
	envVars: INodeEnvironmentVariables,
	requiresEngineStarted: boolean,
	requiresNodeIdentity: boolean
): void {
	const state = engine.getState();

	if (requiresEngineStarted && requiresNodeIdentity) {
		const nodeIdentityEnabled = Coerce.boolean(envVars.nodeIdentityEnabled) ?? true;
		if (nodeIdentityEnabled) {
			if (Is.stringValue(state.nodeId)) {
				engine.addContextId(ContextIdKeys.Node, state.nodeId);
			} else {
				throw new GeneralError("node", "nodeIdentityNotSet");
			}
		}
	}
}

/**
 * Configure the context IDs for the engine.
 * @param engine The engine to configure.
 * @param availableContextIdKeys The available context ID keys.
 * @throws GeneralError Throws if the node identity or tenant is required but not set.
 */
function configureContextIdKeys(
	engine: IEngineCore<IEngineCoreConfig, INodeEngineState>,
	availableContextIdKeys: { key: string; requiredHandlerFeatures: string[] }[] | undefined
): void {
	if (Is.arrayValue(availableContextIdKeys)) {
		const added: string[] = [];
		for (const availableContextIdKey of availableContextIdKeys) {
			if (!added.includes(availableContextIdKey.key)) {
				engine.addContextIdKey(
					availableContextIdKey.key,
					availableContextIdKey.requiredHandlerFeatures
				);
				added.push(availableContextIdKey.key);
			}
		}
	}
}
