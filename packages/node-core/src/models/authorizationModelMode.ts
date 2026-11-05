// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The protocol types for modules.
 */
export const AuthorizationModelMode = {
	/**
	 * Merge the roles with the defaults.
	 */
	Merge: "merge",

	/**
	 * Replace the default roles.
	 */
	Replace: "replace"
} as const;

/**
 * The protocol type for a module.
 */
export type AuthorizationModelMode =
	(typeof AuthorizationModelMode)[keyof typeof AuthorizationModelMode];
