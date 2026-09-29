# tenant-remove

Remove a tenant.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-remove: Remove a tenant

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), required)
The tenant ID to remove.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-remove --tenant-id="0011..aabb"
```

## Examples

Remove a tenant:

```shell
twin-node tenant-remove --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
