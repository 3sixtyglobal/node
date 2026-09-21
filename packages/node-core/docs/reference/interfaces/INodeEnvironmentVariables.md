# Interface: INodeEnvironmentVariables

The environment variables for the node.

## Properties

### nativeModules? {#nativemodules}

> `optional` **nativeModules?**: `string`

Comma separated list of native modules to initialise.

#### Default

```ts
"node:buffer,node:crypto,node:zlib"
```

***

### extensionsMaxSizeMb? {#extensionsmaxsizemb}

> `optional` **extensionsMaxSizeMb?**: `number`

Maximum size in MB for HTTPS extensions downloads.

#### Default

```ts
10
```

***

### extensionsClearCache? {#extensionsclearcache}

> `optional` **extensionsClearCache?**: `boolean`

Whether to clear the extensions cache on startup.

#### Default

```ts
false
```

***

### extensionsCacheDirectory? {#extensionscachedirectory}

> `optional` **extensionsCacheDirectory?**: `string`

Custom directory for extensions cache storage.

#### Default

```ts
".tmp"
```

***

### extensionsCacheTtlHours? {#extensionscachettlhours}

> `optional` **extensionsCacheTtlHours?**: `number`

TTL in hours for HTTPS extensions cache.

#### Default

```ts
24
```

***

### extensionsForceRefresh? {#extensionsforcerefresh}

> `optional` **extensionsForceRefresh?**: `boolean`

Force refresh of all cached extensions.

#### Default

```ts
false
```
