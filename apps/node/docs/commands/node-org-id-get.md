# node-org-id-get

Get the organization ID currently assigned to the node.

## Tenancy

Single-tenant mode only. In multi-tenant mode the command fails, use the tenant commands instead.

## Usage

```text
node-org-id-get: Get the organization ID currently assigned to the node
single-tenant only

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: node-org-id-get
```

## Examples

Display the organisation DID currently assigned to the node:

```shell
3sixty-node node-org-id-get
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
