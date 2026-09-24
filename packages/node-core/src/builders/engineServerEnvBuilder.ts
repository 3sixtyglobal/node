// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IServerInfo, IWebServerOptions } from "@twin.org/api-models";
import { ContextIdKeys } from "@twin.org/context";
import { Coerce, Is, StringHelper } from "@twin.org/core";
import type { IEngineCoreConfig } from "@twin.org/engine-models";
import { addDefaultRestPaths, addDefaultSocketPaths } from "@twin.org/engine-server";
import {
	AuthenticationAdminComponentType,
	AuthenticationAuditComponentType,
	AuthenticationComponentType,
	AuthenticationRateComponentType,
	type IEngineServerConfig,
	InformationComponentType,
	type MimeTypeProcessorType,
	RestRouteProcessorType,
	SocketRouteProcessorType
} from "@twin.org/engine-server-types";
import { TraceparentHelper } from "@twin.org/tracing-models";
import { CONTEXT_ID_HANDLER_FEATURE_DID, CONTEXT_ID_HANDLER_FEATURE_TENANT } from "../defaults.js";
import { isTelemetryEnabled, isTracingEnabled } from "./engineEnvBuilder.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";
import { commaSeparatedListToArray, envKeyIntegerPairs, envMs } from "./helper/envHelpers.js";

/**
 * Handles the configuration of the server.
 * @param envVars The environment variables for the engine server.
 * @param availableContextIdKeys The context ID keys.
 * @param coreEngineConfig The core engine config.
 * @param serverInfo The server information.
 * @param openApiSpecPath The path to the open api spec.
 * @param favIconPath The path to the favicon.
 * @returns The config for the core and the server.
 */
