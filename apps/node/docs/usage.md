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
bootstrap-dev: Bootstrap the development environment
identity-create: Create an identity
identity-import: Import an identity
identity-list: List all identities held in custody by the node
identity-resolve: Resolve an identity DID to its full document
identity-verification-method-create: Create an identity verification method
identity-verification-method-import: Import an identity verification method
identity-verifiable-credential-create: Create a verifiable credential
node-identity-get: Get the identity currently assigned to the node
node-identity-set: Set the node identity
org-users-list: List all users belonging to an organization DID
remove-tenant-org-alias: Remove an alias from the tenant organization ID legacy list
node-org-id-get: Get the organization ID currently assigned to the node (single-tenant only)
node-org-id-set: Set the node organization ID (single-tenant only)
tenant-org-id-set: Set the organization ID for a tenant
tenant-create: Create a tenant with associated api key
tenant-get: Get the full configuration record for a single tenant
tenant-import: Import a tenant with associated api key
tenant-list: List all tenants
tenant-list-by-org: List all tenants associated with a given organization DID
tenant-update: Update a tenant with associated api key
user-create: Create a user
user-get: Get a user by email address
user-update: Update a user
vault-key-create: Create a vault key for an identity
vault-key-import: Import a vault key for an identity
```

## Server Configuration

Key environment variables that control how the node server handles authentication. A full reference is in the `.env` example files.

| Variable                   | Default        | Description                                    |
| -------------------------- | -------------- | ---------------------------------------------- |
| `TWIN_AUTH_API_KEY_HEADER` | `x-api-key`    | HTTP header name for the API key on requests.  |
| `TWIN_AUTH_SIGNING_KEY_ID` | `auth-signing` | Vault key ID used to sign authentication JWTs. |

## bootstrap-dev --help

```text
bootstrap-dev: Bootstrap the development environment

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: bootstrap-dev --load-env=".env.bootstrap-dev"
```

The command reads the following environment variables (use `load-env` to supply them from a file):

| Variable                     | Default                        | Description                                                                 |
| ---------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `TWIN_NODE_IDENTITY`         | generated                      | The DID of the node identity.                                               |
| `TWIN_NODE_MNEMONIC`         | randomly generated             | The Bip39 mnemonic for the node identity seed.                              |
| `TWIN_FEATURES`              | `admin-user,wallet`            | Comma-separated feature flags: `admin-user`, `wallet`.                      |
| `TWIN_ORGANIZATION_IDENTITY` | generated                      | The DID to use for the organisation identity.                               |
| `TWIN_ORGANIZATION_MNEMONIC` | randomly generated             | The Bip39 mnemonic for the organisation identity seed.                      |
| `TWIN_TENANT_ID`             | generated                      | The tenant ID for the node tenant (multi-tenant only).                      |
| `TWIN_TENANT_API_KEY`        | generated                      | The API key for the node tenant (multi-tenant only).                        |
| `TWIN_ADMIN_USER_IDENTITY`   | generated                      | The DID for the admin user identity (`admin-user` feature).                 |
| `TWIN_ADMIN_USER_MNEMONIC`   | randomly generated             | The Bip39 mnemonic for the admin user identity seed (`admin-user` feature). |
| `TWIN_ADMIN_USER_NAME`       | `admin@node` or `admin@tenant` | The email/username for the admin user (`admin-user` feature).               |
| `TWIN_ADMIN_USER_PASSWORD`   | randomly generated             | The password for the admin user (`admin-user` feature).                     |

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

node-id: (boolean, default: 'false', optional)
If true, set the created identity DID as the node identity.

node-organization-id: (boolean, default: 'false', optional)
If true, set the created identity DID as the node organization ID (not available in multi-tenant mode).

tenant-organization-id: (string, hex(32), optional)
The tenant ID to set the created identity DID as the organization ID for (requires multi-tenant mode).

Example: identity-create --mnemonic="..." --fund-wallet=true
```

## identity-list --help

```text
identity-list: List all identities held in custody by the node

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: identity-list
```

## identity-resolve --help

