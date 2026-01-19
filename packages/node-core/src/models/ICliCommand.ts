// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { CliCommandParamType } from "./cliCommandParamType.js";
import type { ICliCommandDefinition } from "./ICliCommandDefinition.js";

/**
 * Command to execute in the CLI.
 */
export interface ICliCommand {
	/**
	 * The command to execute.
	 */
	definition: ICliCommandDefinition;

	/**
	 * The params to execute the command with.
	 */
	params: { [id: string]: CliCommandParamType };
}
