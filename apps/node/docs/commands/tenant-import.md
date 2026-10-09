# tenant-import

Import a tenant with associated api key.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-import: Import a tenant with associated api key

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), required)
The tenant ID to import.

api-key: (string, hex(32), required)
The API key to associate with the tenant id.

organization-id: (string, did, required)
The organization DID to associate with the tenant.

label: (string, optional)
A descriptive label for the tenant.

public-origin: (string, url, optional)
The public URL origin for the tenant e.g. https://example.com:1234

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-import --tenant-id="0011..aabb" --api-key="aabb..0099" --organization-id="did:iota:..." --label="My Tenant" --public-origin="https://example.com:1234"
```

## Examples

Import an existing tenant:

```shell
3sixty-node tenant-import --load-env="node-tenant.env,organization-identity.env" --tenant-id=!NODE_TENANT_ID --api-key=!NODE_API_KEY --organization-id=!ORGANIZATION_DID --label="Node" --public-origin="https://api.example.com"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
