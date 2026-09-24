# tenant-org-id-set

Set the organization ID for a tenant.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-org-id-set: Set the organization ID for a tenant

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), required)
The tenant ID to update.

organization-id: (string, did, required)
The organization DID to set as the tenant organization ID.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Deprecated aliases: set-tenant-org-id

Example: tenant-org-id-set --tenant-id="0011..aabb" --organization-id="did:iota:..."
```

## Examples

Associate an organisation with the node tenant:

```shell
twin-node tenant-org-id-set --load-env="node-tenant.env,organization-identity.env" --tenant-id=!NODE_TENANT_ID --organization-id=!ORGANIZATION_DID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
