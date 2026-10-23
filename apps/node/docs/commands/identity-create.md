# identity-create

Create an identity.

## Tenancy

Available in single-tenant and multi-tenant mode. `--node-organization-id` is only available in single-tenant mode and `--tenant-organization-id` is only available in multi-tenant mode.

## Usage

```text
identity-create: Create an identity

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

mnemonic: (string, 24 words, optional)
The mnemonic phrase to use for the identity. If not provided, a random mnemonic will be generated.

identity: (string, did, optional)
The DID of the identity to create. If not provided, a new DID will be generated.

controller: (string, did, optional)
The controller DID for the identity. If not provided, the identity will be its own controller.

fund-wallet: (boolean, default: 'false', optional)
Whether to fund the wallet associated with the identity from a faucet.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the command output.

output-env: (string, optional)
Path to a .env file to store the command output.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

node-id: (boolean, default: 'false', optional)
If true, set the created identity DID as the node identity.

node-organization-id: (boolean, default: 'false', optional)
If true, set the created identity DID as the node organization ID (not available in multi-tenant mode).

tenant-organization-id: (string, hex(32), optional)
The tenant ID to set the created identity DID as the organization ID for (requires multi-tenant mode).

Example: identity-create --mnemonic="..." --fund-wallet=true
```

## Examples

Create the node identity, fund its wallet and set it as the node identity:

```shell
3sixty-node identity-create --node-id=true --fund-wallet=true --output-json="node-identity.json" --output-env="node-identity.env" --output-env-prefix=node
```

Create an identity controlled by an organisation:

```shell
3sixty-node identity-create --load-env="organization-identity.env" --controller=!ORGANIZATION_DID --output-json="user-identity.json" --output-env="user-identity.env" --output-env-prefix=user
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
