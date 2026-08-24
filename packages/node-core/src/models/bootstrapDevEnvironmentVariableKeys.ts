// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IBootstrapDevEnvironmentVariables } from "./IBootstrapDevEnvironmentVariables.js";

// Mapped type exhaustiveness check: TypeScript requires every key of
// Required<IBootstrapDevEnvironmentVariables> to appear here with value `true`.
// Removing a key → compile error ("Property X is missing").
// Adding an invented key → compile error ("Object literal may only specify known properties").
const bootstrapDevEnvironmentVariableKeysInternal: {
	[K in keyof Required<IBootstrapDevEnvironmentVariables>]: true;
} = {
	// IBootstrapDevEnvironmentVariables
	features: true,
	nodeIdentity: true,
	nodeMnemonic: true,
	tenantId: true,
	tenantApiKey: true,
	organizationIdentity: true,
	organizationMnemonic: true,
	adminUserIdentity: true,
	adminUserMnemonic: true,
	adminUserName: true,
	adminUserPassword: true,
	adminUserScope: true
};

/**
 * The set of camelCase property names that are valid IBootstrapDevEnvironmentVariables keys.
 */
export const BOOTSTRAP_DEV_ENVIRONMENT_VARIABLE_KEYS: ReadonlySet<string> = new Set(
	Object.keys(bootstrapDevEnvironmentVariableKeysInternal)
);
