# Function: start()

> **start**(`nodeOptions`, `nodeEngineConfig`, `envVars`): `Promise`\<`undefined` \| \{ `engine`: `Engine`\<`IEngineServerConfig`, `IEngineState`\>; `server`: `EngineServer`; `shutdown`: () => `Promise`\<`void`\>; \}\>

Start the engine server.

## Parameters

### nodeOptions

Optional run options for the engine server.

`undefined` | [`INodeOptions`](../interfaces/INodeOptions.md)

### nodeEngineConfig

[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)

The configuration for the engine server.

### envVars

[`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md)

The environment variables.

## Returns

`Promise`\<`undefined` \| \{ `engine`: `Engine`\<`IEngineServerConfig`, `IEngineState`\>; `server`: `EngineServer`; `shutdown`: () => `Promise`\<`void`\>; \}\>

The engine server.
