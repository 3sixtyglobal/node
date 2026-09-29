# node-identity-set

Set the node identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
node-identity-set: Set the node identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The identity to set in the node.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Deprecated aliases: node-set-identity

Example: node-identity-set --identity="did:iota..."
```

## Examples

Set an existing identity as the node identity:

```shell
twin-node node-identity-set --load-env="node-identity.env" --identity=!NODE_DID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
