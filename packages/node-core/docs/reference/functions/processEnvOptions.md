# Function: processEnvOptions()

> **processEnvOptions**(`processEnv`, `options`): `void`

Load the env files and process the options.

## Parameters

### processEnv

\{\[`id`: `string`\]: `string`; \}

The environment variables from the process.

### options

`object`[]

The options.

## Returns

`void`

The substituted options, mutated in place with env variable values resolved.

## Throws

GeneralError if an env file has errors.
