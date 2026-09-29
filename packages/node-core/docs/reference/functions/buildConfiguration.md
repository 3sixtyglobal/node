# Function: buildConfiguration()

> **buildConfiguration**(`envVars`, `options`, `serverInfo`): `Promise`\<\{ `nodeEngineConfig`: [`INodeEngineConfig`](../interfaces/INodeEngineConfig.md); `availableContextIdKeys`: `object`[]; \}\>

Build the configuration for the TWIN Node.

## Parameters

### envVars

[`IBootstrapDevEnvironmentVariables`](../interfaces/IBootstrapDevEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md) & `object`

The environment variables for the node.

### options

[`INodeOptions`](../interfaces/INodeOptions.md)

The options for running the server.

### serverInfo

`IServerInfo`

The server information.

## Returns

`Promise`\<\{ `nodeEngineConfig`: [`INodeEngineConfig`](../interfaces/INodeEngineConfig.md); `availableContextIdKeys`: `object`[]; \}\>

A promise that resolves to the engine server configuration and the available context ID keys.
