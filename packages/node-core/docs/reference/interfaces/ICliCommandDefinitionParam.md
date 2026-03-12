# Interface: ICliCommandDefinitionParam

Command param to execute in the CLI.

## Properties

### key

> **key**: `string`

The param key.

***

### type

> **type**: `"string"` \| `"number"` \| `"boolean"`

The param type.

***

### options?

> `optional` **options**: `string`[]

Possible options for the param.

***

### extendedType?

> `optional` **extendedType**: `string`

The extended type e.g. hex etc.

***

### required?

> `optional` **required**: `boolean`

Whether the param is required.

***

### defaultValue?

> `optional` **defaultValue**: [`CliCommandParamType`](../type-aliases/CliCommandParamType.md)

The default value of the param.

***

### description

> **description**: `string`

The param description.
