# node-org-id-set

Set the node organization ID.

## Tenancy

Single-tenant mode only. In multi-tenant mode the command fails, use the tenant commands instead.

## Usage

```text
node-org-id-set: Set the node organization ID
single-tenant only

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

organization-id: (string, did, required)
The organization DID to set as the node organization ID.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Deprecated aliases: set-node-org-id

Example: node-org-id-set --organization-id="did:iota:..."
```

## Examples

Set the organisation identity on the node:

```shell
twin-node node-org-id-set --load-env="organization-identity.env" --organization-id=!ORGANIZATION_DID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
