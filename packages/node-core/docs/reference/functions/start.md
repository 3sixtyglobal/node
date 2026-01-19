# Function: start()

> **start**(`nodeOptions`, `nodeEngineConfig`, `envVars`, `cliCommand?`, `availableContextIdKeys?`): `Promise`\<\{ `engine`: `Engine`\<`IEngineServerConfig`, [`INodeEngineState`](../interfaces/INodeEngineState.md)\>; `server`: `EngineServer`; `shutdown`: () => `Promise`\<`void`\>; \} \| `undefined`\>

Start the engine server.

## Parameters

### nodeOptions

Optional run options for the engine server.

[`INodeOptions`](../interfaces/INodeOptions.md) | `undefined`

### nodeEngineConfig

[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)

The configuration for the engine server.

### envVars

[`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md)

The environment variables.

### cliCommand?

[`ICliCommand`](../interfaces/ICliCommand.md)

The constructed CLI command (optional).

### availableContextIdKeys?

`object`[]

The context ID keys available for operation.

## Returns

`Promise`\<\{ `engine`: `Engine`\<`IEngineServerConfig`, [`INodeEngineState`](../interfaces/INodeEngineState.md)\>; `server`: `EngineServer`; `shutdown`: () => `Promise`\<`void`\>; \} \| `undefined`\>

The engine server.
