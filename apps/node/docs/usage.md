# Node Usage

These commands cover local installation, on demand execution, and a complete bootstrap flow that can be reused in deployment scripts.

## Running

To install and run the CLI locally use the following commands:

```shell
npm install @twin.org/node -g
twin-node
```

or run directly using NPX:

```shell
npx "@twin.org/node"
```

## Help

```text
🌩️  TWIN Node v0.0.3-next.26

Command: help

All the commands available are listed below, for more information use the --help option with a specific command.
bootstrap-legacy: Bootstrap in legacy mode for backwards compatibility, **will be deprecated in future versions**
identity-create: Create an identity
identity-import: Import an identity
identity-verification-method-create: Create an identity verification method
identity-verification-method-import: Import an identity verification method
identity-verifiable-credential-create: Create a verifiable credential
node-set-identity: Set the node identity
remove-tenant-org-alias: Remove an alias from the tenant organization ID legacy list
set-node-org-id: Set the node organization ID
set-tenant-org-id: Set the organization ID for a tenant
tenant-create: Create a tenant with associated api key
tenant-import: Import a tenant with associated api key
tenant-update: Update a tenant with associated api key
user-create: Create a user
user-update: Update a user
vault-key-create: Create a vault key for an identity
vault-key-import: Import a vault key for an identity
```

## identity-create --help

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

Example: identity-create --mnemonic="..." --fund-wallet=true
```

## Example

### Bootstrap legacy mode will be deprecated in future versions

```shell
twin-node bootstrap-legacy --load-env=".env.bootstrap-legacy"
```

### Create the identity for the node

```shell
twin-node identity-create --fund-wallet=true --output-json="node-identity.json" --output-env="node-identity.env" --output-env-prefix=node
```

### Import existing identity details

```shell
twin-node identity-import --load-env="my-identity.env" --identity=!MY_DID --mnemonic=!MY_MNEMONIC
```

### Associate the identity with the node

```shell
twin-node node-set-identity --load-env="node-identity.env" --identity=!NODE_DID
```

### Add a key associated with the node identity for use in authentication signing

```shell
twin-node vault-key-create --load-env="node-identity.env" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --output-json="node-auth-key.json" --output-env="node-auth-key.env"
```

### Import existing authentication signing key details

```shell
twin-node vault-key-import --load-env="node-identity.env,node-auth-key.json" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

### Import an existing key associated with the node identity for use in authentication signing

```shell
twin-node vault-key-import --load-env="node-identity.env,my-key.json" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

### Create an organisation identity

```shell
twin-node identity-create --load-env="node-identity.env" --fund-wallet=true --output-json="organization-identity.json" --output-env="organization-identity.env" --output-env-prefix=organization
```

### Create a tenant to be used by the node

```shell
twin-node tenant-create --load-env="organization-identity.env" --label="node" --public-origin="https://api.example.com" --organization-id=!ORGANIZATION_DID --output-env-prefix=node --output-json="node-tenant.json" --output-env="node-tenant.env"
```

### Import a tenant to be used by the node

```shell
twin-node tenant-import --load-env="node-tenant.json" --tenant-id=!NODE_TENANT_ID --api-key=!NODE_API_KEY --label=!NODE_LABEL --public-origin="https://api.example.com"
```

### Update a tenant to be used by the node

```shell
twin-node tenant-update --load-env="node-tenant.json" --tenant-id=!NODE_TENANT_ID --label="New Label"
```

### Set the organization ID on the node

```shell
twin-node set-node-org-id --load-env="organization-identity.env" --organization-id=!ORGANIZATION_DID
```

### Set the organization ID on a tenant

```shell
twin-node set-tenant-org-id --load-env="node-tenant.env,organization-identity.env" --tenant-id=!NODE_TENANT_ID --organization-id=!ORGANIZATION_DID
```

### Remove an alias from the tenant organization ID legacy list

```shell
twin-node remove-tenant-org-alias --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --alias=!OLD_ORGANIZATION_DID
```

### Add a verification method to the organisation identity for attestation

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --output-json="organization-attestation.json" --output-env="organization-attestation.env"
```

### Import an attestation verification method for the organisation identity

```shell
twin-node identity-verification-method-import --load-env="node-identity.env,organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!DID_VERIFICATION_METHOD_ID --private-key-hex=!DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX
```

### Create a verifiable credential based on the organisation attestation verification method

```shell
twin-node identity-verifiable-credential-create --load-env="organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --subject-json="subject.json" --output-json="organization-attestation-credential.json" --output-env="organization-attestation-credential.env"
```

### Add a verification method to the organisation identity for immutable proofs

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID --output-json="organization-immutable-proof.json" --output-env="organization-immutable-proof.env"
```

### Add a verification method to the organisation identity for trust verification

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID --output-json="organization-trust.json" --output-env="organization-trust.env"
```

### Add a key associated with the organisation to be used for blob encryption

```shell
twin-node vault-key-create --load-env="organization-identity.env" --identity=!ORGANIZATION_DID --key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID --key-type=ChaCha20Poly1305 --output-json="organization-blob-encryption.json" --output-env="organization-blob-encryption.env"
```

### Create an identity associated with the organisation

```shell
twin-node identity-create --load-env="organization-identity.env" --controller=!ORGANIZATION_DID --output-json="user-identity.json" --output-env="user-identity.env" --output-env-prefix=user
```

### Create a user login associated with the user identity

```shell
twin-node user-create --load-env="organization-identity.env,user-identity.env,node-tenant.env" --user-identity=!USER_DID --organization-identity=!ORGANIZATION_DID --email="admin@node" --scope="tenant-admin" --output-json="user-account-admin.json" --output-env="user-account-admin.env" --output-env-prefix=admin
```

### Update a user login associated with the user identity

```shell
twin-node user-update --load-env="organization-identity.env,user-identity.env,node-tenant.env" --email="admin@node" --scope="tenant-admin,foo"
```
