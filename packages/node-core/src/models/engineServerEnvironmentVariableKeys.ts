// Copyright 2026 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
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
	corsWildcardCredentials: true,
	trustedProxies: true,
	originCheckEnabled: true,
	httpMethods: true,
	httpAllowedHeaders: true,
	httpExposedHeaders: true,
	httpBodyLimits: true,
	publicOrigin: true,
	fastifyPluginTimeout: true,
	webServerType: true,
	// IEngineServerEnvironmentVariables - auth
	authAdminProcessorType: true,
	authProcessorType: true,
	authSigningKeyId: true,
	authApiKeyHeader: true,
	authMinPasswordLength: true,
	authMaxPasswordLength: true,
	authProviders: true,
	authGoogleClientId: true,
	authGoogleClientSecret: true,
	authGoogleAllowedDomains: true,
	authGoogleProfileEditUrl: true,
	authGooglePasswordChangeUrl: true,
	authMicrosoftClientId: true,
	authMicrosoftClientSecret: true,
	authMicrosoftTenant: true,
	authMicrosoftAllowedTenants: true,
	authMicrosoftProfileEditUrl: true,
	authMicrosoftPasswordChangeUrl: true,
	authMicrosoftPersonalProfileEditUrl: true,
	authMicrosoftPersonalPasswordChangeUrl: true,
	authOAuthSuccessRedirectUrl: true,
	authOAuthFailureRedirectUrl: true,
	authDefaultRoles: true,
	authIdentityProofMaxAgeSeconds: true,
	authRecentSignInSeconds: true,
	authDeliveryIntervalSeconds: true,
	authEmailSender: true,
	authEmailCompanyName: true,
	authEmailLocale: true,
	authPasswordResetUrl: true,
	authPasswordResetExpiryMinutes: true,
	authPasswordResetEmailTemplateId: true,
	authOrganizationMemberAdminRole: true,
	authPasswordHashIterations: true,
	authPasswordHashMemoryKib: true,
	authPasswordHashParallelism: true,
	authRegistrationVerificationUrl: true,
	authRegistrationVerificationExpiryMinutes: true,
	authRegistrationVerificationEmailTemplateId: true,
	authRegistrationExistsEmailTemplateId: true,
	authMaxSessionMinutes: true,
	authCookieSameSite: true,
	authLoginRateLimitPerClient: true,
	authProviderOpenRegistration: true,
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
