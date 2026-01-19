# Function: initCli()

> **initCli**(`processEnv`, `args?`): [`ICliCommand`](../interfaces/ICliCommand.md) \| `undefined`

Initialise the CLI.

## Parameters

### processEnv

The environment variables from the process.

### args?

`string`[]

The command line arguments.

## Returns

[`ICliCommand`](../interfaces/ICliCommand.md) \| `undefined`

The constructed CLI command if there is one.

## Throws

GeneralError if the command is missing or invalid.
