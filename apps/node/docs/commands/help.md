# help

List all the commands, or show the parameters for a single command.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
All the commands available are listed below, for more information use the --help option with a specific command.
bootstrap-dev: Bootstrap the development environment
identity-create: Create an identity
identity-import: Import an identity
identity-list: List all identities held in custody by the node
identity-remove: Remove an identity
identity-resolve: Resolve an identity DID to its full document
identity-verification-method-create: Create an identity verification method
identity-verification-method-import: Import an identity verification method
identity-verifiable-credential-create: Create a verifiable credential
node-identity-get: Get the identity currently assigned to the node
node-identity-set: Set the node identity
org-users-list: List all users belonging to an organization DID
node-org-id-get: Get the organization ID currently assigned to the node (single-tenant only)
node-org-id-set: Set the node organization ID (single-tenant only)
tenant-org-id-set: Set the organization ID for a tenant
tenant-org-alias-remove: Remove an alias from the tenant organization ID legacy list
tenant-create: Create a tenant with associated api key
tenant-get: Get the full configuration record for a single tenant
tenant-import: Import a tenant with associated api key
tenant-list: List all tenants
tenant-list-by-org: List all tenants associated with a given organization DID
tenant-remove: Remove a tenant
tenant-update: Update a tenant with associated api key
user-create: Create a user
user-get: Get a user by email address
user-remove: Remove a user and their identity profile
user-update: Update a user
user-update-password: Update the password of a user
vault-key-create: Create a vault key for an identity
vault-key-import: Import a vault key for an identity
vault-key-remove: Remove a vault key for an identity
vault-key-update: Replace the key material of an existing vault key for an identity
```

## Examples

List all the commands:

```shell
3sixty-node --help
```

Show the help for a single command:

```shell
3sixty-node identity-create --help
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
