# vault-key-create

Create a vault key for an identity.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
vault-key-create: Create a vault key for an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID to associate the key with.

key-id: (string, required)
The ID of the key.

key-type: (string, default: 'Ed25519', optional, options: [Ed25519, ChaCha20Poly1305])
The type of the key.

overwrite-mode: (string, default: 'skip', optional, options: [skip, overwrite, error])
The mode to use when a key with the same id already exists.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the command output.

output-env: (string, optional)
Path to a .env file to store the command output.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

Example: vault-key-create --identity="did:iota:...." --key-id="my-key" --key-type="Ed25519"
```

## Examples

Create the authentication signing key for the node:

```shell
twin-node vault-key-create --load-env="node-identity.env" --identity=!NODE_DID --key-type=Ed25519 --key-id=!TWIN_AUTH_SIGNING_KEY_ID --overwrite-mode=skip --output-json="node-auth-key.json" --output-env="node-auth-key.env"
```

Create a blob storage encryption key for the organisation:

```shell
twin-node vault-key-create --load-env="organization-identity.env" --identity=!ORGANIZATION_DID --key-type=ChaCha20Poly1305 --key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID --overwrite-mode=skip --output-json="organization-blob-encryption.json"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
