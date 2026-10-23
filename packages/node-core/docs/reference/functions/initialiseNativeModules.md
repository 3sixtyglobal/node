# Function: initialiseNativeModules()

> **initialiseNativeModules**(`modules`): `Promise`\<`void`\>

Register the native modules the framework classes prefer over their pure JavaScript fallbacks.

## Parameters

### modules

`string`[]

The module specifiers to register.

## Returns

`Promise`\<`void`\>

A promise that resolves when registration has been attempted for every specifier.
