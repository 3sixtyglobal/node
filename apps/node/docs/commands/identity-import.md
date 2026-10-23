# identity-import

Import an identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
identity-import: Import an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID of the identity to import.

mnemonic: (string, 24 words, required)
The mnemonic phrase to use for the identity.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: identity-import --identity="did:iota:..." --mnemonic="..."
```

## Examples

Import an identity that already exists, storing its mnemonic in the vault:

```shell
3sixty-node identity-import --identity="did:iota:..." --mnemonic="..."
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
