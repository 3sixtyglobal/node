// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdKeys } from "@3sixty/context";
import type { IEngineCoreConfig } from "@3sixty/engine-models";
import {
	AuthenticationComponentType,
	AuthenticationProviderType,
	OAuthComponentType,
	OrganizationComponentType,
	OrganizationRequestAdminComponentType,
	RestRouteProcessorType,
	SocketRouteProcessorType,
	WebServerType
} from "@3sixty/engine-server-types";
import { AuthorizationConnectorType, MessagingEmailConnectorType } from "@3sixty/engine-types";
import { buildEngineServerConfiguration } from "../../src/builders/engineServerEnvBuilder.js";

const SERVER_INFO = { name: "test", version: "0.0.0" };
const BASE_VARS = { port: "3000" };
// Entity storage authentication needs authorization, and the addresses and sender of its e-mails.
const ENTITY_STORAGE_AUTH_VARS = {
	authProcessorType: AuthenticationComponentType.EntityStorage,
	authorizationConnector: AuthorizationConnectorType.EntityStorage,
	authPasswordResetUrl: "https://app.example.com/reset",
	authRegistrationVerificationUrl: "https://app.example.com/verify",
	authEmailSender: "no-reply@example.com"
};

/**
 * Create a core configuration with an e-mail connector, which entity storage authentication needs.
 * @returns The core configuration.
 */
function emailCoreConfig(): IEngineCoreConfig {
	return {
		types: { messagingEmailConnector: [{ type: MessagingEmailConnectorType.EntityStorage }] }
	};
}

describe("buildEngineServerConfiguration - auth header processors", () => {
	test("mutex timeout default seeds the auth header token cache timeout", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				...ENTITY_STORAGE_AUTH_VARS,
				mutexTimeoutDefault: "60000"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		const processors = [
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.AuthHeader),
			config.types.socketRouteProcessor?.find(p => p.type === SocketRouteProcessorType.AuthHeader)
		];

		for (const processor of processors) {
			expect(
				(processor?.options as { config?: { tokenCacheMutexTimeoutMs?: number } })?.config
					?.tokenCacheMutexTimeoutMs
			).toBe(60000);
		}
	});

	test("leaves the cookie SameSite to the processor default when not set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, ...ENTITY_STORAGE_AUTH_VARS },
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.AuthHeader)
				?.options
		).toMatchObject({ config: { cookieSameSite: undefined } });
	});

	test("passes the cookie SameSite to the auth header processors", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				...ENTITY_STORAGE_AUTH_VARS,
				authCookieSameSite: "None"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.AuthHeader)
				?.options
		).toMatchObject({ config: { cookieSameSite: "None" } });
		expect(
			config.types.socketRouteProcessor?.find(p => p.type === SocketRouteProcessorType.AuthHeader)
				?.options
		).toMatchObject({ config: { cookieSameSite: "None" } });
	});

	test("throws when the cookie SameSite is not supported", async () => {
		await expect(
			buildEngineServerConfiguration(
				{
					...BASE_VARS,
					...ENTITY_STORAGE_AUTH_VARS,
					authCookieSameSite: "Sometimes"
				},
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow();
	});
});

