// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import type { IServerInfo, IWebServerOptions } from "@3sixty/api-models";
import { ContextIdKeys } from "@3sixty/context";
import { Coerce, EnvHelper, GeneralError, Is, StringHelper } from "@3sixty/core";
import type { IEngineCoreConfig } from "@3sixty/engine-models";
import { addDefaultRestPaths, addDefaultSocketPaths } from "@3sixty/engine-server";
import {
	AuthenticationAccountAdminComponentType,
	AuthenticationAccountComponentType,
	AuthenticationAdminComponentType,
	AuthenticationAuditComponentType,
	AuthenticationComponentType,
	AuthenticationProviderType,
	AuthenticationRateComponentType,
	type IEngineServerConfig,
	InformationComponentType,
	type MimeTypeProcessorType,
	OAuthComponentType,
	OrganizationComponentType,
	OrganizationRequestAdminComponentType,
	RestRouteProcessorType,
	SocketRouteProcessorType,
	WebServerType
} from "@3sixty/engine-server-types";
import { TraceparentHelper } from "@3sixty/tracing-models";
import {
	AUTHORIZATION_MODEL_ID,
	CONTEXT_ID_HANDLER_FEATURE_DID,
	CONTEXT_ID_HANDLER_FEATURE_TENANT,
	DEFAULT_ESCALATED_PRIVILEGE_ROLE,
	DEFAULT_TENANT_ADMIN_ROLE,
	DEFAULT_USER_ADMIN_ROLE
} from "../defaults.js";
import {
	isAuthorizationRequired,
	isTelemetryEnabled,
	isTracingEnabled
} from "./engineEnvBuilder.js";
import type { IEnvironmentVariables } from "../models/IEnvironmentVariables.js";

/**
 * The Microsoft tenant names that accept accounts from any tenant.
 */
