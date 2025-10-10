// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineServerEnvironmentVariables } from "./IEngineServerEnvironmentVariables";

/**
 * The environment variables for the node.
 */
export interface INodeEnvironmentVariables extends IEngineServerEnvironmentVariables {
	/**
	 * The features that are enabled on the node.
	 * @default [NodeFeatures.NodeIdentity]
	 */
	features?: string;

	/**
	 * The identity of the node which, if empty and node-identity feature is enabled it will be generated.
	 */
	identity?: string;

	/**
	 * The mnemonic for the identity, if empty and node-identity feature is enabled it will be randomly generated.
	 */
	mnemonic?: string;

	/**
	 * If the node-user feature is enabled, this will be the name of the user.
	 * @default admin@node
	 */
	username?: string;

	/**
	 * If the node-user feature is enabled, this will be the password of the user, if empty it will be randomly generated.
	 */
	password?: string;

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
