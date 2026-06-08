# Function: isTrustRequired()

> **isTrustRequired**(`envVars`): `boolean`

Checks if the trust subsystem is required.
Returns true when any component that depends on the trust subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if rights-management, or dataspace is enabled.
