// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Parsed command line arguments passed to the CLI.
 */
export interface ICliArgs {
	/**
	 * The path of the node executable.
	 */
	nodePath?: string;

	/**
	 * The path of the script to execute.
	 */
	scriptPath?: string;

	/**
	 * The command line options.
	 */
	options?: {
		key: string;
		value: string;
	}[];
}
