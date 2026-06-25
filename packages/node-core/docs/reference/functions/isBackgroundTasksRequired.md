# Function: isBackgroundTasksRequired()

> **isBackgroundTasksRequired**(`envVars`): `boolean`

Checks if the background tasks subsystem is required.
Returns true when any component that depends on the background tasks subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if dataspace or verifiable storage is enabled.
