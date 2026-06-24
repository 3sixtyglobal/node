# Function: buildEngineServerConfiguration()

> **buildEngineServerConfiguration**(`envVars`, `availableContextIdKeys`, `coreEngineConfig`, `serverInfo`, `openApiSpecPath?`, `favIconPath?`): `Promise`\<`IEngineServerConfig`\>

Handles the configuration of the server.

## Parameters

### envVars

[`IBootstrapLegacyEnvironmentVariables`](../interfaces/IBootstrapLegacyEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md) & `object`

The environment variables for the engine server.

### availableContextIdKeys

`object`[]

The context ID keys.

### coreEngineConfig

`IEngineCoreConfig`

The core engine config.

### serverInfo

`IServerInfo`

The server information.

### openApiSpecPath?

`string`

The path to the open api spec.

### favIconPath?

`string`

The path to the favicon.

## Returns

`Promise`\<`IEngineServerConfig`\>

The config for the core and the server.