```text
identity-resolve: Resolve an identity DID to its full document

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID to resolve.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the resolved DID document.

Example: identity-resolve --identity="did:iota:..."
```

## node-identity-get --help

```text
node-identity-get: Get the identity currently assigned to the node

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: node-identity-get
```

## node-org-id-get --help

```text
node-org-id-get: Get the organization ID currently assigned to the node
  single-tenant only

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: node-org-id-get
```

## node-org-id-set --help

```text
node-org-id-set: Set the node organization ID
  single-tenant only

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

organization-id: (string, did, required)
The organization DID to set as the node organization ID.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Deprecated aliases: set-node-org-id

Example: node-org-id-set --organization-id="did:iota:..."
```

## org-users-list --help

```text
org-users-list: List all users belonging to an organization DID

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

org-did: (string, did, optional)
The organization DID to list users for. Defaults to the node organization ID in single-tenant mode.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: org-users-list --org-did="did:iota:..."
```

## user-get --help

```text
user-get: Get a user by email address

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

email: (string, email, required)
The email address of the user to retrieve.

tenant-id: (string, hex(32), optional)
The tenant ID to retrieve the user from (multi-tenant mode only).

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: user-get --email="bob@example.com"
```

## tenant-get --help

```text
tenant-get: Get the full configuration record for a single tenant

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

tenant-id: (string, hex(32), required)
The tenant ID to retrieve.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-get --tenant-id="0011..aabb"
```

## tenant-list --help

```text
tenant-list: List all tenants

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-list
```

## tenant-list-by-org --help

```text
tenant-list-by-org: List all tenants associated with a given organization DID

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

org-id: (string, did, required)
The organization DID to filter tenants by.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: tenant-list-by-org --org-id="did:iota:..."
```

## Example

### Bootstrap dev (single command)

Runs the complete bootstrap sequence in one step using values from `.env.bootstrap-dev`:

```shell
twin-node bootstrap-dev --load-env=".env.bootstrap-dev"
```

The sections below show the equivalent step-by-step commands that replicate the bootstrap-dev process.

---

### Step 1 - Create the node identity and associate it with the node

Supply `--fund-wallet=true` when the `wallet` feature is enabled. `--node-id=true` sets the created identity as the node identity in the same step.

```shell
twin-node identity-create --node-id=true --fund-wallet=true --output-json="node-identity.json" --output-env="node-identity.env" --output-env-prefix=node
```

### Step 2 - Create the authentication signing key for the node

```shell
twin-node vault-key-create --load-env="node-identity.env" --identity=!NODE_DID --key-type=Ed25519 --key-id=!TWIN_AUTH_SIGNING_KEY_ID --overwrite-mode=skip --output-json="node-auth-key.json" --output-env="node-auth-key.env"
```

To import an existing authentication signing key instead:

```shell
twin-node vault-key-import --load-env="node-identity.env,node-auth-key.json" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

### Step 3 - Create the organisation identity

```shell
twin-node identity-create --load-env="node-identity.env" --fund-wallet=true --output-json="organization-identity.json" --output-env="organization-identity.env" --output-env-prefix=organization
```

### Step 4 - Add the trust verification method to the organisation identity

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-trust.json" --output-env="organization-trust.env"
```

### Step 5 - Set the organisation identity on the node (single-tenant)

```shell
twin-node node-org-id-set --load-env="organization-identity.env" --organization-id=!ORGANIZATION_DID
```

### Step 6 - Create the node tenant and associate the organisation (multi-tenant only)

```shell
twin-node tenant-create --load-env="node-identity.env" --label="Node" --output-json="node-tenant.json" --output-env="node-tenant.env" --output-env-prefix=node
```

```shell
twin-node tenant-org-id-set --load-env="node-tenant.env,organization-identity.env" --tenant-id=!NODE_TENANT_ID --organization-id=!ORGANIZATION_DID
```

To import an existing tenant instead:

```shell
twin-node tenant-import --load-env="node-tenant.json" --tenant-id=!NODE_TENANT_ID --api-key=!NODE_API_KEY --label=!NODE_LABEL --public-origin="https://api.example.com"
```

