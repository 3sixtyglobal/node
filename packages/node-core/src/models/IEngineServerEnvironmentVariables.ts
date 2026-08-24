// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The engine server environment variables.
 */
export interface IEngineServerEnvironmentVariables {
	/**
	 * The port to serve the API from.
	 */
	port?: string;

	/**
	 * The host to serve the API from.
	 */
	host?: string;

	/**
	 * The CORS origins to allow, defaults to *.
	 */
	corsOrigins?: string;

	/**
	 * The CORS methods to allow, defaults to GET, POST, PUT, DELETE, OPTIONS.
	 */
	httpMethods?: string;

	/**
	 * The CORS headers to allow.
	 */
	httpAllowedHeaders?: string;

	/**
	 * The CORS headers to expose.
	 */
	httpExposedHeaders?: string;

	/**
	 * Named request body limits in bytes as comma separated name=bytes pairs, e.g. default=2097152,large=26214400.
	 */
	httpBodyLimits?: string;

	/**
	 * The public origin URL for the API e.g. https://api.example.com:1234
	 */
	publicOrigin?: string;

	/**
	 * The type of auth admin processor to use on the API: entity-storage.
	 */
	authAdminProcessorType?: string;

	/**
	 * The type of auth processor to use on the API: entity-storage.
	 */
	authProcessorType?: string;

	/**
	 * The id of the key in the vault to use for signing in auth operations.
	 */
	authSigningKeyId?: string;

	/**
	 * The HTTP header name used to pass the API key on requests, defaults to x-api-key.
	 */
	authApiKeyHeader?: string;

	/**
	 * Additional MIME type processors to include, comma separated.
	 */
	mimeTypeProcessors?: string;

	/**
	 * Include the body in the REST logging output, useful for debugging.
	 */
	routeLoggingIncludeBody?: string;

	/**
	 * Include the full base 64 output in the REST logging output, useful for debugging.
	 */
	routeLoggingFullBase64?: string;

	/**
	 * List of properties to obfuscate in the REST logging output, comma separated.
	 */
	routeLoggingObfuscateProperties?: string;

	/**
	 * Comma-separated list of URL path prefixes excluded from metrics collection.
	 */
	routeMetricsExcludePaths?: string;

	/**
	 * Comma-separated list of URL path prefixes excluded from tracing.
	 */
	routeTracingExcludePaths?: string;
}
