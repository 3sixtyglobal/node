# Function: isRightsManagementRequired()

> **isRightsManagementRequired**(`envVars`): `boolean`

Checks if the rights management subsystem is required.
Returns true when any component that depends on the rights management subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if rights management is enabled.
