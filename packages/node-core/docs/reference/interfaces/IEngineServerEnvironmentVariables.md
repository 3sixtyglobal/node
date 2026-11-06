# Interface: IEngineServerEnvironmentVariables

The engine server environment variables.

## Properties

### port? {#port}

> `optional` **port?**: `string`

The port to serve the API from.

***

### host? {#host}

> `optional` **host?**: `string`

The host to serve the API from.

***

### corsOrigins? {#corsorigins}

> `optional` **corsOrigins?**: `string`

The CORS origins to allow, defaults to *.

***

### corsWildcardCredentials? {#corswildcardcredentials}

> `optional` **corsWildcardCredentials?**: `string`

Reflect any origin with credentials when the CORS origins include *, defaults to true. Set to
false so credentials are only allowed for listed origins.

***

### trustedProxies? {#trustedproxies}

> `optional` **trustedProxies?**: `string`

Comma separated IP addresses or CIDR ranges of the proxies trusted to set X-Forwarded-For and
X-Real-IP, * trusts any proxy. Defaults to none, so the client IP is the socket address. The
authentication rate limits only use client addresses when it is set.

***

### originCheckEnabled? {#origincheckenabled}

> `optional` **originCheckEnabled?**: `string`

Reject cookie authenticated state changing requests, and socket connections, from origins other than
the API, its public origin and the listed CORS origins, defaults to false.

***

### httpMethods? {#httpmethods}

> `optional` **httpMethods?**: `string`

The CORS methods to allow, defaults to GET, POST, PUT, DELETE, OPTIONS.

***

### httpAllowedHeaders? {#httpallowedheaders}

> `optional` **httpAllowedHeaders?**: `string`

The CORS headers to allow.

***

### httpExposedHeaders? {#httpexposedheaders}

> `optional` **httpExposedHeaders?**: `string`

The CORS headers to expose.

***

### httpBodyLimits? {#httpbodylimits}

> `optional` **httpBodyLimits?**: `string`

Named request body limits in bytes as comma separated name=bytes pairs, e.g. default=2097152,large=26214400.

***

### publicOrigin? {#publicorigin}

> `optional` **publicOrigin?**: `string`

The public origin URL for the API e.g. https://api.example.com:1234

***

### fastifyPluginTimeout? {#fastifyplugintimeout}

> `optional` **fastifyPluginTimeout?**: `string`

The time in milliseconds Fastify waits for a plugin to load before failing, defaults to 30000.

***

### webServerType? {#webservertype}

> `optional` **webServerType?**: `string`

The type of web server to use: fastify, hono, native, defaults to fastify.

***

### authAdminProcessorType? {#authadminprocessortype}

> `optional` **authAdminProcessorType?**: `string`

The type of auth admin processor to use on the API: entity-storage.

***

### authProcessorType? {#authprocessortype}

> `optional` **authProcessorType?**: `string`

The type of auth processor to use on the API: entity-storage.

***

### authSigningKeyId? {#authsigningkeyid}

> `optional` **authSigningKeyId?**: `string`

The id of the key in the vault to use for signing in auth operations.

***

### authApiKeyHeader? {#authapikeyheader}

> `optional` **authApiKeyHeader?**: `string`

The HTTP header name used to pass the API key on requests, defaults to x-api-key.

***

### authMinPasswordLength? {#authminpasswordlength}

> `optional` **authMinPasswordLength?**: `string`

The minimum password length for new password validation.

***

### authMaxPasswordLength? {#authmaxpasswordlength}

> `optional` **authMaxPasswordLength?**: `string`

The maximum password length for new password validation.

***

### authProviders? {#authproviders}

> `optional` **authProviders?**: `string`

The authentication providers to enable, comma separated: 3sixty, 3sixty-oauth,
google, microsoft.

#### Default

```ts
3sixty
```

***

### authGoogleClientId? {#authgoogleclientid}

> `optional` **authGoogleClientId?**: `string`

The client id registered with Google, required when the google provider is enabled.

***

### authGoogleClientSecret? {#authgoogleclientsecret}

> `optional` **authGoogleClientSecret?**: `string`

The client secret registered with Google, required when the google provider is enabled.

***

### authGoogleAllowedDomains? {#authgooglealloweddomains}

> `optional` **authGoogleAllowedDomains?**: `string`

The domains Google accounts may sign in from, comma separated, any domain when not set.

***

### authGoogleProfileEditUrl? {#authgoogleprofileediturl}

> `optional` **authGoogleProfileEditUrl?**: `string`

The address where Google accounts edit their profile.

#### Default

```ts
https://myaccount.google.com/personal-info
```

***

### authGooglePasswordChangeUrl? {#authgooglepasswordchangeurl}

> `optional` **authGooglePasswordChangeUrl?**: `string`

The address where Google accounts change their password.

#### Default

```ts
https://myaccount.google.com/signinoptions/password
```

***

### authMicrosoftClientId? {#authmicrosoftclientid}

> `optional` **authMicrosoftClientId?**: `string`

The client id registered with Microsoft, required when the microsoft provider is enabled.

