# Node Core Examples

These snippets show practical runtime setup patterns, state inspection, and controlled shutdown so you can move from local development to automation with predictable behaviour.

## Engine

```typescript
import { run } from '@3sixty/node-core';

const runtime = await run(
  {
    disableProcessExitOnFailure: true,
    envVars: {
      TWIN_HOST: '127.0.0.1',
      TWIN_PORT: '8080',
      TWIN_STORAGE_FILE_ROOT: './storage',
      TWIN_STATE_FILENAME: 'engine-state.json'
    }
  },
  ['node', 'index.js']
);

if (runtime) {
  const state = runtime.engine.getState();
  console.log(typeof state); // object
  console.log(state.nodeId ?? 'not-configured'); // not-configured
  await runtime.shutdown();
}
```

```typescript
import { run } from '@3sixty/node-core';

const runtime = await run(
  {
    disableProcessExitOnFailure: true,
    envVars: {
      TWIN_HOST: '127.0.0.1',
      TWIN_PORT: '8081',
      TWIN_STORAGE_FILE_ROOT: './storage',
      TWIN_STATE_FILENAME: 'engine-state.json'
    }
  },
  ['node', 'index.js']
);

if (runtime) {
  await runtime.engine.logInfo('Startup validation completed');
  const state = runtime.engine.getState();
  console.log(Object.keys(state).length >= 0); // true
  await runtime.shutdown();
}
```

## EngineServer

```typescript
import type { IServerInfo } from '@3sixty/api-models';
import type { INodeOptions } from '@3sixty/node-core';
import {
  buildConfiguration,
  loadEnvironmentVariables,
  processEnvironmentVariables,
  start
} from '@3sixty/node-core';

const processEnv: Record<string, string> = {
  TWIN_HOST: '127.0.0.1',
  TWIN_PORT: '8082',
  TWIN_STORAGE_FILE_ROOT: './storage',
  TWIN_STATE_FILENAME: 'engine-state.json'
};

const options: INodeOptions = {
  disableProcessExitOnFailure: true,
  envPrefix: 'TWIN_',
  executionDirectory: process.cwd(),
  scriptDirectory: process.cwd()
};

const serverInfo: IServerInfo = {
  name: 'Local Runtime',
  version: '0.0.0-dev'
};

const nodeEnvVars = await processEnvironmentVariables(
  loadEnvironmentVariables(processEnv, options),
  options
);

const { nodeEngineConfig, availableContextIdKeys } = await buildConfiguration(
  nodeEnvVars,
  options,
  serverInfo
);

const runtime = await start(
  options,
  nodeEngineConfig,
  nodeEnvVars,
  undefined,
  availableContextIdKeys
);

if (runtime) {
  console.log(typeof runtime.server.stop); // function
  await runtime.server.stop();
}
```

## Password Reset and Organizations

Forgotten passwords are reset with a link sent through the messaging component, which is off by default. The address and the sender are required once it is enabled. `TWIN_AUTH_EMAIL_SENDER` is the sender of the password reset and sign up e-mails, and `TWIN_AUTH_EMAIL_COMPANY_NAME` is given to their templates as `companyName`.

```typescript
const processEnv: Record<string, string> = {
  TWIN_AUTH_PROCESSOR_TYPE: 'entity-storage',
  TWIN_AUTH_ADMIN_PROCESSOR_TYPE: 'entity-storage',
  TWIN_AUTH_PASSWORD_RESET_ENABLED: 'true',
  TWIN_AUTH_PASSWORD_RESET_URL: 'https://app.example.org/reset-password',
  TWIN_AUTH_EMAIL_SENDER: 'no-reply@example.org',
  TWIN_AUTH_EMAIL_COMPANY_NAME: 'Example Ltd',
  TWIN_AUTH_PASSWORD_RESET_EMAIL_TEMPLATE_ID: 'password-reset',
  TWIN_AUTH_PASSWORD_RESET_EMAIL_LOCALE: 'en',
  TWIN_AUTH_PASSWORD_RESET_EXPIRY_MINUTES: '30',
  TWIN_AUTH_ORGANIZATION_MEMBER_ADMIN_ROLE: 'user-admin'
};
```

With the admin processor enabled, organizations are registered through `/authentication/organization`. On start the migration registers the organization of each tenant, or the node organization, and the organizations of migrated users, copying their identity profiles to the organization profiles. Organizations are found by their DID, so a repeated start adds nothing.

Roles and policies are now held by account ids rather than DIDs. The migration moves the role assignments and direct policies of each DID a migrated user held to every account of that user, then removes them from the DID, in each tenant partition. Every authorization model the DID has rules in is moved when the entity storage authorization connector is used. With other connectors, which cannot list their models, only the model in `TWIN_AUTHORIZATION_MODEL_ID` is moved. Rules of other subjects, such as organization and node DIDs, are left as they are. A failure is logged and retried on the next start.

