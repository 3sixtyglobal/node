# user-get

Get a user by email address.

## Tenancy

Available in single-tenant and multi-tenant mode. In multi-tenant mode `--tenant-id` is required, in single-tenant mode it must not be supplied.

## Usage

```text
user-get: Get a user by email address

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

email: (string, email, required)
The email address of the user to retrieve.

tenant-id: (string, hex(32), optional)
The tenant ID to retrieve the user from (multi-tenant mode only).

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: user-get --email="bob@example.com"
```

## Examples

Get a user in single-tenant mode:

```shell
twin-node user-get --email="admin@node"
```

Get a user in multi-tenant mode:

```shell
twin-node user-get --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --email="admin@tenant"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
