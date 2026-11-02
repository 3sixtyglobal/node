# Function: seedMessagingTemplates()

> **seedMessagingTemplates**(`engineCore`, `directory`): `Promise`\<`void`\>

Store the messaging templates from a directory in every tenant that does not have them yet, and
in each tenant created later.

## Parameters

### engineCore

`IEngineCore`

The running engine core.

### directory

`string` \| `undefined`

The directory holding the templates.

## Returns

`Promise`\<`void`\>

A promise that resolves when the templates have been stored.
