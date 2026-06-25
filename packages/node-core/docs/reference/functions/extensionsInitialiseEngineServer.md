# Function: extensionsInitialiseEngineServer()

> **extensionsInitialiseEngineServer**(`envVars`, `engineCore`, `engineServer`): `Promise`\<`void`\>

Handles the initialisation of the extensions when the engine server has been constructed.

## Parameters

### envVars

[`IEnvironmentVariables`](../type-aliases/IEnvironmentVariables.md)

The environment variables for the node.

### engineCore

`IEngineCore`

The engine core instance.

### engineServer

`IEngineServer`

The engine server instance.

## Returns

`Promise`\<`void`\>

A promise that resolves when all extension engine-server initialisation methods have completed.
