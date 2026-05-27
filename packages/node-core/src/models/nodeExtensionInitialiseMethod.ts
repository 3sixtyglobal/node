// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { INodeEngineConfig } from "./INodeEngineConfig.js";
import type { INodeEnvironmentVariables } from "./INodeEnvironmentVariables.js";

/**
 * The type for the initialise method of an extension module.
 * @param envVars The environment variables for the node.
 * @param nodeEngineConfig The node engine config.
 */
export type NodeExtensionInitialiseMethod = (
	envVars: INodeEnvironmentVariables,
	nodeEngineConfig: INodeEngineConfig
) => Promise<void>;
