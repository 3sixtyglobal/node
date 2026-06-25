// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { CliCommandParamType } from "./cliCommandParamType.js";

/**
 * Definition of a single parameter accepted by a CLI command.
 */
export interface ICliCommandDefinitionParam {
	/**
	 * The param key.
	 */
	key: string;

	/**
	 * The param type.
	 */
	type: "string" | "number" | "boolean";

	/**
	 * Possible options for the param.
	 */
	options?: string[];

	/**
	 * The extended type e.g. hex etc.
	 */
	extendedType?: string;

	/**
	 * Whether the param is required.
	 * @default true
	 */
	required?: boolean;

	/**
	 * The default value of the param.
	 */
	defaultValue?: CliCommandParamType;

	/**
	 * The param description.
	 */
	description: string;
}