describe("buildEngineServerConfiguration - web security", () => {
	test("registers the origin check with the CORS origins before the auth header when enabled", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				...ENTITY_STORAGE_AUTH_VARS,
				corsOrigins: "https://app.example.com,https://admin.example.com",
				originCheckEnabled: "true"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		const types = config.types.restRouteProcessor?.map(p => p.type) ?? [];
		expect(types.indexOf(RestRouteProcessorType.OriginCheck)).toBeGreaterThanOrEqual(0);
		expect(types.indexOf(RestRouteProcessorType.OriginCheck)).toBeLessThan(
			types.indexOf(RestRouteProcessorType.AuthHeader)
		);
		expect(
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.OriginCheck)
				?.options
		).toEqual({
			config: { allowedOrigins: ["https://app.example.com", "https://admin.example.com"] }
		});

		const socketTypes = config.types.socketRouteProcessor?.map(p => p.type) ?? [];
		expect(socketTypes.indexOf(SocketRouteProcessorType.OriginCheck)).toBeGreaterThanOrEqual(0);
		expect(socketTypes.indexOf(SocketRouteProcessorType.OriginCheck)).toBeLessThan(
			socketTypes.indexOf(SocketRouteProcessorType.SocketRoute)
		);
		expect(config.web?.corsWildcardCredentials).toBeUndefined();
		expect(config.web?.trustedProxies).toBeUndefined();
	});

	test("does not register the origin check by default or when disabled", async () => {
		for (const vars of [{}, { originCheckEnabled: "false" }]) {
			const config = await buildEngineServerConfiguration(
				{ ...BASE_VARS, ...ENTITY_STORAGE_AUTH_VARS, ...vars },
				[],
				emailCoreConfig(),
				SERVER_INFO
			);
			expect(
				config.types.restRouteProcessor?.some(p => p.type === RestRouteProcessorType.OriginCheck)
			).toBe(false);
			expect(
				config.types.socketRouteProcessor?.some(
					p => p.type === SocketRouteProcessorType.OriginCheck
				)
			).toBe(false);
		}
	});

	test("passes the trusted proxies and wildcard credentials to the web server", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, trustedProxies: "10.0.0.0/8, 192.168.1.1", corsWildcardCredentials: "true" },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.trustedProxies).toEqual(["10.0.0.0/8", "192.168.1.1"]);
		expect(config.web?.corsWildcardCredentials).toBe(true);
	});
});

describe("buildEngineServerConfiguration - TenantOverride processors", () => {
	test("registers TenantOverride REST and socket processors when tenant mode and auth are enabled", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				...ENTITY_STORAGE_AUTH_VARS,
				authorizationConnector: AuthorizationConnectorType.EntityStorage
			},
			contextKeys,
			emailCoreConfig(),
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const socketTypes = (config.types.socketRouteProcessor ?? []).map(p => p.type);

		expect(restTypes).toContain(RestRouteProcessorType.TenantOverride);
		expect(socketTypes).toContain(SocketRouteProcessorType.TenantOverride);
		expect(
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.TenantOverride)
		).toMatchObject({ options: { config: { authorizationModelId: "system" } } });
	});

	test("passes the configured authorization model to TenantOverride processors", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				...ENTITY_STORAGE_AUTH_VARS,
				authorizationConnector: AuthorizationConnectorType.EntityStorage,
				authorizationModelId: "custom"
			},
			contextKeys,
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.TenantOverride)
		).toMatchObject({ options: { config: { authorizationModelId: "custom" } } });
		expect(
			config.types.socketRouteProcessor?.find(
				p => p.type === SocketRouteProcessorType.TenantOverride
			)
		).toMatchObject({ options: { config: { authorizationModelId: "custom" } } });
	});

	test("TenantOverride processor is registered after AuthHeader processor", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				...ENTITY_STORAGE_AUTH_VARS,
				authorizationConnector: AuthorizationConnectorType.EntityStorage
			},
			contextKeys,
			emailCoreConfig(),
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const authHeaderIdx = restTypes.indexOf(RestRouteProcessorType.AuthHeader);
		const tenantOverrideIdx = restTypes.indexOf(RestRouteProcessorType.TenantOverride);

		expect(authHeaderIdx).toBeGreaterThanOrEqual(0);
		expect(tenantOverrideIdx).toBeGreaterThan(authHeaderIdx);
	});

	test("Authorization processor is registered before the TenantOverride processor, so routes are authorized in the caller's own tenant", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				...ENTITY_STORAGE_AUTH_VARS,
				authorizationConnector: AuthorizationConnectorType.EntityStorage
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		for (const [types, authorization, tenantOverride] of [
			[
				(config.types.restRouteProcessor ?? []).map(p => p.type),
				RestRouteProcessorType.Authorization,
				RestRouteProcessorType.TenantOverride
			],
			[
				(config.types.socketRouteProcessor ?? []).map(p => p.type),
				SocketRouteProcessorType.Authorization,
				SocketRouteProcessorType.TenantOverride
			]
		] as [string[], string, string][]) {
			expect(types.indexOf(authorization)).toBeGreaterThanOrEqual(0);
			expect(types.indexOf(authorization)).toBeLessThan(types.indexOf(tenantOverride));
		}
	});

	test("TenantOverride processor is registered before the AuthenticationAccount processor", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				tenantEnabled: "true",
				...ENTITY_STORAGE_AUTH_VARS,
				authorizationConnector: AuthorizationConnectorType.EntityStorage
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		for (const [types, tenantOverride, account] of [
			[
				(config.types.restRouteProcessor ?? []).map(p => p.type),
				RestRouteProcessorType.TenantOverride,
				RestRouteProcessorType.AuthenticationAccount
			],
			[
				(config.types.socketRouteProcessor ?? []).map(p => p.type),
				SocketRouteProcessorType.TenantOverride,
				SocketRouteProcessorType.AuthenticationAccount
			]
		] as [string[], string, string][]) {
			expect(types.indexOf(tenantOverride)).toBeGreaterThanOrEqual(0);
			expect(types.indexOf(tenantOverride)).toBeLessThan(types.indexOf(account));
		}
		expect(
			config.types.restRouteProcessor?.find(p => p.type === RestRouteProcessorType.TenantOverride)
		).toMatchObject({ options: { config: { escalatedPrivilegeRole: "global-admin" } } });
	});

	test("does not register TenantOverride processors when tenant mode is disabled", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, ...ENTITY_STORAGE_AUTH_VARS },
			contextKeys,
			emailCoreConfig(),
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const socketTypes = (config.types.socketRouteProcessor ?? []).map(p => p.type);

		expect(restTypes).not.toContain(RestRouteProcessorType.TenantOverride);
		expect(socketTypes).not.toContain(SocketRouteProcessorType.TenantOverride);
	});

	test("does not register TenantOverride processors when auth processor is not configured", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, tenantEnabled: "true" },
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const restTypes = (config.types.restRouteProcessor ?? []).map(p => p.type);
		const socketTypes = (config.types.socketRouteProcessor ?? []).map(p => p.type);

		expect(restTypes).not.toContain(RestRouteProcessorType.TenantOverride);
		expect(socketTypes).not.toContain(SocketRouteProcessorType.TenantOverride);
	});
});

