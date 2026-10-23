# identity-list

List all identities held in custody by the node.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
identity-list: List all identities held in custody by the node

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: identity-list
```

## Examples

List every identity held in custody by the node, showing each DID and its controller:

```shell
3sixty-node identity-list
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
