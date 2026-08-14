// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ITenantAdminComponent } from "@twin.org/api-models";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import { Coerce, ComponentFactory, GeneralError, I18n, Is } from "@twin.org/core";
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
import { commaSeparatedListToArray } from "./builders/helper/envHelpers.js";
import { executeCommand } from "./cli.js";
import type { ICliCommand } from "./models/ICliCommand.js";
import type { IEngineEnvironmentVariables } from "./models/IEngineEnvironmentVariables.js";
import type { IEnvironmentVariables } from "./models/IEnvironmentVariables.js";
import type { INodeEngineConfig } from "./models/INodeEngineConfig.js";
import type { INodeEngineState } from "./models/INodeEngineState.js";
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
	envVars: IEnvironmentVariables & IEngineEnvironmentVariables,
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
	const entityStorageConnectorType = commaSeparatedListToArray(envVars.entityStorageConnectorType);
	const blobStorageConnectorType = commaSeparatedListToArray(envVars.blobStorageConnectorType);

	const requiresEngineStarted = cliCommand?.definition?.requiresEngineStarted ?? true;
	const requiresNodeIdentity = cliCommand?.definition?.requiresNodeIdentity ?? true;
	const requiresOrgIdentity = cliCommand?.definition?.requiresOrgIdentity ?? true;

	// File connectors (blob/entity) and the default file-based state storage all
	// persist to disk under storageFileRoot, so it must be set when any of them is in use.
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
		customBootstrap: async engineCore => {
			configureContextIds(
				engineCore,
				envVars,
				requiresEngineStarted,
				requiresNodeIdentity,
				requiresOrgIdentity
			);
			if (!Is.objectValue(cliCommand) && requiresEngineStarted) {
				await ContextIdStore.run(engineCore.getContextIds() ?? {}, async () => {
					await enforceTenantOrganizationIds(engineCore, envVars);
				});
			}
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
 * Populate the engine context IDs from the current engine state.
 * @param engine The engine to configure.
 * @param envVars The environment variables.
 * @param requiresEngineStarted Whether the engine is required to be started.
 * @param requiresNodeIdentity Whether the node identity is required.
 * @param requiresOrgIdentity Whether the organization identity is required.
 * @throws GeneralError if the node identity or organization ID is required but not set.
 */
function configureContextIds(
	engine: IEngineCore<IEngineCoreConfig, INodeEngineState>,
	envVars: IEngineEnvironmentVariables,
	requiresEngineStarted: boolean,
	requiresNodeIdentity: boolean,
	requiresOrgIdentity: boolean
): void {
	const state = engine.getState();

	if (requiresEngineStarted) {
		if (Is.stringValue(state.nodeId)) {
			engine.addContextId(ContextIdKeys.Node, state.nodeId);
		} else if (requiresNodeIdentity) {
			throw new GeneralError("node", "nodeIdentityNotSet");
		}

		const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
		if (!tenantEnabled) {
			if (Is.stringValue(state.nodeOrganizationId)) {
				engine.addContextId(ContextIdKeys.Organization, state.nodeOrganizationId);
			} else if (requiresOrgIdentity) {
				throw new GeneralError("node", "nodeOrganizationIdNotSet");
			}
		}
	}
}

/**
 * Configure the available context ID keys on the engine.
 * @param engine The engine to configure.
 * @param availableContextIdKeys The available context ID keys.
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

/**
 * Scan all tenants for a missing organization ID.
 * If exactly one tenant is missing and the node's own organization ID is available in state,
 * the value is automatically applied and persisted (legacy migration path).
 * If multiple tenants are missing, or the single missing tenant cannot be auto-recovered,
 * startup is blocked with an error listing the affected tenant IDs.
 * @param engineCore The engine core.
 * @param envVars The environment variables.
 * @returns A promise that resolves when all tenants have valid organization IDs.
 * @throws GeneralError if multiple tenants are missing their organization ID and cannot be auto-recovered.
 */
async function enforceTenantOrganizationIds(
	engineCore: IEngineCore<IEngineCoreConfig, INodeEngineState>,
	envVars: IEnvironmentVariables
): Promise<void> {
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	if (!tenantEnabled) {
		return;
	}

	const type = engineCore.getRegisteredInstanceTypeOptional("tenantAdminComponent");
	if (!Is.stringValue(type)) {
		return;
	}

	const tenantAdminComponent = ComponentFactory.get<ITenantAdminComponent>(type);
	const missingIds: string[] = [];
	let cursor: string | undefined;

	do {
		const { tenants, cursor: next } = await tenantAdminComponent.query(
			undefined,
			["id", "organizationId"],
			cursor
		);
		for (const tenant of tenants) {
			if (Is.stringValue(tenant.id) && !Is.stringValue(tenant.organizationId)) {
				missingIds.push(tenant.id);
			}
		}
		cursor = next;
	} while (Is.stringValue(cursor));

	if (missingIds.length === 0) {
		return;
	}

	if (missingIds.length === 1) {
		const state = engineCore.getState();
		if (Is.stringValue(state.nodeOrganizationId)) {
			engineCore.logInfo(
				I18n.formatMessage("node.tenantOrganizationIdAutoAssigned", {
					tenantId: missingIds[0],
					organizationId: state.nodeOrganizationId
				})
			);
			await tenantAdminComponent.update({
				id: missingIds[0],
				organizationId: state.nodeOrganizationId
			});
			return;
		}
	}

	throw new GeneralError("node", "tenantsWithoutOrganizationId", {
		tenantIds: missingIds.join(", ")
	});
}
