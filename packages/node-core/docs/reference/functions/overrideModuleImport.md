# Function: overrideModuleImport()

> **overrideModuleImport**(`executionDirectory`, `envVars?`): `void`

Configure module resolution to support protocol-based loading (npm:, https:) and local files.

## Parameters

### executionDirectory

`string`

The execution directory for resolving local module paths.

### envVars?

[`IEnvironmentVariables`](../type-aliases/IEnvironmentVariables.md)

The environment variables containing extension configuration (optional, uses defaults if not provided).

## Returns

`void`