export async function buildEngineServerConfiguration(
	envVars: IEnvironmentVariables & { [id: string]: string | unknown },
	availableContextIdKeys: { key: string; requiredHandlerFeatures: string[] }[],
	coreEngineConfig: IEngineCoreConfig,
	serverInfo: IServerInfo,
	openApiSpecPath?: string,
	favIconPath?: string
): Promise<IEngineServerConfig> {
	const webServerOptions: IWebServerOptions = {
		port: Coerce.number(envVars.port),
		host: Coerce.string(envVars.host),
		methods: commaSeparatedListToArray(envVars.httpMethods, undefined),
		allowedHeaders: commaSeparatedListToArray(envVars.httpAllowedHeaders, undefined),
		exposedHeaders: commaSeparatedListToArray(envVars.httpExposedHeaders, undefined),
		corsOrigins: commaSeparatedListToArray(envVars.corsOrigins, undefined),
		bodyLimits: envKeyIntegerPairs(envVars, "httpBodyLimits"),
		publicOrigin: Coerce.string(envVars.publicOrigin),
		customWebConfig: {
			pluginTimeout: envMs(envVars, "fastifyPluginTimeout", 30000)
		}
	};

	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	const apiKeyHeader = envVars.authApiKeyHeader ?? "x-api-key";
	if (tenantEnabled) {
		webServerOptions.allowedHeaders ??= [];
		if (!webServerOptions.allowedHeaders.includes(apiKeyHeader)) {
			webServerOptions.allowedHeaders.push(apiKeyHeader);
		}
	}

	if (isTracingEnabled(envVars)) {
		webServerOptions.allowedHeaders ??= [];
		if (!webServerOptions.allowedHeaders.includes(TraceparentHelper.HEADER_NAME)) {
			webServerOptions.allowedHeaders.push(TraceparentHelper.HEADER_NAME);
		}
	}

	const serverConfig: IEngineServerConfig = {
		...coreEngineConfig,
		web: webServerOptions,
		types: {
			...coreEngineConfig.types,
			informationComponent: [
				{
					type: InformationComponentType.Service,
					options: {
						config: {
							serverInfo,
							openApiSpecPath,
							favIconPath
						}
					}
				}
			]
		}
	};

	if (Is.stringValue(envVars.mimeTypeProcessors)) {
		const mimeTypeProcessors = commaSeparatedListToArray(envVars.mimeTypeProcessors);

		if (Is.arrayValue(mimeTypeProcessors)) {
			serverConfig.types.mimeTypeProcessor ??= [];
			for (const mimeTypeProcessor of mimeTypeProcessors) {
				serverConfig.types.mimeTypeProcessor.push({
					type: mimeTypeProcessor as MimeTypeProcessorType
				});
			}
		}
	}

	serverConfig.types.restRouteProcessor ??= [];
	serverConfig.types.socketRouteProcessor ??= [];

	availableContextIdKeys.push({
		key: ContextIdKeys.Node,
		requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_DID]
	});

	serverConfig.types.restRouteProcessor.push({
		type: RestRouteProcessorType.ContextId,
		options: {
			config: {
				key: ContextIdKeys.Node
			}
		}
	});
	serverConfig.types.socketRouteProcessor.push({
		type: SocketRouteProcessorType.ContextId,
		options: {
			config: {
				key: ContextIdKeys.Node
			}
		}
	});

	if (tenantEnabled) {
		availableContextIdKeys.push({
			key: ContextIdKeys.Organization,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_DID]
		});
		availableContextIdKeys.push({
			key: ContextIdKeys.Tenant,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_TENANT]
		});

		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.Tenant,
			options: {
				config: {
					apiKeyName: apiKeyHeader
				}
			}
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.Tenant,
			options: {
				config: {
					apiKeyName: apiKeyHeader
				}
			}
		});
	} else {
		availableContextIdKeys.push({
			key: ContextIdKeys.Organization,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_DID]
		});

		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.SingleTenant
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.SingleTenant
		});
	}

	if (!coreEngineConfig.silent) {
		const includeBody = Coerce.boolean(envVars.routeLoggingIncludeBody) ?? coreEngineConfig.debug;
		const fullBase64 = Coerce.boolean(envVars.routeLoggingFullBase64) ?? false;
		const obfuscateProperties = commaSeparatedListToArray<string>(
			envVars.routeLoggingObfuscateProperties,
			undefined
		);
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.Logging,
			options: {
				config: {
					includeBody,
					fullBase64,
					obfuscateProperties
				}
			}
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.Logging,
			options: {
				config: {
					includeBody,
					fullBase64,
					obfuscateProperties
				}
			}
		});
	}
	serverConfig.types.restRouteProcessor.push({
		type: RestRouteProcessorType.RestRoute
	});
	serverConfig.types.socketRouteProcessor.push({
		type: SocketRouteProcessorType.SocketRoute
	});

	const authAdminProcessorType = envVars.authAdminProcessorType;
	const authProcessorType = envVars.authProcessorType;

	if (
		authAdminProcessorType === AuthenticationAdminComponentType.EntityStorage ||
		authProcessorType === AuthenticationComponentType.EntityStorage
	) {
		serverConfig.types.authenticationRateComponent ??= [];
		serverConfig.types.authenticationRateComponent.push({
			type: AuthenticationRateComponentType.EntityStorage
		});

		serverConfig.types.authenticationAuditComponent ??= [];
		serverConfig.types.authenticationAuditComponent.push({
			type: AuthenticationAuditComponentType.EntityStorage
		});
	}

	if (authAdminProcessorType === AuthenticationAdminComponentType.EntityStorage) {
		serverConfig.types.authenticationAdminComponent ??= [];
		serverConfig.types.authenticationAdminComponent.push({
			type: AuthenticationAdminComponentType.EntityStorage,
			options: {
				config: {}
			}
		});
	}

	if (authProcessorType === AuthenticationComponentType.EntityStorage) {
		availableContextIdKeys.push({
			key: ContextIdKeys.User,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_DID]
		});

		serverConfig.types.authenticationComponent ??= [];
		serverConfig.types.authenticationComponent.push({
			type: AuthenticationComponentType.EntityStorage,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId
				}
			}
		});
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.AuthHeader,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId,
					tokenCacheMutexTimeoutMs: envMs(envVars, "mutexTimeoutDefault")
				}
			}
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.AuthHeader,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId,
					tokenCacheMutexTimeoutMs: envMs(envVars, "mutexTimeoutDefault")
				}
			}
		});
		if (tenantEnabled) {
			serverConfig.types.restRouteProcessor.push({
				type: RestRouteProcessorType.TenantOverride,
				options: {
					config: {}
				}
			});
			serverConfig.types.socketRouteProcessor.push({
				type: SocketRouteProcessorType.TenantOverride,
				options: {
					config: {}
				}
			});
		}
	}

	if (isTelemetryEnabled(envVars)) {
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.Metrics,
			options: {
				config: {
					excludePaths: commaSeparatedListToArray<string>(
						envVars.routeMetricsExcludePaths,
						undefined
					)
				}
			}
		});
	}

	if (isTracingEnabled(envVars)) {
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.Tracing,
			options: {
				config: {
					excludePaths: commaSeparatedListToArray<string>(
						envVars.routeTracingExcludePaths,
						undefined
					)
				}
			}
		});
	}

	addDefaultRestPaths(serverConfig);
	addDefaultSocketPaths(serverConfig);

	// See if any of the rest paths should be overridden by environment variables and update the config accordingly
	// Should be in the format TWIN_REST_PATH_<COMPONENT_TYPE> e.g. TWIN_REST_PATH_TENANT_ADMIN=my-tenants
	for (const componentType in serverConfig.types) {
		const types = serverConfig.types[componentType];

		if (Is.arrayValue(types)) {
			for (const typeConfig of types) {
				if (Is.stringValue(typeConfig.restPath)) {
					const envVarName = `restPath${StringHelper.pascalCase(componentType.replace("Component", ""))}`;
					const overrideRestPath = envVars[envVarName];
					if (Is.stringValue(overrideRestPath)) {
						typeConfig.restPath = overrideRestPath;
					}
					break;
				}
			}
		}
	}

	return serverConfig;
}

/**
 * Checks if the authentication entity storage subsystem is required.
 * Returns true when any component that depends on the authentication entity storage subsystem is enabled.
 * @param envVars The environment variables.
 * @returns True if authentication entity storage is enabled.
 */
export function isAuthEntityStorageRequired(envVars: IEnvironmentVariables): boolean {
	return (
		envVars.authAdminProcessorType === AuthenticationAdminComponentType.EntityStorage ||
		envVars.authProcessorType === AuthenticationComponentType.EntityStorage
	);
}
