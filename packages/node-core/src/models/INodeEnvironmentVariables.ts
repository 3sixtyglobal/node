// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The environment variables for the node.
 */
export interface INodeEnvironmentVariables {
	/**
	 * Comma separated list of native modules to initialise.
	 * @default "node:buffer,node:crypto,node:zlib"
	 */
	nativeModules?: string;

	/**
	 * Maximum size in MB for HTTPS extensions downloads.
	 * @default 10
	 */
	extensionsMaxSizeMb?: number;

	/**
	 * Whether to clear the extensions cache on startup.
	 * @default false
	 */
	extensionsClearCache?: boolean;

	/**
	 * Custom directory for extensions cache storage.
	 * @default ".tmp"
	 */
	extensionsCacheDirectory?: string;

	/**
	 * TTL in hours for HTTPS extensions cache.
	 * @default 24
	 */
	extensionsCacheTtlHours?: number;

	/**
	 * Force refresh of all cached extensions.
	 * @default false
	 */
	extensionsForceRefresh?: boolean;
}
