# user-remove

Remove a user and their identity profile.

## Tenancy

Available in single-tenant and multi-tenant mode. In multi-tenant mode `--tenant-id` is required, in single-tenant mode it must not be supplied.

## Usage

```text
user-remove: Remove a user and their identity profile

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

email: (string, email, required)
The email address of the user to remove.

tenant-id: (string, hex(32), optional)
The tenant ID the user belongs to (multi-tenant mode only).

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: user-remove --email="user@example.com" --tenant-id="0011..aabb"
```

## Examples

Remove a user and their identity profile in single-tenant mode:

```shell
twin-node user-remove --email="bob@example.com"
```

Remove a user in multi-tenant mode:

```shell
twin-node user-remove --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --email="bob@example.com"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
