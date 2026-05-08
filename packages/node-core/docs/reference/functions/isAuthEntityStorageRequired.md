# Function: isAuthEntityStorageRequired()

> **isAuthEntityStorageRequired**(`envVars`): `boolean`

Checks if the authentication entity storage subsystem is required.
Returns true when any component that depends on the authentication entity storage subsystem is enabled.

## Parameters

### envVars

[`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if authentication entity storage is enabled.
