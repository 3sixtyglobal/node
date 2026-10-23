# Node Usage

These commands cover local installation, on demand execution, and a complete bootstrap flow that can be reused in deployment scripts.

## Running

To install and run the CLI locally use either npm or pnpm:

```shell
npm install @3sixty/node -g
3sixty-node
```

```shell
pnpm add @3sixty/node -g
3sixty-node
```

or run it directly without installing, using npx or pnpm dlx:

```shell
npx "@3sixty/node"
```

```shell
pnpm dlx "@3sixty/node"
```

## Commands

Each command has its own page describing its parameters, how it behaves in single-tenant and multi-tenant mode, and examples. Run any command with `--help` to show its parameters from the command line.

### General

| Command                                    | Description                                                        | Tenancy |
| ------------------------------------------ | ------------------------------------------------------------------ | ------- |
| [help](commands/help.md)                   | List all the commands, or show the parameters for a single command | Both    |
| [bootstrap-dev](commands/bootstrap-dev.md) | Bootstrap the development environment                              | Both    |

### Node

| Command                                            | Description                                            | Tenancy       |
| -------------------------------------------------- | ------------------------------------------------------ | ------------- |
| [node-identity-get](commands/node-identity-get.md) | Get the identity currently assigned to the node        | Both          |
| [node-identity-set](commands/node-identity-set.md) | Set the node identity                                  | Both          |
| [node-org-id-get](commands/node-org-id-get.md)     | Get the organization ID currently assigned to the node | Single-tenant |
| [node-org-id-set](commands/node-org-id-set.md)     | Set the node organization ID                           | Single-tenant |

### Identity

| Command                                                                                    | Description                                     | Tenancy |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------- |
| [identity-create](commands/identity-create.md)                                             | Create an identity                              | Both    |
| [identity-import](commands/identity-import.md)                                             | Import an identity                              | Both    |
| [identity-list](commands/identity-list.md)                                                 | List all identities held in custody by the node | Both    |
| [identity-remove](commands/identity-remove.md)                                             | Remove an identity                              | Both    |
| [identity-resolve](commands/identity-resolve.md)                                           | Resolve an identity DID to its full document    | Both    |
| [identity-verification-method-create](commands/identity-verification-method-create.md)     | Create an identity verification method          | Both    |
| [identity-verification-method-import](commands/identity-verification-method-import.md)     | Import an identity verification method          | Both    |
| [identity-verifiable-credential-create](commands/identity-verifiable-credential-create.md) | Create a verifiable credential                  | Both    |

### Vault

| Command                                          | Description                                                       | Tenancy |
| ------------------------------------------------ | ----------------------------------------------------------------- | ------- |
| [vault-key-create](commands/vault-key-create.md) | Create a vault key for an identity                                | Both    |
| [vault-key-import](commands/vault-key-import.md) | Import a vault key for an identity                                | Both    |
| [vault-key-remove](commands/vault-key-remove.md) | Remove a vault key for an identity                                | Both    |
| [vault-key-update](commands/vault-key-update.md) | Replace the key material of an existing vault key for an identity | Both    |

### Tenant

| Command                                                        | Description                                                 | Tenancy      |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| [tenant-create](commands/tenant-create.md)                     | Create a tenant with associated api key                     | Multi-tenant |
| [tenant-get](commands/tenant-get.md)                           | Get the full configuration record for a single tenant       | Multi-tenant |
| [tenant-import](commands/tenant-import.md)                     | Import a tenant with associated api key                     | Multi-tenant |
| [tenant-list](commands/tenant-list.md)                         | List all tenants                                            | Multi-tenant |
| [tenant-list-by-org](commands/tenant-list-by-org.md)           | List all tenants associated with a given organization DID   | Multi-tenant |
| [tenant-org-id-set](commands/tenant-org-id-set.md)             | Set the organization ID for a tenant                        | Multi-tenant |
| [tenant-org-alias-remove](commands/tenant-org-alias-remove.md) | Remove an alias from the tenant organization ID legacy list | Multi-tenant |
| [tenant-remove](commands/tenant-remove.md)                     | Remove a tenant                                             | Multi-tenant |
| [tenant-update](commands/tenant-update.md)                     | Update a tenant with associated api key                     | Multi-tenant |

### User

| Command                                                  | Description                                     | Tenancy |
| -------------------------------------------------------- | ----------------------------------------------- | ------- |
| [user-create](commands/user-create.md)                   | Create a user                                   | Both    |
| [user-get](commands/user-get.md)                         | Get a user by email address                     | Both    |
| [user-remove](commands/user-remove.md)                   | Remove a user and their identity profile        | Both    |
| [user-update](commands/user-update.md)                   | Update a user                                   | Both    |
| [user-update-password](commands/user-update-password.md) | Update the password of a user                   | Both    |
| [org-users-list](commands/org-users-list.md)             | List all users belonging to an organization DID | Both    |

The user commands take `--tenant-id` in multi-tenant mode and reject it in single-tenant mode.

## Server Configuration

Key environment variables that control how the node server handles authentication. A full reference is in the `.env` example files.

| Variable                   | Default        | Description                                    |
| -------------------------- | -------------- | ---------------------------------------------- |
| `TWIN_AUTH_API_KEY_HEADER` | `x-api-key`    | HTTP header name for the API key on requests.  |
| `TWIN_AUTH_SIGNING_KEY_ID` | `auth-signing` | Vault key ID used to sign authentication JWTs. |

