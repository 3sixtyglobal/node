# Function: buildConfiguration()

> **buildConfiguration**(`processEnv`, `options`, `serverInfo`): `Promise`\<\{ `nodeEnvVars`: [`IBootstrapLegacyEnvironmentVariables`](../interfaces/IBootstrapLegacyEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md) & `object`; `nodeEngineConfig`: [`INodeEngineConfig`](../interfaces/INodeEngineConfig.md); `availableContextIdKeys`: `object`[]; \}\>

Build the configuration for the TWIN Node.

## Parameters

### processEnv

The environment variables from the process.

### options

[`INodeOptions`](../interfaces/INodeOptions.md)

The options for running the server.

### serverInfo

`IServerInfo`

The server information.

## Returns

`Promise`\<\{ `nodeEnvVars`: [`IBootstrapLegacyEnvironmentVariables`](../interfaces/IBootstrapLegacyEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md) & `object`; `nodeEngineConfig`: [`INodeEngineConfig`](../interfaces/INodeEngineConfig.md); `availableContextIdKeys`: `object`[]; \}\>

A promise that resolves to the engine server configuration, environment prefix, environment variables,
and options.
