// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineCore, IEngineServer } from "@twin.org/engine-models";
import type { INodeEngineConfig } from "./INodeEngineConfig";
import type { INodeEnvironmentVariables } from "./INodeEnvironmentVariables";

/**
 * The type for the initialise method of an extension module.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export type NodeExtensionInitialiseMethod = (
	envVars: INodeEnvironmentVariables,
	nodeEngineConfig: INodeEngineConfig
) => Promise<void>;

/**
 * The type for the initialise engine method of an extension module.
 * This is called when the engine has been constructed but not yet started.
 * @param engineCore The engine core instance.
 */
export type NodeExtensionInitialiseEngineMethod = (engineCore: IEngineCore) => Promise<void>;

/**
 * The type for the initialise engine server method of an extension module.
 * This is called when the engine server has been constructed but not yet started.
 * @param engineCore The engine core instance.
 * @param engineServer The engine server instance.
 */
export type NodeExtensionInitialiseEngineServerMethod = (
	engineCore: IEngineCore,
	engineServer: IEngineServer
) => Promise<void>;
