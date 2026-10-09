# tenant-list

List all tenants.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-list: List all tenants

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-list
```

## Examples

List all tenants:

```shell
3sixty-node tenant-list
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
