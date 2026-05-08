# Function: isFederatedCatalogueRequired()

> **isFederatedCatalogueRequired**(`envVars`): `boolean`

Checks if the immutable proof subsystem is required.
Returns true when any component that depends on the immutable proof subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if verifiable storage is enabled.
