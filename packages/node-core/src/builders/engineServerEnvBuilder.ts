// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IServerInfo, IWebServerOptions } from "@twin.org/api-models";
import { ContextIdKeys } from "@twin.org/context";
import { Coerce, GeneralError, Is, StringHelper, Url } from "@twin.org/core";
import type { IEngineCoreConfig } from "@twin.org/engine-models";
import { addDefaultRestPaths, addDefaultSocketPaths } from "@twin.org/engine-server";
import {
	AuthenticationAdminComponentType,
	AuthenticationAuditComponentType,
	AuthenticationComponentType,
	AuthenticationRateComponentType,
	HostingComponentType,
	type IEngineServerConfig,
	InformationComponentType,
	type MimeTypeProcessorType,
	RestRouteProcessorType,
	SocketRouteProcessorType
} from "@twin.org/engine-server-types";
import type { HttpMethod } from "@twin.org/web";
import { CONTEXT_ID_HANDLER_FEATURE_DID, CONTEXT_ID_HANDLER_FEATURE_TENANT } from "../defaults.js";
import type { IEngineServerEnvironmentVariables } from "../models/IEngineServerEnvironmentVariables.js";

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
	envVars: IEngineServerEnvironmentVariables & { [id: string]: string | unknown },
	availableContextIdKeys: { key: string; requiredHandlerFeatures: string[] }[],
	coreEngineConfig: IEngineCoreConfig,
	serverInfo: IServerInfo,
	openApiSpecPath?: string,
	favIconPath?: string
): Promise<IEngineServerConfig> {
	const webServerOptions: IWebServerOptions = {
		port: Coerce.number(envVars.port),
		host: Coerce.string(envVars.host),
		methods: Is.stringValue(envVars.httpMethods)
			? (envVars.httpMethods.split(",") as HttpMethod[])
			: undefined,
		allowedHeaders: Is.stringValue(envVars.httpAllowedHeaders)
			? envVars.httpAllowedHeaders.split(",")
			: undefined,
		exposedHeaders: Is.stringValue(envVars.httpExposedHeaders)
			? envVars.httpExposedHeaders.split(",")
			: undefined,
		corsOrigins: Is.stringValue(envVars.corsOrigins) ? envVars.corsOrigins.split(",") : undefined
	};

	const localOrigin = `http://${webServerOptions.host ?? "localhost"}:${webServerOptions.port ?? 3000}`;

	let publicOrigin;
	if (Is.stringValue(envVars.publicOrigin)) {
		const publicUrl = Url.tryParseExact(envVars.publicOrigin);
		if (!Is.empty(publicUrl)) {
			const urlParts = publicUrl.parts();
			publicOrigin = `${urlParts.schema}://${urlParts.host}${Is.integer(urlParts.port) ? `:${urlParts.port}` : ""}`;
		} else {
			throw new GeneralError("node", "invalidPublicOrigin", { publicOrigin: envVars.publicOrigin });
		}
	}

	const nodeIdentityEnabled = Coerce.boolean(envVars.nodeIdentityEnabled) ?? true;
	const tenantEnabled = Coerce.boolean(envVars.tenantEnabled) ?? false;
	if (tenantEnabled) {
		webServerOptions.allowedHeaders ??= [];
		if (!webServerOptions.allowedHeaders.includes("x-api-key")) {
			webServerOptions.allowedHeaders.push("x-api-key");
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
			],
			hostingComponent: [
				{
					type: HostingComponentType.Service,
					options: {
						config: {
							localOrigin,
							publicOrigin
						}
					}
				}
			]
		}
	};

	if (Is.stringValue(envVars.mimeTypeProcessors)) {
		const mimeTypeProcessors = envVars.mimeTypeProcessors.split(",");

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

	if (nodeIdentityEnabled) {
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
	}

	if (tenantEnabled) {
		availableContextIdKeys.push({
			key: ContextIdKeys.Tenant,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_TENANT]
		});

		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.Tenant,
			options: {
				config: {
					signingKeyName: envVars.tenantTokenEncryptionKeyId
				}
			}
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.Tenant,
			options: {
				config: {
					signingKeyName: envVars.tenantTokenEncryptionKeyId
				}
			}
		});
	}

	if (!coreEngineConfig.silent) {
		const includeBody = Coerce.boolean(envVars.routeLoggingIncludeBody) ?? coreEngineConfig.debug;
		const fullBase64 = Coerce.boolean(envVars.routeLoggingFullBase64) ?? false;
		const obfuscateProperties = Is.stringValue(envVars.routeLoggingObfuscateProperties)
			? envVars.routeLoggingObfuscateProperties.split(",")
			: undefined;
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
		type: RestRouteProcessorType.RestRoute,
		options: {
			config: {
				includeErrorStack: coreEngineConfig.debug
			}
		}
	});
	serverConfig.types.socketRouteProcessor.push({
		type: SocketRouteProcessorType.SocketRoute,
		options: {
			config: {
				includeErrorStack: coreEngineConfig.debug
			}
		}
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
			key: ContextIdKeys.Organization,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_DID]
		});
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
					signingKeyName: envVars.authSigningKeyId
				}
			}
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.AuthHeader,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId
				}
			}
		});
	}

	addDefaultRestPaths(serverConfig);
	addDefaultSocketPaths(serverConfig);

	// See if any of the rest paths should be overridden by environment variables and update the config accordingly
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