describe("buildEngineServerConfiguration - auth context keys", () => {
	test("registers DID context keys and auth component when authProcessorType is set", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				...ENTITY_STORAGE_AUTH_VARS
			},
			contextKeys,
			emailCoreConfig(),
			SERVER_INFO
		);

		const keys = contextKeys.map(k => k.key);
		expect(keys).toContain(ContextIdKeys.Organization);
		expect(keys).toContain(ContextIdKeys.User);
		expect(config.types.authenticationComponent).toBeDefined();
	});

	test("does not register auth component when authProcessorType is not set", async () => {
		const contextKeys: { key: string; requiredHandlerFeatures: string[] }[] = [];
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS },
			contextKeys,
			{ types: {} },
			SERVER_INFO
		);

		const keys = contextKeys.map(k => k.key);
		expect(keys).not.toContain(ContextIdKeys.User);
		expect(config.types.authenticationComponent).toBeUndefined();
	});

	test("registers the organization request admin with the trust verification method", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				authAdminProcessorType: "entity-storage",
				trustVerificationMethodId: "trust-assertion"
			},
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.types.organizationRequestAdminComponent).toMatchObject([
			{
				type: OrganizationRequestAdminComponentType.EntityStorage,
				options: {
					config: {
						verificationMethodId: "trust-assertion",
						escalatedPrivilegeRole: "global-admin",
						authorizationModelId: "system"
					}
				}
			}
		]);
	});
});

describe("buildEngineServerConfiguration - custom web config", () => {
	test("defaults the Fastify plugin timeout to 30000 when the env var is not set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.customWebConfig).toEqual({ pluginTimeout: 30000 });
	});

	test("uses the Fastify plugin timeout from the env var when set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, fastifyPluginTimeout: "60000" },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.web?.customWebConfig).toEqual({ pluginTimeout: 60000 });
	});

	test("throws when the Fastify plugin timeout is not an integer", async () => {
		await expect(
			buildEngineServerConfiguration(
				{ ...BASE_VARS, fastifyPluginTimeout: "not-a-number" },
				[],
				{ types: {} },
				SERVER_INFO
			)
		).rejects.toThrow("invalidEnvVarValue");
	});
});

