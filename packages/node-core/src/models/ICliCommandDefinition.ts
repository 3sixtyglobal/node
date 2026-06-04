// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineCore } from "@twin.org/engine-models";
import type { CliCommandParamType } from "./cliCommandParamType.js";
import type { ICliCommandDefinitionParam } from "./ICliCommandDefinitionParam.js";
import type { INodeEnvironmentVariables } from "./INodeEnvironmentVariables.js";

/**
 * Command to execute in the CLI.
 */
export interface ICliCommandDefinition {
	/**
	 * The command name.
	 */
	command: string;

	/**
	 * The command description.
	 */
	description: string;

	/**
	 * The example.
	 */
	example: string;

	/**
	 * The params available for the command.
	 */
	params: ICliCommandDefinitionParam[];

	/**
	 * The method to execute for the command.
	 */
	action: (
		engineCore: IEngineCore,
		envVars: INodeEnvironmentVariables,
		params: { [id: string]: CliCommandParamType }
	) => Promise<unknown>;

	/**
	 * Indicates whether the engine needs to be started before executing the command.
	 * @default true
	 */
	requiresEngineStarted?: boolean;

	/**
	 * Indicates whether the engine needs the node identity to be set if configured to use.
	 * @default true
	 */
	requiresNodeIdentity?: boolean;
}
