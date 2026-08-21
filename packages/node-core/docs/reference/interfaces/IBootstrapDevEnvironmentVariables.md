# Interface: IBootstrapDevEnvironmentVariables

The environment variables for the bootstrap development command.

## Properties

### features? {#features}

> `optional` **features?**: `string`

The features that are enabled on the node.

#### Default

```ts
[]
```

***

### nodeIdentity? {#nodeidentity}

> `optional` **nodeIdentity?**: `string`

The identity of the node which, if empty and node-identity feature is enabled it will be generated.

***

### nodeMnemonic? {#nodemnemonic}

> `optional` **nodeMnemonic?**: `string`

The mnemonic for the node identity, if empty it will be randomly generated.

***

### tenantId? {#tenantid}

> `optional` **tenantId?**: `string`

A tenant id to use as a default for the node.

***

### tenantApiKey? {#tenantapikey}

> `optional` **tenantApiKey?**: `string`

A tenant api key to use as a default for the node.

***

### organizationIdentity? {#organizationidentity}

> `optional` **organizationIdentity?**: `string`

The organisation identity. If not provided it will be generated.

***

### organizationMnemonic? {#organizationmnemonic}

> `optional` **organizationMnemonic?**: `string`

The mnemonic for the organisation identity, if empty it will be randomly generated.

***

### adminUserIdentity? {#adminuseridentity}

> `optional` **adminUserIdentity?**: `string`

If the admin-user feature is enabled, this will be the identity of the user. If not provided it will be generated.

***

### adminUserMnemonic? {#adminusermnemonic}

> `optional` **adminUserMnemonic?**: `string`

The mnemonic for the admin user, if empty it will be randomly generated.

***

### adminUserName? {#adminusername}

> `optional` **adminUserName?**: `string`

If the admin-user feature is enabled, this will be the name of the user.

#### Default

```ts
admin@node
```

***

### adminUserPassword? {#adminuserpassword}

> `optional` **adminUserPassword?**: `string`

If the admin-user feature is enabled, this will be the password of the user. If empty it will be randomly generated.

***

### adminUserScope? {#adminuserscope}

> `optional` **adminUserScope?**: `string`

If the admin-user feature is enabled, this is a comma-separated list of scopes for the user.

#### Default

```ts
tenant-admin,user-admin (when tenant enabled) or user-admin (when tenant disabled)
```
