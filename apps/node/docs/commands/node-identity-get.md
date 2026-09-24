# node-identity-get

Get the identity currently assigned to the node.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
node-identity-get: Get the identity currently assigned to the node

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: node-identity-get
```

## Examples

Resolve and display the DID document currently assigned as the node identity:

```shell
twin-node node-identity-get
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