E-mail addresses of migrated users are stored in lower case. When two users differ only by the case of their e-mail address, the first keeps the address and the later one is migrated disabled with its original address, with a warning naming both, for an admin to resolve.

## Sign Up Verification and Sign In Security

Self sign up sends a verification link by e-mail, and `POST /authentication/register` returns `202 Accepted` with no body whether or not the e-mail address is already taken. The account signs in once `POST /authentication/register/verify` has been called with the token from the link. The verification address and the e-mail sender are required when self sign up is enabled with verification, the password reset locale is used when the verification one is not set.

```typescript
const processEnv: Record<string, string> = {
  TWIN_AUTH_PROCESSOR_TYPE: 'entity-storage',
  TWIN_AUTH_SELF_REGISTRATION_ENABLED: 'true',
  TWIN_AUTH_REGISTRATION_VERIFICATION_URL: 'https://app.example.org/verify',
  TWIN_AUTH_REGISTRATION_VERIFICATION_EMAIL_TEMPLATE_ID: 'registration-verify',
  TWIN_AUTH_REGISTRATION_EXISTS_EMAIL_TEMPLATE_ID: 'registration-exists',
  TWIN_AUTH_REGISTRATION_VERIFICATION_EXPIRY_MINUTES: '1440',
  TWIN_AUTH_MAX_SESSION_MINUTES: '720',
  TWIN_AUTH_RECENT_SIGN_IN_SECONDS: '300',
  TWIN_AUTH_PASSWORD_HASH_ITERATIONS: '2',
  TWIN_AUTH_PASSWORD_HASH_MEMORY_KIB: '19456',
  TWIN_AUTH_PASSWORD_HASH_PARALLELISM: '1'
};
```

New passwords are hashed with Argon2id, existing passwords keep working and are hashed again with Argon2id on the next sign in. When `TWIN_AUTH_MAX_SESSION_MINUTES` is set, a token refresh is refused once the session is older than it, otherwise sessions are not limited. Removing an account and exporting or removing an identity need a session started within `TWIN_AUTH_RECENT_SIGN_IN_SECONDS`, 300 by default, so an older session signs in again first.

Password reset and sign up verification need an e-mail messaging connector, the node refuses to start without one when either is enabled.

Some defaults changed to close security gaps. Each has a setting that restores the previous behaviour:

| Behaviour                                                                         | Setting to restore the previous behaviour              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Sign up returns `202 Accepted` and needs verification before the account signs in | `TWIN_AUTH_REGISTRATION_VERIFICATION_ENABLED: 'false'` |

Changing your own password always needs the current password, an admin or a password reset link does not.

Some protections are available but off by default, so existing deployments keep working:

- Set `TWIN_AUTH_COOKIE_SAME_SITE` to `Lax` or `Strict` when the site is on the same domain as the node, the default is `None`.
- Set `TWIN_AUTH_PROVIDER_OPEN_REGISTRATION` to `false` to require `allowedDomains` for Google and allowed tenants for a multi tenant Microsoft sign in, by default anyone with an account at the provider can sign up and is given the default roles.
- Set `TWIN_AUTH_PROVIDER_SIGN_UP_ENABLED` to `false` so the first login through an OAuth provider no longer creates an account, only accounts that already exist can then sign in with a provider and any other provider login fails with `401`.
- Set `TWIN_AUTH_LOGIN_RATE_LIMIT_PER_CLIENT` to `true` to limit logins per client address and per e-mail address with the client, so an attacker cannot lock an account out for everyone. By default logins are limited per e-mail address, and a limited login fails with `401` as before.
- Set `TWIN_CORS_WILDCARD_CREDENTIALS` to `false` so a wildcard CORS origin no longer receives credentials, and `TWIN_ORIGIN_CHECK_ENABLED` to `true` to refuse cookie authenticated changes from origins other than the node and the listed CORS origins.

The client IP is the socket address unless the peer is listed in `TWIN_TRUSTED_PROXIES`, so a node behind a proxy or load balancer should list it. The authentication rate limits only use client addresses, including the per client login limits, when `TWIN_TRUSTED_PROXIES` is set, otherwise they apply per e-mail address or per token.

## Messaging Templates

On start the node stores the messaging templates from the `templates` folder next to its script, or from `TWIN_MESSAGING_TEMPLATES_DIRECTORY`, in every tenant that does not have them yet, and in each tenant created later. A template is a `<template-id>.html` file for the default locale, or `<template-id>.<locale>.html` for a locale, and its `title` element is the e-mail subject.

```typescript
const processEnv: Record<string, string> = {
  TWIN_MESSAGING_EMAIL_CONNECTOR: 'smtp',
  TWIN_MESSAGING_TEMPLATES_DIRECTORY: './templates'
};
```

The tenant override now runs before the account processor, so the identity and organization of the signed in account are resolved in the tenant being switched to.
