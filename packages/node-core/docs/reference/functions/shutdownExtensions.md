# Function: shutdownExtensions()

> **shutdownExtensions**(`envVars`, `engineCore`): `Promise`\<`void`\>

Handles the shutdown of the extensions.

## Parameters

### envVars

[`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md)

The environment variables for the node.

### engineCore

`IEngineCore`

The engine core instance.

## Returns

`Promise`\<`void`\>

A promise that resolves when all extension shutdown methods have completed.
