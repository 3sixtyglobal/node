# identity-remove

Remove an identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both. The node identity and, in single-tenant mode, the node organisation identity cannot be removed.

## Usage

```text
identity-remove: Remove an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID of the identity to remove.

controller: (string, did, optional)
The DID of the controller for the identity, defaults to the identity itself.

remove-keys: (boolean, default: 'false', optional)
Also remove the keys and mnemonic held in the vault for the identity.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: identity-remove --identity="did:iota:...." --remove-keys=true
```

## Examples

Remove an identity document, keeping its keys in the vault:

```shell
twin-node identity-remove --identity="did:iota:..."
```

Remove an identity document together with all of its vault keys and its mnemonic:

```shell
twin-node identity-remove --identity="did:iota:..." --remove-keys=true
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
