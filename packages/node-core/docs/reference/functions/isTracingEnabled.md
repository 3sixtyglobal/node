# Function: isTracingEnabled()

> **isTracingEnabled**(`envVars`): `boolean`

Checks if the tracing subsystem is enabled.
Returns true when any component that depends on the tracing subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if tracing is enabled.
