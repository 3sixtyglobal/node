// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEnvironmentVariables } from "./IEnvironmentVariables.js";
import type { INodeEngineConfig } from "./INodeEngineConfig.js";

/**
 * The type for the initialise method of an extension module.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 * @returns A promise that resolves when the extension configuration initialisation is complete.
 */
export type NodeExtensionInitialiseMethod = (
	envVars: IEnvironmentVariables,
	nodeEngineConfig: INodeEngineConfig
) => Promise<void>;
