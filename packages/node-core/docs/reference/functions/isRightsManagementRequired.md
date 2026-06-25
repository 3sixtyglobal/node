# Function: isRightsManagementRequired()

> **isRightsManagementRequired**(`envVars`): `boolean`

Checks if the rights management subsystem is required.
Returns true when any component that depends on the rights management subsystem is enabled.
Note: rights management has no standalone enable flag - it is gated entirely on
`dataspaceEnabled`. Setting `TWIN_RIGHTS_MANAGEMENT_*` env var in isolation does not
enable the subsystem; `TWIN_DATASPACE_ENABLED` must also be true.

## Parameters

### envVars

[`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md)

The environment variables.

## Returns

`boolean`

True if rights management is enabled.
