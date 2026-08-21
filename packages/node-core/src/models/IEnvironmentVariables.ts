// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IBootstrapDevEnvironmentVariables } from "./IBootstrapDevEnvironmentVariables.js";
import type { IEngineEnvironmentVariables } from "./IEngineEnvironmentVariables.js";
import type { IEngineServerEnvironmentVariables } from "./IEngineServerEnvironmentVariables.js";
import type { INodeEnvironmentVariables } from "./INodeEnvironmentVariables.js";

/**
 * The environment variables.
 */
export type IEnvironmentVariables = IBootstrapDevEnvironmentVariables &
	INodeEnvironmentVariables &
	IEngineEnvironmentVariables &
	IEngineServerEnvironmentVariables;
