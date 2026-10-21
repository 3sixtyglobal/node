# Function: loadEnvironmentVariables()

> **loadEnvironmentVariables**(`processEnv`, `options`): `object`

Load the environment variables for the 3Sixty Node, without producing any output.

## Parameters

### processEnv

\{\[`id`: `string`\]: `string` \| `undefined`; \}

The environment variables from the process.

### options

[`INodeOptions`](../interfaces/INodeOptions.md)

The options for running the server, envFilenames defaults to the .env file in the execution directory.

## Returns

`object`

The environment variables, with the options and env files applied.

## Throws

Error if a custom env file cannot be loaded.
