# Function: isFederatedCatalogueRequired()

> **isFederatedCatalogueRequired**(`envVars`): `boolean`

Checks if the federated catalogue subsystem is required.
Returns true when the catalogue is explicitly enabled, a remote endpoint is configured, filters are set, or dataspace is enabled.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if the federated catalogue is required.