const MICROSOFT_MULTI_TENANT_NAMES: string[] = ["common", "organizations", "consumers"];

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
		methods: EnvHelper.commaSeparatedListToArray(envVars.httpMethods, undefined),
		allowedHeaders: EnvHelper.commaSeparatedListToArray(envVars.httpAllowedHeaders, undefined),
		exposedHeaders: EnvHelper.commaSeparatedListToArray(envVars.httpExposedHeaders, undefined),
		corsOrigins: EnvHelper.commaSeparatedListToArray(envVars.corsOrigins, undefined),
		corsWildcardCredentials: Coerce.boolean(envVars.corsWildcardCredentials),
		trustedProxies: EnvHelper.commaSeparatedListToArray(envVars.trustedProxies, undefined),
		bodyLimits: EnvHelper.envKeyIntegerPairs(envVars, "httpBodyLimits"),
		publicOrigin: Coerce.string(envVars.publicOrigin),
		customWebConfig: {
			pluginTimeout: EnvHelper.envMs(envVars, "fastifyPluginTimeout", 30000)
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
		webServerType: EnvHelper.envChoice(envVars, "webServerType", Object.values(WebServerType)),
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
		const mimeTypeProcessors = EnvHelper.commaSeparatedListToArray(envVars.mimeTypeProcessors);

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
		const obfuscateProperties = EnvHelper.commaSeparatedListToArray<string>(
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
	// Socket connected handlers run in order, so the origin check comes before the route's handler.
	if (EnvHelper.envBoolean(envVars, "originCheckEnabled", false)) {
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.OriginCheck,
			options: {
				config: {
					allowedOrigins: webServerOptions.corsOrigins
				}
			}
		});
	}
	serverConfig.types.socketRouteProcessor.push({
		type: SocketRouteProcessorType.SocketRoute
	});

	const authAdminProcessorType = envVars.authAdminProcessorType;
	const authProcessorType = envVars.authProcessorType;
	const authorizationModelId = EnvHelper.envString(
		envVars,
		"authorizationModelId",
		AUTHORIZATION_MODEL_ID
	);
	const passwordHashOptions = buildPasswordHashOptions(envVars);
	const recentSignInSeconds = EnvHelper.envInteger(envVars, "authRecentSignInSeconds");

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
				config: {
					minPasswordLength: EnvHelper.envInteger(envVars, "authMinPasswordLength"),
					maxPasswordLength: EnvHelper.envInteger(envVars, "authMaxPasswordLength"),
					passwordHashOptions,
					escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE,
					authorizationModelId
				}
			}
		});

		serverConfig.types.authenticationAccountAdminComponent ??= [];
		serverConfig.types.authenticationAccountAdminComponent.push({
			type: AuthenticationAccountAdminComponentType.EntityStorage,
			options: {
				config: {
					verificationMethodId: envVars.trustVerificationMethodId,
					identityProofMaxAgeSeconds: EnvHelper.envInteger(
						envVars,
						"authIdentityProofMaxAgeSeconds"
					),
					escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE,
					authorizationModelId,
					recentSignInSeconds,
					// A global-admin may always grant these, even before any account holds them.
					assignableRoles:
						(Coerce.boolean(envVars.tenantEnabled) ?? false)
							? [DEFAULT_USER_ADMIN_ROLE, DEFAULT_TENANT_ADMIN_ROLE]
							: [DEFAULT_USER_ADMIN_ROLE]
				}
			}
		});

		// Membership credentials are signed with the trust verification method every organization has.
		serverConfig.types.organizationRequestAdminComponent ??= [];
		serverConfig.types.organizationRequestAdminComponent.push({
			type: OrganizationRequestAdminComponentType.EntityStorage,
			options: {
				config: {
					verificationMethodId: envVars.trustVerificationMethodId,
					escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE,
					authorizationModelId
				}
			}
		});

		// Organizations created by a global admin get the trust verification method, and accounts
		// only join registered organizations.
		serverConfig.types.organizationComponent ??= [];
		serverConfig.types.organizationComponent.push({
			type: OrganizationComponentType.EntityStorage,
			options: {
				config: {
					verificationMethodId: envVars.trustVerificationMethodId,
					identityProofMaxAgeSeconds: EnvHelper.envInteger(
						envVars,
						"authIdentityProofMaxAgeSeconds"
					),
					memberAdminRole: EnvHelper.envString(
						envVars,
						"authOrganizationMemberAdminRole",
						DEFAULT_USER_ADMIN_ROLE
					),
					escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE,
					authorizationModelId,
					recentSignInSeconds
				}
			}
		});
	}

	if (authProcessorType === AuthenticationComponentType.EntityStorage) {
		availableContextIdKeys.push({
			key: ContextIdKeys.User,
			requiredHandlerFeatures: [CONTEXT_ID_HANDLER_FEATURE_DID]
		});

		// Reset and verification links are sent by e-mail, so their addresses, a sender and an e-mail
		// connector must be configured.
		if (
			!Is.stringValue(envVars.authPasswordResetUrl) ||
			!Is.stringValue(envVars.authRegistrationVerificationUrl) ||
			!Is.stringValue(envVars.authEmailSender)
		) {
			throw new GeneralError("node", "authEmailConfigMissing");
		}
		if (!Is.arrayValue(serverConfig.types.messagingEmailConnector)) {
			throw new GeneralError("node", "authEmailMessagingMissing");
		}

		serverConfig.types.authenticationComponent ??= [];
		serverConfig.types.authenticationComponent.push({
			type: AuthenticationComponentType.EntityStorage,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId,
					minPasswordLength: EnvHelper.envInteger(envVars, "authMinPasswordLength"),
					maxPasswordLength: EnvHelper.envInteger(envVars, "authMaxPasswordLength"),
					emailSender: envVars.authEmailSender,
					emailCompanyName: envVars.authEmailCompanyName,
					emailLocale: envVars.authEmailLocale,
					passwordResetUrl: envVars.authPasswordResetUrl,
					passwordResetExpiryMinutes: EnvHelper.envInteger(
						envVars,
						"authPasswordResetExpiryMinutes"
					),
					passwordResetEmailTemplateId: envVars.authPasswordResetEmailTemplateId,
					passwordHashOptions,
					registrationVerificationUrl: envVars.authRegistrationVerificationUrl,
					registrationVerificationExpiryMinutes: EnvHelper.envInteger(
						envVars,
						"authRegistrationVerificationExpiryMinutes"
					),
					registrationVerificationEmailTemplateId:
						envVars.authRegistrationVerificationEmailTemplateId,
					registrationExistsEmailTemplateId: envVars.authRegistrationExistsEmailTemplateId,
					maxSessionMinutes: EnvHelper.envInteger(envVars, "authMaxSessionMinutes"),
					loginRateLimitPerClient: EnvHelper.envBoolean(
						envVars,
						"authLoginRateLimitPerClient",
						false
					),
					// The client address can only be trusted when it comes from a trusted proxy.
					clientAddressRateLimitEnabled: Is.arrayValue(webServerOptions.trustedProxies),
					defaultRoles: EnvHelper.commaSeparatedListToArray<string>(
						envVars.authDefaultRoles,
						undefined
					),
					escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE,
					authorizationModelId,
					recentSignInSeconds
				}
			}
		});
		configureAuthenticationProviders(serverConfig, envVars, passwordHashOptions);

		serverConfig.types.authenticationAccountComponent ??= [];
		serverConfig.types.authenticationAccountComponent.push({
			type: AuthenticationAccountComponentType.EntityStorage,
			options: {
				config: {
					verificationMethodId: envVars.trustVerificationMethodId,
					identityProofMaxAgeSeconds: EnvHelper.envInteger(
						envVars,
						"authIdentityProofMaxAgeSeconds"
					),
					recentSignInSeconds
				}
			}
		});

		// The token cookie is SameSite None by default, so cross site cookie requests can be refused
		// here, allowing the API and the listed CORS origins.
		if (EnvHelper.envBoolean(envVars, "originCheckEnabled", false)) {
			serverConfig.types.restRouteProcessor.push({
				type: RestRouteProcessorType.OriginCheck,
				options: {
					config: {
						allowedOrigins: webServerOptions.corsOrigins
					}
				}
			});
		}

		const cookieSameSite = EnvHelper.envChoice(envVars, "authCookieSameSite", [
			"Strict",
			"Lax",
			"None"
		]);
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.AuthHeader,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId,
					tokenCacheMutexTimeoutMs: EnvHelper.envMs(envVars, "mutexTimeoutDefault"),
					cookieSameSite
				}
			}
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.AuthHeader,
			options: {
				config: {
					signingKeyName: envVars.authSigningKeyId,
					tokenCacheMutexTimeoutMs: EnvHelper.envMs(envVars, "mutexTimeoutDefault"),
					cookieSameSite
				}
			}
		});
		// The route is authorized with the roles the account holds in its own tenant, before any
		// tenant override, the account id comes from the token.
		if (isAuthorizationRequired(envVars)) {
			serverConfig.types.restRouteProcessor.push({
				type: RestRouteProcessorType.Authorization,
				options: {
					config: {
						authorizationModelId
					}
				}
			});
			serverConfig.types.socketRouteProcessor.push({
				type: SocketRouteProcessorType.Authorization,
				options: {
					config: {
						authorizationModelId
					}
				}
			});
		}
		// The tenant override runs before the account processor, so the identity and organization of
		// the account are resolved in the tenant being switched to.
		if (isAuthorizationRequired(envVars) && tenantEnabled) {
			serverConfig.types.restRouteProcessor.push({
				type: RestRouteProcessorType.TenantOverride,
				options: {
					config: {
						authorizationModelId,
						escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE
					}
				}
			});
			serverConfig.types.socketRouteProcessor.push({
				type: SocketRouteProcessorType.TenantOverride,
				options: {
					config: {
						authorizationModelId,
						escalatedPrivilegeRole: DEFAULT_ESCALATED_PRIVILEGE_ROLE
					}
				}
			});
		}
		// The account processor sets the identity and organization of the signed in account.
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.AuthenticationAccount
		});
		serverConfig.types.socketRouteProcessor.push({
			type: SocketRouteProcessorType.AuthenticationAccount
		});
	}
	if (isTelemetryEnabled(envVars)) {
		serverConfig.types.restRouteProcessor.push({
			type: RestRouteProcessorType.Metrics,
			options: {
				config: {
					excludePaths: EnvHelper.commaSeparatedListToArray<string>(
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
					excludePaths: EnvHelper.commaSeparatedListToArray<string>(
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

/**
 * Build the Argon2id options for new password hashes from the environment variables.
 * @param envVars The environment variables.
 * @returns The options, undefined values use the service defaults.
 */
function buildPasswordHashOptions(envVars: IEnvironmentVariables): {
	iterations?: number;
	memoryKiB?: number;
	parallelism?: number;
} {
	return {
		iterations: EnvHelper.envInteger(envVars, "authPasswordHashIterations"),
		memoryKiB: EnvHelper.envInteger(envVars, "authPasswordHashMemoryKib"),
		parallelism: EnvHelper.envInteger(envVars, "authPasswordHashParallelism")
	};
}

/**
 * Configures the authentication providers from the comma separated list, and the OAuth sign in
 * service when an OAuth provider is enabled.
 * @param serverConfig The server config.
 * @param envVars The environment variables.
 * @param passwordHashOptions The Argon2id options for new password hashes.
 * @param passwordHashOptions.iterations The iterations.
 * @param passwordHashOptions.memoryKiB The memory in KiB.
 * @param passwordHashOptions.parallelism The parallelism.
 * @throws GeneralError when a provider is unknown or its settings are missing, an OAuth provider
 * is enabled without authorization, or without an allow list when open registration is turned off.
 */
function configureAuthenticationProviders(
	serverConfig: IEngineServerConfig,
	envVars: IEnvironmentVariables,
	passwordHashOptions: { iterations?: number; memoryKiB?: number; parallelism?: number }
): void {
	const openRegistration = EnvHelper.envBoolean(envVars, "authProviderOpenRegistration", true);
	const authProviders = EnvHelper.commaSeparatedListToArray<string>(
		envVars.authProviders ?? AuthenticationProviderType.EntityStorage
	);

	serverConfig.types.authenticationProvider ??= [];
	let oauthEnabled = false;

	for (const authProvider of authProviders) {
		if (authProvider === AuthenticationProviderType.EntityStorage) {
			serverConfig.types.authenticationProvider.push({
				type: AuthenticationProviderType.EntityStorage,
				options: {
					config: {
						passwordHashOptions
					}
				}
			});
		} else if (authProvider === AuthenticationProviderType.Google) {
			if (
				!Is.stringValue(envVars.authGoogleClientId) ||
				!Is.stringValue(envVars.authGoogleClientSecret)
			) {
				throw new GeneralError("node", "authProviderConfigMissing", { authProvider });
			}
			const allowedDomains = EnvHelper.commaSeparatedListToArray<string>(
				envVars.authGoogleAllowedDomains,
				undefined
			);
			if (!Is.arrayValue(allowedDomains) && !openRegistration) {
				throw new GeneralError("node", "authProviderAllowListMissing", { authProvider });
			}
			serverConfig.types.authenticationProvider.push({
				type: AuthenticationProviderType.Google,
				options: {
					config: {
						clientId: envVars.authGoogleClientId,
						clientSecret: envVars.authGoogleClientSecret,
						allowedDomains,
						profileEditUrl: envVars.authGoogleProfileEditUrl,
						passwordChangeUrl: envVars.authGooglePasswordChangeUrl
					}
				}
			});
			oauthEnabled = true;
		} else if (authProvider === AuthenticationProviderType.Microsoft) {
			if (
				!Is.stringValue(envVars.authMicrosoftClientId) ||
				!Is.stringValue(envVars.authMicrosoftClientSecret) ||
				!Is.stringValue(envVars.authMicrosoftTenant)
			) {
				throw new GeneralError("node", "authProviderConfigMissing", { authProvider });
			}
			const allowedTenants = EnvHelper.commaSeparatedListToArray<string>(
				envVars.authMicrosoftAllowedTenants,
				undefined
			);
			// A tenant id limits sign in to that tenant, the shared tenant names accept any tenant.
			if (
				MICROSOFT_MULTI_TENANT_NAMES.includes(envVars.authMicrosoftTenant.toLowerCase()) &&
				!Is.arrayValue(allowedTenants) &&
				!openRegistration
			) {
				throw new GeneralError("node", "authProviderAllowListMissing", { authProvider });
			}
			serverConfig.types.authenticationProvider.push({
				type: AuthenticationProviderType.Microsoft,
				options: {
					config: {
						clientId: envVars.authMicrosoftClientId,
						clientSecret: envVars.authMicrosoftClientSecret,
						tenant: envVars.authMicrosoftTenant,
						allowedTenants,
						profileEditUrl: envVars.authMicrosoftProfileEditUrl,
						passwordChangeUrl: envVars.authMicrosoftPasswordChangeUrl,
						personalProfileEditUrl: envVars.authMicrosoftPersonalProfileEditUrl,
						personalPasswordChangeUrl: envVars.authMicrosoftPersonalPasswordChangeUrl
					}
				}
			});
			oauthEnabled = true;
		} else {
			throw new GeneralError("node", "authProviderUnknown", { authProvider });
		}
	}

	if (oauthEnabled) {
		// A provider login creates an account for anyone the provider signs in, so authorization
		// must be enabled to limit what those accounts can do.
		if (!isAuthorizationRequired(envVars)) {
			throw new GeneralError("node", "authOAuthAuthorizationRequired");
		}
		if (
			!Is.stringValue(envVars.authOAuthSuccessRedirectUrl) ||
			!Is.stringValue(envVars.authOAuthFailureRedirectUrl)
		) {
			throw new GeneralError("node", "authOAuthRedirectMissing");
		}
		serverConfig.types.oauthComponent ??= [];
		serverConfig.types.oauthComponent.push({
			type: OAuthComponentType.Service,
			options: {
				config: {
					successRedirectUrl: envVars.authOAuthSuccessRedirectUrl,
					failureRedirectUrl: envVars.authOAuthFailureRedirectUrl,
					signingKeyName: envVars.authSigningKeyId
				}
			}
		});
	}
}