To update an existing tenant:

```shell
twin-node tenant-update --load-env="node-tenant.json" --tenant-id=!NODE_TENANT_ID --label="New Label"
```

To remove a stale organisation alias from a tenant:

```shell
twin-node remove-tenant-org-alias --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --alias=!OLD_ORGANIZATION_DID
```

---

The following steps run when the `admin-user` feature is enabled.

### Step 7 - Add the blob encryption key to the organisation (if blob encryption is enabled)

```shell
twin-node vault-key-create --load-env="organization-identity.env" --identity=!ORGANIZATION_DID --key-type=ChaCha20Poly1305 --key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID --overwrite-mode=skip --output-json="organization-blob-encryption.json" --output-env="organization-blob-encryption.env"
```

### Step 8 - Add the attestation verification method to the organisation (if attestation is enabled)

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-attestation.json" --output-env="organization-attestation.env"
```

To import an existing attestation verification method:

```shell
twin-node identity-verification-method-import --load-env="node-identity.env,organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-id=!DID_VERIFICATION_METHOD_ID --private-key-hex=!DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX
```

To create a verifiable credential using the attestation verification method:

```shell
twin-node identity-verifiable-credential-create --load-env="organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --subject-json="subject.json" --output-json="organization-attestation-credential.json" --output-env="organization-attestation-credential.env"
```

### Step 9 - Add the immutable proof verification method to the organisation (if immutable proofs are enabled)

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-immutable-proof.json" --output-env="organization-immutable-proof.env"
```

### Step 10 - Create the admin user identity

```shell
twin-node identity-create --load-env="organization-identity.env" --controller=!ORGANIZATION_DID --output-json="admin-user-identity.json" --output-env="admin-user-identity.env" --output-env-prefix=admin_user
```

### Step 11 - Create the admin user account

```shell
twin-node user-create --load-env="organization-identity.env,admin-user-identity.env,node-tenant.env" --user-identity=!ADMIN_USER_DID --organization-identity=!ORGANIZATION_DID --email="admin@node" --given-name="Node" --family-name="Admin" --scope="tenant-admin,user-admin" --output-json="user-account-admin.json" --output-env="user-account-admin.env" --output-env-prefix=admin
```

To update an existing user:

```shell
twin-node user-update --load-env="organization-identity.env,admin-user-identity.env,node-tenant.env" --email="admin@node" --scope="tenant-admin,user-admin,foo"
```

---

## Inspection commands

The following commands are read-only and can be run at any time to inspect the state of the node.

### Get the node identity

Resolves and displays the DID document currently assigned as the node identity:

```shell
twin-node node-identity-get
```

### Get the node organization ID

Displays the organization DID currently assigned to the node (single-tenant only):

```shell
twin-node node-org-id-get
```

### Resolve an identity

Resolve any DID to its full document. Pass `--output-json` to save the document to a file:

```shell
twin-node identity-resolve --identity="did:iota:..."
twin-node identity-resolve --identity="did:iota:..." --output-json="did-document.json"
```

### List all identities

List every identity held in custody by the node, showing each DID and its controller:

```shell
twin-node identity-list
```

### List all tenants (multi-tenant only)

```shell
twin-node tenant-list
```

### Get a single tenant (multi-tenant only)

```shell
twin-node tenant-get --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID
```

### List tenants for an organization (multi-tenant only)

```shell
twin-node tenant-list-by-org --load-env="organization-identity.env" --org-id=!ORGANIZATION_DID
```

### List users for an organization

In single-tenant mode, `--org-did` can be omitted and the node organization ID is used automatically:

```shell
twin-node org-users-list
```

To list users for a specific organization:

```shell
twin-node org-users-list --load-env="organization-identity.env" --org-did=!ORGANIZATION_DID
```

### Get a single user

```shell
twin-node user-get --email="admin@node"
```

In multi-tenant mode supply the tenant ID:

```shell
twin-node user-get --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --email="admin@node"
```
