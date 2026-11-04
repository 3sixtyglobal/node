# Type Alias: NodeExtensionFeaturesMethod

> **NodeExtensionFeaturesMethod** = (`envVars`) => `Promise`\<`IFeatureDefinition`[]\>

The type for the features method of an extension module.
This is called while the node is configured, to list the features the extension provides.

## Parameters

### envVars

[`IEnvironmentVariables`](IEnvironmentVariables.md)

The environment variables for the node.

## Returns

`Promise`\<`IFeatureDefinition`[]\>

The features, each with the roles that can use it.
