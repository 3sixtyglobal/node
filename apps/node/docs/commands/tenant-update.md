# tenant-update

Update a tenant with associated api key.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-update: Update a tenant with associated api key

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), required)
The tenant ID to update.

api-key: (string, hex(32), optional)
The API key to associate with the tenant id.

organization-id: (string, did, optional)
The organization DID to associate with the tenant.

label: (string, optional)
A descriptive label for the tenant.

public-origin: (string, url, optional)
The public URL origin for the tenant e.g. https://example.com:1234

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-update --tenant-id="0011..aabb" --api-key="aabb..0099" --label="My Tenant" --public-origin="https://example.com:1234"
```

## Examples

Update the label of a tenant:

```shell
twin-node tenant-update --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --label="New Label"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
