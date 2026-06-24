# Function: extensionsInitialiseEngine()

> **extensionsInitialiseEngine**(`envVars`, `engineCore`): `Promise`\<`void`\>

Handles the initialisation of the extensions when the engine has been constructed.

## Parameters

### envVars

[`IEnvironmentVariables`](../type-aliases/IEnvironmentVariables.md)

The environment variables for the node.

### engineCore

`IEngineCore`

The engine core instance.

## Returns

`Promise`\<`void`\>

A promise that resolves when all extension engine initialisation methods have completed.
