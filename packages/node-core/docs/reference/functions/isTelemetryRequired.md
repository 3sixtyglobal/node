# Function: isTelemetryRequired()

> **isTelemetryRequired**(`envVars`): `boolean`

Checks if the telemetry subsystem is required.
Returns true when any component that depends on the telemetry subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if telemetry is enabled.
