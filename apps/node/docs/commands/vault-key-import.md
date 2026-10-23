# vault-key-import

Import a vault key for an identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
vault-key-import: Import a vault key for an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID to associate the key with.

key-id: (string, required)
The ID of the key.

key-type: (string, default: 'Ed25519', optional, options: [Ed25519, ChaCha20Poly1305])
The type of the key.

private-key-hex: (string, required)
The private key in hex format.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: vault-key-import --identity="did:iota:...." --key-id="my-key" --key-type=Ed25519 --private-key-hex="15...a2"
```

## Examples

Import an existing authentication signing key:

```shell
3sixty-node vault-key-import --load-env="node-identity.env,node-auth-key.env" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
