# vault-key-remove

Remove a vault key for an identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
vault-key-remove: Remove a vault key for an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID the key is associated with.

key-id: (string, required)
The ID of the key.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: vault-key-remove --identity="did:iota:...." --key-id="my-key"
```

## Examples

Remove a vault key:

```shell
twin-node vault-key-remove --load-env="node-identity.env" --identity=!NODE_DID --key-id="my-key"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
