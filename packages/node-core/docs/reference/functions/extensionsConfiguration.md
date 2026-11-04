# Function: extensionsConfiguration()

> **extensionsConfiguration**(`envVars`, `nodeEngineConfig`): `Promise`\<[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)\>

Handles the configuration of the extensions, and registers the features they provide with the feature factory.

## Parameters

### envVars

[`IEnvironmentVariables`](../type-aliases/IEnvironmentVariables.md)

The environment variables for the node.

### nodeEngineConfig

[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)

The node engine config.

## Returns

`Promise`\<[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)\>

The config for the core and the server.

## Throws

GeneralError if an extension cannot be loaded, two extensions provide a feature with the same
name, or extensions provide features without a feature component to list them.
