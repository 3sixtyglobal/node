# Function: constructCliCommand()

> **constructCliCommand**(`processEnv`, `cliArgs`): [`ICliCommand`](../interfaces/ICliCommand.md) \| `undefined`

Construct the CLI command from the parsed arguments.

## Parameters

### processEnv

The environment variables from the process.

### cliArgs

[`ICliArgs`](../interfaces/ICliArgs.md)

The parsed CLI arguments.

## Returns

[`ICliCommand`](../interfaces/ICliCommand.md) \| `undefined`

The constructed CLI command.

## Throws

GeneralError if the command is missing.
