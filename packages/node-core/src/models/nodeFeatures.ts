// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The features that can be enabled on the node.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const NodeFeatures = {
	/**
	 * NodeId - generates an identity for the node if not provided in config.
	 */
	NodeId: "node-identity",

	/**
	 * NodeAdminUser - generates an admin user for the node if not provided in config.
	 */
	NodeAdminUser: "node-admin-user",

	/**
	 * NodeWallet - generates wallets for any identities that need them.
	 */
	NodeWallet: "node-wallet"
} as const;

/**
 * The features that can be enabled on the node.
 */
export type NodeFeatures = (typeof NodeFeatures)[keyof typeof NodeFeatures];
