// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The environment variables for the bootstrap development command.
 */
export interface IBootstrapDevEnvironmentVariables {
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
	 * The mnemonic for the node identity, if empty it will be randomly generated.
	 */
	nodeMnemonic?: string;

	/**
	 * A tenant id to use as a default for the node.
	 */
	tenantId?: string;

	/**
	 * A tenant api key to use as a default for the node.
	 */
	tenantApiKey?: string;

	/**
	 * The organisation identity. If not provided it will be generated.
	 */
	organizationIdentity?: string;

	/**
	 * The mnemonic for the organisation identity, if empty it will be randomly generated.
	 */
	organizationMnemonic?: string;

	/**
	 * If the admin-user feature is enabled, this will be the identity of the user. If not provided it will be generated.
	 */
	adminUserIdentity?: string;

	/**
	 * The mnemonic for the admin user, if empty it will be randomly generated.
	 */
	adminUserMnemonic?: string;

	/**
	 * If the admin-user feature is enabled, this will be the name of the user.
	 * @default admin@node
	 */
	adminUserName?: string;

	/**
	 * If the admin-user feature is enabled, this will be the password of the user. If empty it will be randomly generated.
	 */
	adminUserPassword?: string;

	/**
	 * If the admin-user feature is enabled, this is a comma-separated list of scopes for the user.
	 * @default tenant-admin,user-admin (when tenant enabled) or user-admin (when tenant disabled)
	 */
	adminUserScope?: string;
}
