# Function: isUrlTransformerRequired()

> **isUrlTransformerRequired**(`envVars`): `boolean`

Checks if the URL transformer subsystem is required.
Returns true when any component that depends on the URL transformer subsystem is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if rights-management, dataspace, federated-catalogue, or tenant is enabled.
