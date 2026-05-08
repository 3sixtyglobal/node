# Function: isAutomationRequired()

> **isAutomationRequired**(`envVars`): `boolean`

Checks if the automation subsystem is required.
Returns true when any component that depends on the automation subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if automation is enabled.
