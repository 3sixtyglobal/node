// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IEngineServerEnvironmentVariables } from "./IEngineServerEnvironmentVariables.js";

// Mapped type exhaustiveness check: TypeScript requires every key of
// Required<IEngineServerEnvironmentVariables> to appear here with value `true`.
// Removing a key → compile error ("Property X is missing").
// Adding an invented key → compile error ("Object literal may only specify known properties").
const engineServerEnvironmentVariableKeysInternal: {
	[K in keyof Required<IEngineServerEnvironmentVariables>]: true;
} = {
	// IEngineServerEnvironmentVariables - server
	port: true,
	host: true,
	corsOrigins: true,
	httpMethods: true,
	httpAllowedHeaders: true,
	httpExposedHeaders: true,
	publicOrigin: true,
	// IEngineServerEnvironmentVariables - auth
	authAdminProcessorType: true,
	authProcessorType: true,
	authSigningKeyId: true,
	authApiKeyHeader: true,
	// IEngineServerEnvironmentVariables - routing
	mimeTypeProcessors: true,
	routeLoggingIncludeBody: true,
	routeLoggingFullBase64: true,
	routeLoggingObfuscateProperties: true,
	routeMetricsExcludePaths: true,
	routeTracingExcludePaths: true
};

/**
 * The set of camelCase property names (and wildcard patterns ending with *) that are valid
 * IEngineServerEnvironmentVariables keys.
 * Used at startup to detect unrecognised TWIN_* environment variables (typos, stale names).
 * The "restPath*" entry covers dynamic TWIN_REST_PATH_<COMPONENT_TYPE> variables.
 */
export const ENGINE_SERVER_ENVIRONMENT_VARIABLE_KEYS: ReadonlySet<string> = new Set([
	...Object.keys(engineServerEnvironmentVariableKeysInternal),
	"restPath*"
]);
