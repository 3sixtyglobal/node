# Interface: ICliCommand

A resolved CLI command ready for execution, pairing a definition with its populated parameters.

## Properties

### definition {#definition}

> **definition**: [`ICliCommandDefinition`](ICliCommandDefinition.md)

The command to execute.

***

### params {#params}

> **params**: `object`

The params to execute the command with.

#### Index Signature

\[`id`: `string`\]: [`CliCommandParamType`](../type-aliases/CliCommandParamType.md)
