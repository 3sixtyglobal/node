# Function: isTaskSchedulerRequired()

> **isTaskSchedulerRequired**(`envVars`): `boolean`

Checks if the task scheduler subsystem is required.
Returns true when any component that depends on the task scheduler subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if task scheduler is enabled.
