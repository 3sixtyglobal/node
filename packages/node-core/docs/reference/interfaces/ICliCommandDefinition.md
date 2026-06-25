# Interface: ICliCommandDefinition

Static definition of a CLI command including its name, parameters, and execution action.

## Properties

### command {#command}

> **command**: `string`

The command name.

***

### description {#description}

> **description**: `string`

The command description.

***

### example {#example}

> **example**: `string`

An example invocation string shown in help output.

***

### params {#params}

> **params**: [`ICliCommandDefinitionParam`](ICliCommandDefinitionParam.md)[]

The params available for the command.

***

### action {#action}

> **action**: (`engineCore`, `envVars`, `params`) => `Promise`\<`unknown`\>

The method to execute for the command.

#### Parameters

##### engineCore

`IEngineCore`

##### envVars

[`IEnvironmentVariables`](../type-aliases/IEnvironmentVariables.md)

##### params

#### Returns

`Promise`\<`unknown`\>

***

### requiresEngineStarted? {#requiresenginestarted}

> `optional` **requiresEngineStarted?**: `boolean`

Indicates whether the engine needs to be started before executing the command.

#### Default

```ts
true
```

***

### requiresNodeIdentity? {#requiresnodeidentity}

> `optional` **requiresNodeIdentity?**: `boolean`

Indicates whether the engine needs the node identity to be set if configured to use.

#### Default

```ts
true
```

***

### requiresOrgIdentity? {#requiresorgidentity}

> `optional` **requiresOrgIdentity?**: `boolean`

Indicates whether the engine needs the organization identity to be set.

#### Default

```ts
true
```
