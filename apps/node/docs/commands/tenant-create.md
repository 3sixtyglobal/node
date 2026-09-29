# tenant-create

Create a tenant with associated api key.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-create: Create a tenant with associated api key

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), optional)
The tenant ID to add. If not provided a random tenant id will be generated.

api-key: (string, hex(32), optional)
The API key to associate with the tenant id. If not provided, a random key will be generated.

organization-id: (string, did, required)
The organization DID to associate with the tenant.

public-origin: (string, url, optional)
The public URL origin for the tenant e.g. https://example.com:1234

label: (string, optional)
A descriptive label for the tenant.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the command output.

output-env: (string, optional)
Path to a .env file to store the command output.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

Example: tenant-create --tenant-id="0011..aabb" --api-key="aabb..0099" --organization-id="did:iota:..." --label="My Tenant" --public-origin="https://example.com:1234"
```

## Examples

Create the node tenant for an organisation:

```shell
twin-node tenant-create --load-env="organization-identity.env" --organization-id=!ORGANIZATION_DID --label="Node" --output-json="node-tenant.json" --output-env="node-tenant.env" --output-env-prefix=node
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
