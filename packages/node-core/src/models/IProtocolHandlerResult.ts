// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The result from a protocol handler.
 */
export interface IProtocolHandlerResult {
	/**
	 * The resolved path to the module file.
	 */
	resolvedPath: string;

	/**
	 * Whether the module was cached.
	 */
	cached: boolean;
}