describe("buildEngineServerConfiguration - web server type", () => {
	test("leaves the web server type unset by default", async () => {
		const config = await buildEngineServerConfiguration(BASE_VARS, [], { types: {} }, SERVER_INFO);

		expect(config.webServerType).toBeUndefined();
	});

	test("uses the web server type from the env var when set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, webServerType: WebServerType.Hono },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.webServerType).toBe(WebServerType.Hono);
	});

	test("uses the native web server type from the env var when set", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...BASE_VARS, webServerType: WebServerType.Native },
			[],
			{ types: {} },
			SERVER_INFO
		);

		expect(config.webServerType).toBe(WebServerType.Native);
	});

	test("throws when the web server type is not supported", async () => {
		await expect(
			buildEngineServerConfiguration(
				{ ...BASE_VARS, webServerType: "express" },
				[],
				{ types: {} },
				SERVER_INFO
			)
		).rejects.toThrow();
	});
});

describe("buildEngineServerConfiguration - authentication providers", () => {
	const AUTH_VARS = {
		...BASE_VARS,
		...ENTITY_STORAGE_AUTH_VARS
	};
	const OAUTH_VARS = {
		...AUTH_VARS,
		authorizationConnector: AuthorizationConnectorType.EntityStorage,
		authOAuthSuccessRedirectUrl: "https://app.example.com/",
		authOAuthFailureRedirectUrl: "https://app.example.com/login"
	};

	test("throws without an e-mail connector", async () => {
		await expect(
			buildEngineServerConfiguration(AUTH_VARS, [], { types: {} }, SERVER_INFO)
		).rejects.toThrow("authEmailMessagingMissing");
	});

	test("throws without the reset address, verification address or e-mail sender", async () => {
		for (const missing of [
			"authPasswordResetUrl",
			"authRegistrationVerificationUrl",
			"authEmailSender"
		]) {
			await expect(
				buildEngineServerConfiguration(
					{ ...AUTH_VARS, [missing]: undefined },
					[],
					emailCoreConfig(),
					SERVER_INFO
				)
			).rejects.toThrow("authEmailConfigMissing");
		}
	});

	test("enables the entity storage provider by default and no OAuth service", async () => {
		const config = await buildEngineServerConfiguration(
			AUTH_VARS,
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider).toEqual([
			{
				type: AuthenticationProviderType.EntityStorage,
				options: { config: { passwordHashOptions: {} } }
			}
		]);
		expect(config.types.oauthComponent).toBeUndefined();
	});

	test("enables each provider in the list and the OAuth service", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...OAUTH_VARS,
				authSigningKeyId: "auth-signing",
				authProviders: "entity-storage,google,microsoft",
				authGoogleClientId: "google-client",
				authGoogleClientSecret: "google-secret",
				authGoogleAllowedDomains: "example.com,example.org",
				authMicrosoftClientId: "ms-client",
				authMicrosoftClientSecret: "ms-secret",
				authMicrosoftTenant: "organizations",
				authMicrosoftAllowedTenants: "tenant-1"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider).toEqual([
			{
				type: AuthenticationProviderType.EntityStorage,
				options: { config: { passwordHashOptions: {} } }
			},
			{
				type: AuthenticationProviderType.Google,
				options: {
					config: {
						clientId: "google-client",
						clientSecret: "google-secret",
						allowedDomains: ["example.com", "example.org"]
					}
				}
			},
			{
				type: AuthenticationProviderType.Microsoft,
				options: {
					config: {
						clientId: "ms-client",
						clientSecret: "ms-secret",
						tenant: "organizations",
						allowedTenants: ["tenant-1"]
					}
				}
			}
		]);
		expect(config.types.oauthComponent).toMatchObject([
			{
				type: OAuthComponentType.Service,
				options: {
					config: {
						successRedirectUrl: "https://app.example.com/",
						failureRedirectUrl: "https://app.example.com/login",
						signingKeyName: "auth-signing"
					}
				}
			}
		]);
	});

	test("passes the provider account addresses to the connectors when set", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...OAUTH_VARS,
				authProviders: "google,microsoft",
				authGoogleClientId: "google-client",
				authGoogleClientSecret: "google-secret",
				authGoogleProfileEditUrl: "https://google.example.com/profile",
				authGooglePasswordChangeUrl: "https://google.example.com/password",
				authMicrosoftClientId: "ms-client",
				authMicrosoftClientSecret: "ms-secret",
				authMicrosoftTenant: "common",
				authMicrosoftProfileEditUrl: "https://ms.example.com/profile",
				authMicrosoftPasswordChangeUrl: "https://ms.example.com/password",
				authMicrosoftPersonalProfileEditUrl: "https://ms.example.com/personal-profile",
				authMicrosoftPersonalPasswordChangeUrl: "https://ms.example.com/personal-password"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider?.[0].options?.config).toMatchObject({
			profileEditUrl: "https://google.example.com/profile",
			passwordChangeUrl: "https://google.example.com/password"
		});
		expect(config.types.authenticationProvider?.[1].options?.config).toMatchObject({
			profileEditUrl: "https://ms.example.com/profile",
			passwordChangeUrl: "https://ms.example.com/password",
			personalProfileEditUrl: "https://ms.example.com/personal-profile",
			personalPasswordChangeUrl: "https://ms.example.com/personal-password"
		});
	});

	test("leaves the provider account addresses unset so the connector defaults apply", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...OAUTH_VARS,
				authProviders: "google,microsoft",
				authGoogleClientId: "google-client",
				authGoogleClientSecret: "google-secret",
				authMicrosoftClientId: "ms-client",
				authMicrosoftClientSecret: "ms-secret",
				authMicrosoftTenant: "common"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider).toEqual([
			{
				type: AuthenticationProviderType.Google,
				options: { config: { clientId: "google-client", clientSecret: "google-secret" } }
			},
			{
				type: AuthenticationProviderType.Microsoft,
				options: { config: { clientId: "ms-client", clientSecret: "ms-secret", tenant: "common" } }
			}
		]);
	});

	test("allows OAuth providers without the password provider", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...OAUTH_VARS,
				authProviders: "google",
				authGoogleClientId: "google-client",
				authGoogleClientSecret: "google-secret",
				authGoogleAllowedDomains: "example.com"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider?.map(p => p.type)).toEqual([
			AuthenticationProviderType.Google
		]);
	});

	test("throws for an unknown provider", async () => {
		await expect(
			buildEngineServerConfiguration(
				{ ...AUTH_VARS, authProviders: "entity-storage,github" },
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authProviderUnknown");
	});

	test("throws when an OAuth provider has no client settings", async () => {
		await expect(
			buildEngineServerConfiguration(
				{ ...AUTH_VARS, authProviders: "google" },
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authProviderConfigMissing");
	});

	test("throws when an OAuth provider is enabled without redirect addresses", async () => {
		await expect(
			buildEngineServerConfiguration(
				{
					...AUTH_VARS,
					authorizationConnector: AuthorizationConnectorType.EntityStorage,
					authProviders: "microsoft",
					authMicrosoftClientId: "ms-client",
					authMicrosoftClientSecret: "ms-secret",
					authMicrosoftTenant: "organizations",
					authMicrosoftAllowedTenants: "tenant-1"
				},
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authOAuthRedirectMissing");
	});

	test("throws when the microsoft provider has no tenant", async () => {
		await expect(
			buildEngineServerConfiguration(
				{
					...OAUTH_VARS,
					authProviders: "microsoft",
					authMicrosoftClientId: "ms-client",
					authMicrosoftClientSecret: "ms-secret"
				},
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authProviderConfigMissing");
	});

	test("throws when an OAuth provider is enabled without authorization", async () => {
		await expect(
			buildEngineServerConfiguration(
				{
					...OAUTH_VARS,
					authorizationConnector: undefined,
					authProviders: "google",
					authGoogleClientId: "google-client",
					authGoogleClientSecret: "google-secret",
					authGoogleAllowedDomains: "example.com"
				},
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authOAuthAuthorizationRequired");
	});

	test("uses the system authorization model by default", async () => {
		const config = await buildEngineServerConfiguration(
			AUTH_VARS,
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: { authorizationModelId: "system" }
		});
	});

	test("passes the configured default roles to the authentication component", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authDefaultRoles: "user,trader"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: { defaultRoles: ["user", "trader"] }
		});
	});

	test("passes the identity proof window and trust verification method to the account components", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authAdminProcessorType: "entity-storage",
				trustVerificationMethodId: "trust-assertion",
				authIdentityProofMaxAgeSeconds: "120"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationAccountComponent?.[0].options).toEqual({
			config: { verificationMethodId: "trust-assertion", identityProofMaxAgeSeconds: 120 }
		});
		expect(config.types.authenticationAccountAdminComponent?.[0].options).toEqual({
			config: {
				verificationMethodId: "trust-assertion",
				identityProofMaxAgeSeconds: 120,
				escalatedPrivilegeRole: "global-admin",
				authorizationModelId: "system",
				assignableRoles: ["user-admin"],
				recentSignInSeconds: undefined
			}
		});
	});

	test("passes the recent sign in window to the authentication, account and organization components", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authAdminProcessorType: "entity-storage",
				authRecentSignInSeconds: "90"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: { recentSignInSeconds: 90 }
		});
		expect(config.types.authenticationAccountComponent?.[0].options).toMatchObject({
			config: { recentSignInSeconds: 90 }
		});
		expect(config.types.organizationComponent?.[0].options).toMatchObject({
			config: { recentSignInSeconds: 90 }
		});
	});

	test("passes the password reset settings to the authentication component", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authPasswordResetUrl: "https://app.example.com/reset",
				authEmailSender: "no-reply@example.com",
				authPasswordResetEmailTemplateId: "reset-template",
				authEmailLocale: "de",
				authPasswordResetExpiryMinutes: "15"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: {
				passwordResetUrl: "https://app.example.com/reset",
				emailSender: "no-reply@example.com",
				passwordResetEmailTemplateId: "reset-template",
				emailLocale: "de",
				passwordResetExpiryMinutes: 15
			}
		});
	});

	test("registers the organization component with the trust verification method", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...BASE_VARS,
				authAdminProcessorType: "entity-storage",
				trustVerificationMethodId: "trust-assertion",
				authOrganizationMemberAdminRole: "org-admin",
				authIdentityProofMaxAgeSeconds: "600"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.organizationComponent).toMatchObject([
			{
				type: OrganizationComponentType.EntityStorage,
				options: {
					config: {
						verificationMethodId: "trust-assertion",
						identityProofMaxAgeSeconds: 600,
						memberAdminRole: "org-admin",
						escalatedPrivilegeRole: "global-admin",
						authorizationModelId: "system"
					}
				}
			}
		]);
	});

	test("throws when google is enabled without allowed domains and open registration is off", async () => {
		await expect(
			buildEngineServerConfiguration(
				{
					...OAUTH_VARS,
					authProviderOpenRegistration: "false",
					authProviders: "google",
					authGoogleClientId: "google-client",
					authGoogleClientSecret: "google-secret"
				},
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authProviderAllowListMissing");
	});

	test("throws when a multi tenant microsoft sign in has no allowed tenants and open registration is off", async () => {
		await expect(
			buildEngineServerConfiguration(
				{
					...OAUTH_VARS,
					authProviderOpenRegistration: "false",
					authProviders: "microsoft",
					authMicrosoftClientId: "ms-client",
					authMicrosoftClientSecret: "ms-secret",
					authMicrosoftTenant: "common"
				},
				[],
				emailCoreConfig(),
				SERVER_INFO
			)
		).rejects.toThrow("authProviderAllowListMissing");
	});

	test("allows a single tenant microsoft sign in without allowed tenants", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...OAUTH_VARS,
				authProviders: "microsoft",
				authMicrosoftClientId: "ms-client",
				authMicrosoftClientSecret: "ms-secret",
				authMicrosoftTenant: "00000000-0000-0000-0000-000000000001",
				authProviderOpenRegistration: "false"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider?.map(p => p.type)).toEqual([
			AuthenticationProviderType.Microsoft
		]);
	});

	test("allows providers without an allow list by default", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...OAUTH_VARS,
				authProviders: "google,microsoft",
				authGoogleClientId: "google-client",
				authGoogleClientSecret: "google-secret",
				authMicrosoftClientId: "ms-client",
				authMicrosoftClientSecret: "ms-secret",
				authMicrosoftTenant: "common"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationProvider?.map(p => p.type)).toEqual([
			AuthenticationProviderType.Google,
			AuthenticationProviderType.Microsoft
		]);
	});

	test("passes the sign up verification settings to the authentication component", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authRegistrationVerificationUrl: "https://app.example.com/verify",
				authEmailSender: "verify@example.com",
				authRegistrationVerificationEmailTemplateId: "verify-template",
				authRegistrationExistsEmailTemplateId: "exists-template",
				authRegistrationVerificationExpiryMinutes: "60"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: {
				registrationVerificationUrl: "https://app.example.com/verify",
				emailSender: "verify@example.com",
				registrationVerificationEmailTemplateId: "verify-template",
				registrationExistsEmailTemplateId: "exists-template",
				registrationVerificationExpiryMinutes: 60
			}
		});
	});

	test("passes the e-mail sender and company name to the authentication component", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authEmailCompanyName: "Example Ltd"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: {
				emailSender: "no-reply@example.com",
				emailCompanyName: "Example Ltd"
			}
		});
	});

	test("passes the session and password settings to the authentication component", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authMaxSessionMinutes: "120",
				authLoginRateLimitPerClient: "true",
				authPasswordHashIterations: "3",
				authPasswordHashMemoryKib: "65536",
				authPasswordHashParallelism: "2"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		const passwordHashOptions = { iterations: 3, memoryKiB: 65536, parallelism: 2 };
		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: {
				maxSessionMinutes: 120,
				loginRateLimitPerClient: true,
				passwordHashOptions,
				escalatedPrivilegeRole: "global-admin"
			}
		});
		expect(config.types.authenticationProvider).toEqual([
			{
				type: AuthenticationProviderType.EntityStorage,
				options: { config: { passwordHashOptions } }
			}
		]);
	});

	test("does not rate limit by client address by default", async () => {
		const config = await buildEngineServerConfiguration(
			AUTH_VARS,
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		const options = config.types.authenticationComponent?.[0].options;
		expect(options).toMatchObject({
			config: { clientAddressRateLimitEnabled: false }
		});
		expect(options).not.toHaveProperty("config.passwordChangeRequiresCurrentPassword");
	});

	test("rate limits by client address only when trusted proxies are configured", async () => {
		const config = await buildEngineServerConfiguration(
			{ ...AUTH_VARS, trustedProxies: "10.0.0.0/8" },
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: { clientAddressRateLimitEnabled: true }
		});
	});

	test("passes the authorization model and escalated role to the admin components", async () => {
		const config = await buildEngineServerConfiguration(
			{
				...AUTH_VARS,
				authAdminProcessorType: "entity-storage",
				authorizationModelId: "custom",
				authPasswordHashMemoryKib: "32768"
			},
			[],
			emailCoreConfig(),
			SERVER_INFO
		);

		const expected = { authorizationModelId: "custom", escalatedPrivilegeRole: "global-admin" };
		expect(config.types.authenticationComponent?.[0].options).toMatchObject({
			config: expected
		});
		expect(config.types.authenticationAdminComponent?.[0].options).toMatchObject({
			config: { ...expected, passwordHashOptions: { memoryKiB: 32768 } }
		});
		expect(config.types.authenticationAccountAdminComponent?.[0].options).toMatchObject({
			config: expected
		});
		expect(config.types.organizationRequestAdminComponent?.[0].options).toMatchObject({
			config: expected
		});
		expect(config.types.organizationComponent?.[0].options).toMatchObject({
			config: expected
		});
	});
});
