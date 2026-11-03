// Copyright 2024 IOTA Stiftung.
// Copyright 2026 3Sixty Trade Ltd.
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
	 * Reflect any origin with credentials when the CORS origins include *, defaults to true. Set to
	 * false so credentials are only allowed for listed origins.
	 */
	corsWildcardCredentials?: string;

	/**
	 * Comma separated IP addresses or CIDR ranges of the proxies trusted to set X-Forwarded-For and
	 * X-Real-IP, * trusts any proxy. Defaults to none, so the client IP is the socket address. The
	 * authentication rate limits only use client addresses when it is set.
	 */
	trustedProxies?: string;

	/**
	 * Reject cookie authenticated state changing requests, and socket connections, from origins other than
	 * the API, its public origin and the listed CORS origins, defaults to false.
	 */
	originCheckEnabled?: string;

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
	 * The time in milliseconds Fastify waits for a plugin to load before failing, defaults to 30000.
	 */
	fastifyPluginTimeout?: string;

	/**
	 * The type of web server to use: fastify, hono, native, defaults to fastify.
	 */
	webServerType?: string;

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
	 * The minimum password length for new password validation.
	 */
	authMinPasswordLength?: string;

	/**
	 * The maximum password length for new password validation.
	 */
	authMaxPasswordLength?: string;

	/**
	 * The authentication providers to enable, comma separated: entity-storage, google, microsoft.
	 * @default entity-storage
	 */
	authProviders?: string;

	/**
	 * The client id registered with Google, required when the google provider is enabled.
	 */
	authGoogleClientId?: string;

	/**
	 * The client secret registered with Google, required when the google provider is enabled.
	 */
	authGoogleClientSecret?: string;

	/**
	 * The domains Google accounts may sign in from, comma separated, any domain when not set.
	 */
	authGoogleAllowedDomains?: string;

	/**
	 * The address where Google accounts edit their profile.
	 * @default https://myaccount.google.com/personal-info
	 */
	authGoogleProfileEditUrl?: string;

	/**
	 * The address where Google accounts change their password.
	 * @default https://myaccount.google.com/signinoptions/password
	 */
	authGooglePasswordChangeUrl?: string;

	/**
	 * The client id registered with Microsoft, required when the microsoft provider is enabled.
	 */
	authMicrosoftClientId?: string;

	/**
	 * The client secret registered with Microsoft, required when the microsoft provider is enabled.
	 */
	authMicrosoftClientSecret?: string;

	/**
	 * The Microsoft tenant accounts sign in from, a tenant id or one of common, organizations or
	 * consumers, required when the microsoft provider is enabled.
	 */
	authMicrosoftTenant?: string;

	/**
	 * The Microsoft tenant ids accounts may sign in from, comma separated, any tenant when not set.
	 * The e-mail addresses of accounts from these tenants are trusted without the xms_edov claim.
	 */
	authMicrosoftAllowedTenants?: string;

	/**
	 * The address where Microsoft work accounts edit their profile.
	 * @default https://myaccount.microsoft.com/
	 */
	authMicrosoftProfileEditUrl?: string;

	/**
	 * The address where Microsoft work accounts change their password.
	 * @default https://mysignins.microsoft.com/security-info/password/change
	 */
	authMicrosoftPasswordChangeUrl?: string;

	/**
	 * The address where personal Microsoft accounts, from the consumer tenant, edit their profile.
	 * @default https://account.microsoft.com/profile
	 */
	authMicrosoftPersonalProfileEditUrl?: string;

	/**
	 * The address where personal Microsoft accounts, from the consumer tenant, change their password.
	 * @default https://account.live.com/password/Change
	 */
	authMicrosoftPersonalPasswordChangeUrl?: string;

	/**
	 * The address to send the browser to after a successful OAuth sign in, required when an OAuth provider is enabled.
	 */
	authOAuthSuccessRedirectUrl?: string;

	/**
	 * The address to send the browser to when an OAuth sign in fails, required when an OAuth provider is enabled.
	 */
	authOAuthFailureRedirectUrl?: string;

	/**
	 * The roles given to accounts created by a provider login or a sign up, comma separated.
	 * @default user
	 */
	authDefaultRoles?: string;

	/**
	 * How long a proof that a DID is owned may be used for when binding it to an account, in seconds.
	 * @default 300
	 */
	authIdentityProofMaxAgeSeconds?: string;

	/**
	 * How long ago a session may have started for sensitive operations, such as removing an account
	 * or exporting an identity, in seconds.
	 * @default 300
	 */
	authRecentSignInSeconds?: string;

	/**
	 * How often the queued password reset and sign up e-mails are delivered, in seconds.
	 * @default 60
	 */
	authDeliveryIntervalSeconds?: string;

	/**
	 * The sender of the password reset and sign up e-mails, required with entity storage authentication.
	 */
	authEmailSender?: string;

	/**
	 * The company name shown in the authentication e-mails, given to the templates as companyName.
	 */
	authEmailCompanyName?: string;

	/**
	 * The locale of the password reset and sign up e-mails.
	 * @default en
	 */
	authEmailLocale?: string;

	/**
	 * The address of the page that resets the password, the token is added as the token query
	 * parameter, required with entity storage authentication.
	 */
	authPasswordResetUrl?: string;

	/**
	 * How long a password reset link can be used for, in minutes.
	 * @default 30
	 */
	authPasswordResetExpiryMinutes?: string;

	/**
	 * The messaging template of the password reset e-mail, given the resetUrl, expires and
	 * expiryMinutes values.
	 * @default password-reset
	 */
	authPasswordResetEmailTemplateId?: string;

	/**
	 * The role given to the first member of an organization created through the organization endpoints.
	 * @default user-admin
	 */
	authOrganizationMemberAdminRole?: string;

	/**
	 * The Argon2id iterations used to hash new passwords.
	 * @default 2
	 */
	authPasswordHashIterations?: string;

	/**
	 * The Argon2id memory used to hash new passwords, in KiB.
	 * @default 19456
	 */
	authPasswordHashMemoryKib?: string;

	/**
	 * The Argon2id parallelism used to hash new passwords.
	 * @default 1
	 */
	authPasswordHashParallelism?: string;

	/**
	 * The address of the page that verifies a sign up, the token is added as the token query
	 * parameter, required with entity storage authentication.
	 */
	authRegistrationVerificationUrl?: string;

	/**
	 * How long a sign up verification link can be used for, in minutes.
	 * @default 1440
	 */
	authRegistrationVerificationExpiryMinutes?: string;

	/**
	 * The messaging template of the sign up verification e-mail, given the verifyUrl, expires and
	 * expiryMinutes values.
	 * @default registration-verify
	 */
	authRegistrationVerificationEmailTemplateId?: string;

	/**
	 * The messaging template of the e-mail sent when a sign up uses an e-mail address that already
	 * has an account.
	 * @default registration-exists
	 */
	authRegistrationExistsEmailTemplateId?: string;

	/**
	 * The longest a session can be kept alive by refreshing its token, in minutes, unlimited when not set.
	 */
	authMaxSessionMinutes?: string;

	/**
	 * Limit logins per client address and per e-mail address with the client, so an attacker cannot
	 * lock an account out for everyone. Otherwise logins are limited per e-mail address only. Client
	 * addresses are only used when trustedProxies is set.
	 * @default false
	 */
	authLoginRateLimitPerClient?: string;

	/**
	 * The SameSite attribute of the session cookie: Strict, Lax or None, the cookie is always Secure.
	 * Lax or Strict limit the cookie to requests from the same site.
	 * @default None
	 */
	authCookieSameSite?: string;

	/**
	 * Allow Google without allowed domains, or a multi tenant Microsoft sign in without allowed
	 * tenants, so anyone with an account at the provider can sign up. Set to false to require the
	 * allow lists.
	 * @default true
	 */
	authProviderOpenRegistration?: string;

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
