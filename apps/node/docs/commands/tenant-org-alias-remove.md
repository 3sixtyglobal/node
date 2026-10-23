# tenant-org-alias-remove

Remove an alias from the tenant organization ID legacy list.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-org-alias-remove: Remove an alias from the tenant organization ID legacy list

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), required)
The tenant ID to update.

alias: (string, did, required)
The organization DID alias to remove from the legacy list.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Deprecated aliases: remove-tenant-org-alias

Example: tenant-org-alias-remove --tenant-id="0011..aabb" --alias="did:iota:..."
```

## Examples

Remove a stale organisation alias from a tenant:

```shell
3sixty-node tenant-org-alias-remove --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --alias=!OLD_ORGANIZATION_DID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
