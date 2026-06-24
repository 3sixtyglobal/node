# Function: start()

> **start**(`nodeOptions`, `nodeEngineConfig`, `envVars`, `cliCommand?`, `availableContextIdKeys?`): `Promise`\<\{ `engine`: `Engine`\<`IEngineServerConfig`, [`INodeEngineState`](../interfaces/INodeEngineState.md)\>; `server`: `EngineServer`; `shutdown`: () => `Promise`\<`void`\>; \} \| `undefined`\>

Start the engine server.

## Parameters

### nodeOptions

[`INodeOptions`](../interfaces/INodeOptions.md) \| `undefined`

Optional run options for the engine server.

### nodeEngineConfig

[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)

The configuration for the engine server.

### envVars

[`IBootstrapLegacyEnvironmentVariables`](../interfaces/IBootstrapLegacyEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md)

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
