# Function: processEnvironmentVariables()

> **processEnvironmentVariables**(`processEnv`, `options`): `Promise`\<[`IBootstrapDevEnvironmentVariables`](../interfaces/IBootstrapDevEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md) & `object`\>

Process the loaded environment variables for the TWIN Node.

## Parameters

### processEnv

The loaded environment variables.

### options

[`INodeOptions`](../interfaces/INodeOptions.md)

The options for running the server.

## Returns

`Promise`\<[`IBootstrapDevEnvironmentVariables`](../interfaces/IBootstrapDevEnvironmentVariables.md) & [`INodeEnvironmentVariables`](../interfaces/INodeEnvironmentVariables.md) & [`IEngineEnvironmentVariables`](../interfaces/IEngineEnvironmentVariables.md) & [`IEngineServerEnvironmentVariables`](../interfaces/IEngineServerEnvironmentVariables.md) & `object`\>

A promise that resolves to the environment variables for the node.

## Throws

GeneralError if an environment variable is not recognised in strict mode.