***

### authMicrosoftClientSecret? {#authmicrosoftclientsecret}

> `optional` **authMicrosoftClientSecret?**: `string`

The client secret registered with Microsoft, required when the microsoft provider is enabled.

***

### authMicrosoftTenant? {#authmicrosofttenant}

> `optional` **authMicrosoftTenant?**: `string`

The Microsoft tenant accounts sign in from, a tenant id or one of common, organizations or
consumers, required when the microsoft provider is enabled.

***

### authMicrosoftAllowedTenants? {#authmicrosoftallowedtenants}

> `optional` **authMicrosoftAllowedTenants?**: `string`

The Microsoft tenant ids accounts may sign in from, comma separated, any tenant when not set.
The e-mail addresses of accounts from these tenants are trusted without the xms_edov claim.

***

### authMicrosoftProfileEditUrl? {#authmicrosoftprofileediturl}

> `optional` **authMicrosoftProfileEditUrl?**: `string`

The address where Microsoft work accounts edit their profile.

#### Default

```ts
https://myaccount.microsoft.com/
```

***

### authMicrosoftPasswordChangeUrl? {#authmicrosoftpasswordchangeurl}

> `optional` **authMicrosoftPasswordChangeUrl?**: `string`

The address where Microsoft work accounts change their password.

#### Default

```ts
https://mysignins.microsoft.com/security-info/password/change
```

***

### authMicrosoftPersonalProfileEditUrl? {#authmicrosoftpersonalprofileediturl}

> `optional` **authMicrosoftPersonalProfileEditUrl?**: `string`

The address where personal Microsoft accounts, from the consumer tenant, edit their profile.

#### Default

```ts
https://account.microsoft.com/profile
```

***

### authMicrosoftPersonalPasswordChangeUrl? {#authmicrosoftpersonalpasswordchangeurl}

> `optional` **authMicrosoftPersonalPasswordChangeUrl?**: `string`

The address where personal Microsoft accounts, from the consumer tenant, change their password.

#### Default

```ts
https://account.live.com/password/Change
```

***

### authOauthSuccessRedirectUrl? {#authoauthsuccessredirecturl}

> `optional` **authOauthSuccessRedirectUrl?**: `string`

The address to send the browser to after a successful OAuth sign in, required when an OAuth provider is enabled.

***

### authOauthFailureRedirectUrl? {#authoauthfailureredirecturl}

> `optional` **authOauthFailureRedirectUrl?**: `string`

The address to send the browser to when an OAuth sign in fails, required when an OAuth provider is enabled.

***

### authLoginPageUrl? {#authloginpageurl}

> `optional` **authLoginPageUrl?**: `string`

The address of the login page that takes an OAuth 2.0 authorization request for a password
account, required when the 3sixty-oauth provider is enabled, and published as the
authorization endpoint at /.well-known/oauth-authorization-server.

***

### authAuthorizationRedirectUris? {#authauthorizationredirecturis}

> `optional` **authAuthorizationRedirectUris?**: `string`

The redirect addresses, besides those on the node's public origin, an authorization code for
a password account may be sent to, comma separated and matched exactly.

***

### authAuthorizationCodeExpirySeconds? {#authauthorizationcodeexpiryseconds}

> `optional` **authAuthorizationCodeExpirySeconds?**: `string`

How long an authorization code for a password account can be used for, in seconds.

#### Default

```ts
60
```

***

### authDefaultRoles? {#authdefaultroles}

> `optional` **authDefaultRoles?**: `string`

The roles given to accounts created by a provider login or a sign up, comma separated.

#### Default

```ts
user
```

***

### authIdentityProofMaxAgeSeconds? {#authidentityproofmaxageseconds}

> `optional` **authIdentityProofMaxAgeSeconds?**: `string`

How long a proof that a DID is owned may be used for when binding it to an account, in seconds.

#### Default

```ts
300
```

***

### authRecentSignInSeconds? {#authrecentsigninseconds}

> `optional` **authRecentSignInSeconds?**: `string`

How long ago a session may have started for sensitive operations, such as removing an account
or exporting an identity, in seconds.

#### Default

```ts
300
```

***

### authDeliveryIntervalSeconds? {#authdeliveryintervalseconds}

> `optional` **authDeliveryIntervalSeconds?**: `string`

How often the queued password reset and sign up e-mails are delivered, in seconds.

#### Default

```ts
60
```

***

### authEmailSender? {#authemailsender}

> `optional` **authEmailSender?**: `string`

The sender of the password reset and sign up e-mails, required with entity storage authentication.

***

### authEmailCompanyName? {#authemailcompanyname}

> `optional` **authEmailCompanyName?**: `string`

The company name shown in the authentication e-mails, given to the templates as companyName.

***

### authEmailLocale? {#authemaillocale}

> `optional` **authEmailLocale?**: `string`

The locale of the password reset and sign up e-mails.

#### Default

```ts
en
```

***

### authPasswordResetUrl? {#authpasswordreseturl}

> `optional` **authPasswordResetUrl?**: `string`

