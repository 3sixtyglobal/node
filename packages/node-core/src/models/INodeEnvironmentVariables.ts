// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineServerEnvironmentVariables } from "./IEngineServerEnvironmentVariables.js";

/**
 * The environment variables for the node.
 */
export interface INodeEnvironmentVariables extends IEngineServerEnvironmentVariables {
	/**
	 * The features that are enabled on the node.
	 * @default []
	 */
	features?: string;

	/**
	 * The identity of the node which, if empty and node-identity feature is enabled it will be generated.
	 */
	nodeIdentity?: string;

	/**
	 * The mnemonic for the identity, if empty and node-identity feature is enabled it will be randomly generated.
	 */
	nodeMnemonic?: string;

	/**
	 * If the node-admin-user feature is enabled, this will be the organization of the user, if one is not provided it will be generated
	 */
	organizationIdentity?: string;

	/**
	 * The mnemonic for the organization, if empty and node-admin-user feature is enabled it will be randomly generated.
	 */
	organizationMnemonic?: string;

	/**
	 * If the node-admin-user feature is enabled, this will be the identity of the user, if one is not provided it will be generated
	 */
	adminUserIdentity?: string;

	/**
	 * The mnemonic for the admin user, if empty and node-admin-user feature is enabled it will be randomly generated.
	 */
	adminUserMnemonic?: string;

	/**
	 * If the node-admin-user feature is enabled, this will be the name of the user.
	 * @default admin@node
	 */
	adminUserName?: string;

	/**
	 * If the node-admin-user feature is enabled, this will be the password of the user, if empty it will be randomly generated.
	 */
	adminUserPassword?: string;

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
