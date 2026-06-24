// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { INodeEnvironmentVariables } from "./INodeEnvironmentVariables.js";

// Mapped type exhaustiveness check: TypeScript requires every key of
// Required<INodeEnvironmentVariables> to appear here with value `true`.
// Removing a key → compile error ("Property X is missing").
// Adding an invented key → compile error ("Object literal may only specify known properties").
const nodeEnvironmentVariableKeysInternal: {
	[K in keyof Required<INodeEnvironmentVariables>]: true;
} = {
	// INodeEnvironmentVariables — extensions
	extensionsMaxSizeMb: true,
	extensionsClearCache: true,
	extensionsCacheDirectory: true,
	extensionsCacheTtlHours: true,
	extensionsForceRefresh: true
};

/**
 * The set of camelCase property names that are valid INodeEnvironmentVariables keys.
 * Used at startup to detect unrecognised TWIN_* environment variables (typos, stale names).
 */
export const NODE_ENVIRONMENT_VARIABLE_KEYS: ReadonlySet<string> = new Set(
	Object.keys(nodeEnvironmentVariableKeysInternal)
);
