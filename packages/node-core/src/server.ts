// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GeneralError, I18n, Is } from "@twin.org/core";
import { Engine } from "@twin.org/engine";
import { FileStateStorage } from "@twin.org/engine-core";
import { EngineCoreFactory } from "@twin.org/engine-models";
import { EngineServer } from "@twin.org/engine-server";
import type { IEngineServerConfig } from "@twin.org/engine-server-types";
import { BlobStorageConnectorType, EntityStorageConnectorType } from "@twin.org/engine-types";
import { bootstrap } from "./bootstrap.js";
import {
	extensionsInitialiseEngine,
	extensionsInitialiseEngineServer,
	shutdownExtensions
} from "./builders/extensionsBuilder.js";
import type { INodeEngineConfig } from "./models/INodeEngineConfig.js";
import type { INodeEngineState } from "./models/INodeEngineState.js";
import type { INodeEnvironmentVariables } from "./models/INodeEnvironmentVariables.js";
import type { INodeOptions } from "./models/INodeOptions.js";

let isStarted = false;

/**
 * Start the engine server.
 * @param nodeOptions Optional run options for the engine server.
 * @param nodeEngineConfig The configuration for the engine server.
 * @param envVars The environment variables.
 * @param availableContextIdKeys The context ID keys available for operation.
 * @returns The engine server.
 */
export async function start(
	nodeOptions: INodeOptions | undefined,
	nodeEngineConfig: INodeEngineConfig,
	envVars: INodeEnvironmentVariables,
	availableContextIdKeys?: { key: string; componentFeatures: string[] }[]
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

	// If the blob storage or entity storage is configured with file connectors
	// then we need to make sure the storageFileRoot is set
	if (
		(entityStorageConnectorType.includes(EntityStorageConnectorType.File) ||
			blobStorageConnectorType.includes(BlobStorageConnectorType.File) ||
			Is.empty(nodeOptions?.stateStorage)) &&
		!Is.stringValue(envVars.storageFileRoot)
	) {
		throw new GeneralError("node", "storageFileRootNotSet", {
			storageFileRoot: `${nodeOptions?.envPrefix ?? ""}STORAGE_FILE_ROOT`
		});
	}

	// Create the engine instance using file state storage unless one is configured in options
	const engine = new Engine<IEngineServerConfig, INodeEngineState>({
		config: nodeEngineConfig,
		stateStorage: nodeOptions?.stateStorage ?? new FileStateStorage(envVars.stateFilename ?? ""),
		customBootstrap: async (core, engineContext) => bootstrap(core, engineContext, envVars)
	});

	if (Is.arrayValue(availableContextIdKeys)) {
		const added: string[] = [];
		for (const availableContextIdKey of availableContextIdKeys) {
			if (!added.includes(availableContextIdKey.key)) {
				engine.addContextIdKey(availableContextIdKey.key, availableContextIdKey.componentFeatures);
				added.push(availableContextIdKey.key);
			}
		}
	}

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

	// Start the server, which also starts the engine.
	isStarted = await server.start();

	if (isStarted) {
		return {
			engine,
			server,
			shutdown: async () => {
				if (isStarted) {
					isStarted = false;
					await shutdownExtensions(envVars, engine);
					await server.stop();
				}
			}
		};
	}
}
