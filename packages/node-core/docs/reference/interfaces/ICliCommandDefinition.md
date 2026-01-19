# Interface: ICliCommandDefinition

Command to execute in the CLI.

## Properties

### command

> **command**: `string`

The command name.

***

### description

> **description**: `string`

The command description.

***

### example

> **example**: `string`

The example.

***

### params

> **params**: [`ICliCommandDefinitionParam`](ICliCommandDefinitionParam.md)[]

The params available for the command.

***

### action()

> **action**: (`engineCore`, `envVars`, `params`) => `Promise`\<`unknown`\>

The method to execute for the command.

#### Parameters

##### engineCore

`IEngineCore`

##### envVars

[`INodeEnvironmentVariables`](INodeEnvironmentVariables.md)

##### params

#### Returns

`Promise`\<`unknown`\>

***

### requiresEngineStarted?

> `optional` **requiresEngineStarted**: `boolean`

Indicates whether the engine needs to be started before executing the command.

#### Default

```ts
true
```

***

### requiresNodeIdentity?

> `optional` **requiresNodeIdentity**: `boolean`

Indicates whether the engine needs the node identity to be set if configured to use.

#### Default

```ts
true
```

***

### requiresTenantId?

> `optional` **requiresTenantId**: `boolean`

Indicates whether the engine needs the tenant id to be set if configured to use.

#### Default

```ts
true
```
