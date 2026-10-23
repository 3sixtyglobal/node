# user-update

Update a user.

## Tenancy

Available in single-tenant and multi-tenant mode. In multi-tenant mode `--tenant-id` is required, in single-tenant mode it must not be supplied.

## Usage

```text
user-update: Update a user

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

user-identity: (string, DID, optional)
The DID to associate the user with.

organization-identity: (string, DID, optional)
The organization DID to associate the user with.

tenant-id: (string, hex(32), optional)
The tenant ID to associate the user with (multi-tenant mode only).

email: (string, email, required)
The email address of the user.

scope: (string, optional)
List of scopes to associate with the user, comma separated.

given-name: (string, optional)
The given name of the user.

family-name: (string, optional)
The family name of the user.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: user-update --email="bob@examples.com" --user-identity="did:iota:...." --organization-identity="did:iota:...." --scope="tenant-admin" --givenName="Bob" --familyName="Smith"
```

## Examples

Update the scope of a user in single-tenant mode:

```shell
3sixty-node user-update --email="admin@node" --scope="user-admin,foo"
```

Update a user in multi-tenant mode:

```shell
3sixty-node user-update --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --email="admin@tenant" --given-name="Tenant" --family-name="Admin"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