The address of the page that resets the password, the token is added as the token query
parameter, required with entity storage authentication.

***

### authPasswordResetExpiryMinutes? {#authpasswordresetexpiryminutes}

> `optional` **authPasswordResetExpiryMinutes?**: `string`

How long a password reset link can be used for, in minutes.

#### Default

```ts
30
```

***

### authPasswordResetEmailTemplateId? {#authpasswordresetemailtemplateid}

> `optional` **authPasswordResetEmailTemplateId?**: `string`

The messaging template of the password reset e-mail, given the resetUrl, expires and
expiryMinutes values.

#### Default

```ts
password-reset
```

***

### authOrganizationMemberAdminRole? {#authorganizationmemberadminrole}

> `optional` **authOrganizationMemberAdminRole?**: `string`

The role given to the first member of an organization created through the organization endpoints.

#### Default

```ts
user-admin
```

***

### authPasswordHashIterations? {#authpasswordhashiterations}

> `optional` **authPasswordHashIterations?**: `string`

The Argon2id iterations used to hash new passwords.

#### Default

```ts
2
```

***

### authPasswordHashMemoryKib? {#authpasswordhashmemorykib}

> `optional` **authPasswordHashMemoryKib?**: `string`

The Argon2id memory used to hash new passwords, in KiB.

#### Default

```ts
19456
```

***

### authPasswordHashParallelism? {#authpasswordhashparallelism}

> `optional` **authPasswordHashParallelism?**: `string`

The Argon2id parallelism used to hash new passwords.

#### Default

```ts
1
```

***

### authRegistrationVerificationUrl? {#authregistrationverificationurl}

> `optional` **authRegistrationVerificationUrl?**: `string`

The address of the page that verifies a sign up, the token is added as the token query
parameter, required with entity storage authentication.

***

### authRegistrationVerificationExpiryMinutes? {#authregistrationverificationexpiryminutes}

> `optional` **authRegistrationVerificationExpiryMinutes?**: `string`

How long a sign up verification link can be used for, in minutes.

#### Default

```ts
1440
```

***

### authRegistrationVerificationEmailTemplateId? {#authregistrationverificationemailtemplateid}

> `optional` **authRegistrationVerificationEmailTemplateId?**: `string`

The messaging template of the sign up verification e-mail, given the verifyUrl, expires and
expiryMinutes values.

#### Default

```ts
registration-verify
```

***

### authRegistrationExistsEmailTemplateId? {#authregistrationexistsemailtemplateid}

> `optional` **authRegistrationExistsEmailTemplateId?**: `string`

The messaging template of the e-mail sent when a sign up uses an e-mail address that already
has an account.

#### Default

```ts
registration-exists
```

***

### authMaxSessionMinutes? {#authmaxsessionminutes}

> `optional` **authMaxSessionMinutes?**: `string`

The longest a session can be kept alive by refreshing its token, in minutes, unlimited when not set.

***

### authLoginRateLimitPerClient? {#authloginratelimitperclient}

> `optional` **authLoginRateLimitPerClient?**: `string`

Limit logins per client address and per e-mail address with the client, so an attacker cannot
lock an account out for everyone. Otherwise logins are limited per e-mail address only. Client
addresses are only used when trustedProxies is set.

#### Default

```ts
false
```

***

### authCookieSameSite? {#authcookiesamesite}

> `optional` **authCookieSameSite?**: `string`

The SameSite attribute of the session cookie: Strict, Lax or None, the cookie is always Secure.
Lax or Strict limit the cookie to requests from the same site.

#### Default

```ts
None
```

***

### authProviderOpenRegistration? {#authprovideropenregistration}

> `optional` **authProviderOpenRegistration?**: `string`

Allow Google without allowed domains, or a multi tenant Microsoft sign in without allowed
tenants, so anyone with an account at the provider can sign up. Set to false to require the
allow lists.

#### Default

```ts
true
```

***

### mimeTypeProcessors? {#mimetypeprocessors}

> `optional` **mimeTypeProcessors?**: `string`

Additional MIME type processors to include, comma separated.

***

### routeLoggingIncludeBody? {#routeloggingincludebody}

> `optional` **routeLoggingIncludeBody?**: `string`

Include the body in the REST logging output, useful for debugging.

***

### routeLoggingFullBase64? {#routeloggingfullbase64}

> `optional` **routeLoggingFullBase64?**: `string`

Include the full base 64 output in the REST logging output, useful for debugging.

***

### routeLoggingObfuscateProperties? {#routeloggingobfuscateproperties}

> `optional` **routeLoggingObfuscateProperties?**: `string`

List of properties to obfuscate in the REST logging output, comma separated.

***

### routeMetricsExcludePaths? {#routemetricsexcludepaths}

> `optional` **routeMetricsExcludePaths?**: `string`

Comma-separated list of URL path prefixes excluded from metrics collection.

***

### routeTracingExcludePaths? {#routetracingexcludepaths}

> `optional` **routeTracingExcludePaths?**: `string`

Comma-separated list of URL path prefixes excluded from tracing.
