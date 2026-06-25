# Interface: ICliCommandDefinitionParam

Definition of a single parameter accepted by a CLI command.

## Properties

### key {#key}

> **key**: `string`

The param key.

***

### type {#type}

> **type**: `"string"` \| `"number"` \| `"boolean"`

The param type.

***

### options? {#options}

> `optional` **options?**: `string`[]

Possible options for the param.

***

### extendedType? {#extendedtype}

> `optional` **extendedType?**: `string`

The extended type e.g. hex etc.

***

### required? {#required}

> `optional` **required?**: `boolean`

Whether the param is required.

#### Default

```ts
true
```

***

### defaultValue? {#defaultvalue}

> `optional` **defaultValue?**: [`CliCommandParamType`](../type-aliases/CliCommandParamType.md)

The default value of the param.

***

### description {#description}

> **description**: `string`

The param description.