## Bootstrap step-by-step

### Single command

Runs the complete bootstrap sequence in one step using values from `.env.bootstrap-dev`, see [bootstrap-dev](commands/bootstrap-dev.md) for the variables it reads:

```shell
3sixty-node bootstrap-dev --load-env=".env.bootstrap-dev"
```

The sections below show the equivalent step-by-step commands that replicate the bootstrap-dev process.

---

### Step 1 - Create the node identity and associate it with the node

Supply `--fund-wallet=true` when the `wallet` feature is enabled. `--node-id=true` sets the created identity as the node identity in the same step.

```shell
3sixty-node identity-create --node-id=true --fund-wallet=true --output-json="node-identity.json" --output-env="node-identity.env" --output-env-prefix=node
```

### Step 2 - Create the authentication signing key for the node

```shell
3sixty-node vault-key-create --load-env="node-identity.env" --identity=!NODE_DID --key-type=Ed25519 --key-id=!TWIN_AUTH_SIGNING_KEY_ID --overwrite-mode=skip --output-json="node-auth-key.json" --output-env="node-auth-key.env"
```

To import an existing authentication signing key instead:

```shell
3sixty-node vault-key-import --load-env="node-identity.env,node-auth-key.json" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

### Step 3 - Create the organisation identity

```shell
3sixty-node identity-create --load-env="node-identity.env" --fund-wallet=true --output-json="organization-identity.json" --output-env="organization-identity.env" --output-env-prefix=organization
```

### Step 4 - Add the trust verification method to the organisation identity

```shell
3sixty-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-trust.json" --output-env="organization-trust.env"
```

### Step 5 - Set the organisation identity on the node (single-tenant)

```shell
3sixty-node node-org-id-set --load-env="organization-identity.env" --organization-id=!ORGANIZATION_DID
```

### Step 6 - Create the node tenant and associate the organisation (multi-tenant only)

```shell
3sixty-node tenant-create --load-env="organization-identity.env" --organization-id=!ORGANIZATION_DID --label="Node" --output-json="node-tenant.json" --output-env="node-tenant.env" --output-env-prefix=node
```

```shell
3sixty-node tenant-org-id-set --load-env="node-tenant.env,organization-identity.env" --tenant-id=!NODE_TENANT_ID --organization-id=!ORGANIZATION_DID
```

To import an existing tenant instead:

```shell
3sixty-node tenant-import --load-env="node-tenant.env,organization-identity.env" --tenant-id=!NODE_TENANT_ID --api-key=!NODE_API_KEY --organization-id=!ORGANIZATION_DID --label=!NODE_LABEL --public-origin="https://api.example.com"
```

To update an existing tenant:

```shell
3sixty-node tenant-update --load-env="node-tenant.json" --tenant-id=!NODE_TENANT_ID --label="New Label"
```

To remove a stale organisation alias from a tenant:

```shell
3sixty-node tenant-org-alias-remove --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --alias=!OLD_ORGANIZATION_DID
```

---

The following steps run when the `admin-user` feature is enabled.

### Step 7 - Add the blob encryption key to the organisation (if blob encryption is enabled)

```shell
3sixty-node vault-key-create --load-env="organization-identity.env" --identity=!ORGANIZATION_DID --key-type=ChaCha20Poly1305 --key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID --overwrite-mode=skip --output-json="organization-blob-encryption.json" --output-env="organization-blob-encryption.env"
```

### Step 8 - Add the attestation verification method to the organisation (if attestation is enabled)

```shell
3sixty-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-attestation.json" --output-env="organization-attestation.env"
```

To import an existing attestation verification method:

```shell
3sixty-node identity-verification-method-import --load-env="node-identity.env,organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!DID_VERIFICATION_METHOD_ID --private-key-hex=!DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX
```

To create a verifiable credential using the attestation verification method:

```shell
3sixty-node identity-verifiable-credential-create --load-env="organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --subject-json="subject.json" --output-json="organization-attestation-credential.json" --output-env="organization-attestation-credential.env"
```

### Step 9 - Add the immutable proof verification method to the organisation (if immutable proofs are enabled)

```shell
3sixty-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-immutable-proof.json" --output-env="organization-immutable-proof.env"
```

### Step 10 - Create the admin user identity

```shell
3sixty-node identity-create --load-env="organization-identity.env" --controller=!ORGANIZATION_DID --output-json="admin-user-identity.json" --output-env="admin-user-identity.env" --output-env-prefix=admin_user
```

### Step 11 - Create the admin user account

In single-tenant mode omit `--tenant-id` and `node-tenant.env`.

```shell
3sixty-node user-create --load-env="organization-identity.env,admin-user-identity.env,node-tenant.env" --user-identity=!ADMIN_USER_DID --organization-identity=!ORGANIZATION_DID --tenant-id=!NODE_TENANT_ID --email="admin@node" --given-name="Node" --family-name="Admin" --scope="tenant-admin,user-admin" --output-json="user-account-admin.json" --output-env="user-account-admin.env" --output-env-prefix=admin
```

To update an existing user:

```shell
3sixty-node user-update --load-env="organization-identity.env,admin-user-identity.env,node-tenant.env" --tenant-id=!NODE_TENANT_ID --email="admin@node" --scope="tenant-admin,user-admin,foo"
```
