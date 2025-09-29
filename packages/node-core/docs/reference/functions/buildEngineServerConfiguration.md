# Function: buildEngineServerConfiguration()

> **buildEngineServerConfiguration**(`envVars`, `coreEngineConfig`, `serverInfo`, `openApiSpecPath?`, `favIconPath?`): `Promise`\<`IEngineServerConfig`\>

Handles the configuration of the server.

## Parameters

### envVars

[`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md)

The environment variables for the engine server.

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

The the config for the core and the server.
