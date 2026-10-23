# Function: isAuthorizationRequired()

> **isAuthorizationRequired**(`envVars`): `boolean`

Checks if the authorization subsystem is required.
Returns true when any authorization connector is configured.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if authorization is enabled.
