# tenant-list-by-org

List all tenants associated with a given organization DID.

## Tenancy

Multi-tenant mode only. In single-tenant mode the command fails because the tenant admin component is not registered.

## Usage

```text
tenant-list-by-org: List all tenants associated with a given organization DID

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

org-id: (string, did, required)
The organization DID to filter tenants by.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-list-by-org --org-id="did:iota:..."
```

## Examples

List the tenants for an organisation:

```shell
twin-node tenant-list-by-org --load-env="organization-identity.env" --org-id=!ORGANIZATION_DID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
