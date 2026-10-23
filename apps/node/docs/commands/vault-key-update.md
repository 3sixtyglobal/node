# vault-key-update

Replace the key material of an existing vault key for an identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both. The key keeps its existing type, only the key material is replaced.

## Usage

```text
vault-key-update: Replace the key material of an existing vault key for an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID the key is associated with.

key-id: (string, required)
The ID of the key.

private-key-hex: (string, required)
The replacement private key in hex format, the key type is kept.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: vault-key-update --identity="did:iota:...." --key-id="my-key" --private-key-hex="15...a2"
```

## Examples

Replace the material of an existing key:

```shell
3sixty-node vault-key-update --load-env="node-identity.env" --identity=!NODE_DID --key-id="my-key" --private-key-hex="0x..."
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
