# Type Alias: NodeExtensionInitialiseMethod

> **NodeExtensionInitialiseMethod** = (`envVars`, `nodeEngineConfig`) => `Promise`\<`void`\>

The type for the initialise method of an extension module.

## Parameters

### envVars

[`IEnvironmentVariables`](IEnvironmentVariables.md)

The environment variables for the node.

### nodeEngineConfig

[`INodeEngineConfig`](../interfaces/INodeEngineConfig.md)

The node engine config.

## Returns

`Promise`\<`void`\>

A promise that resolves when the extension configuration initialisation is complete.
