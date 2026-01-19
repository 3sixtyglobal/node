# Examples

## CLI Usage

To run the command from the package either:

Install `@twin.org/node@next` and use the following command:

```shell
twin-node --help
```

or

```shell
npx "@twin.org/node@next" --help
```

### Display help listing all commands

```shell
twin-node --help
```

### Display help for specific command

```shell
twin-node command --help
```

### Bootstrap legacy mode **will be deprecated in future versions**

```shell
twin-node bootstrap-legacy --load-env=".env.bootstrap-legacy"
```

### Create the identity for the node

```shell
twin-node identity-create --fund-wallet=true --output-json="node-identity.json" --output-env="node-identity.env" --output-env-prefix=node
```

Alternatively import existing details:

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

Alternatively import existing details:

```shell
twin-node vault-key-import --load-env="node-identity.env,node-auth-key.json" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

### Add a key associated with the node identity for use by the synchronised storage blob encryption

```shell
twin-node vault-key-create --load-env="node-identity.env" --identity=!NODE_DID --key-id=!TWIN_SYNCHRONISED_STORAGE_BLOB_STORAGE_ENCRYPTION_KEY_ID --key-type=ChaCha20Poly1305 --output-json="node-synchronised-storage-encryption-key.json" --output-env="node-synchronised-storage-encryption-key.env"
```

### Import an existing key associated with the node identity for use in authentication signing

```shell
twin-node vault-key-import --load-env="node-identity.env,my-key.json" --identity=!NODE_DID --key-id=!TWIN_AUTH_SIGNING_KEY_ID --key-type=!KEY_TYPE --private-key-hex=!PRIVATE_KEY_HEX
```

Alternatively import existing details:

```shell
twin-node tenant-create --output-json="node-tenant.json" --output-env="node-tenant.env" --label="node" --output-env-prefix=node
```

### Import a tenant to be used by the node

```shell
twin-node tenant-import --load-env="node-tenant.json" --tenant-id=!NODE_TENANT_ID --api-key=!NODE_API_KEY --label=!NODE_LABEL
```

### Associated the tenant with the node

```shell
twin-node node-set-tenant --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID
```

### Create an organization identity

```shell
twin-node identity-create --load-env="node-identity.env" --fund-wallet=true --output-json="organization-identity.json" --output-env="organization-identity.env"  --output-env-prefix=organization
```

### Add a verification method to the organization identity for attestation

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --output-json="organization-attestation.json" --output-env="organization-attestation.env"
```

Alternatively import existing details:

```shell
twin-node identity-verification-method-import --load-env="node-identity.env,organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!DID_VERIFICATION_METHOD_ID --private-key-hex=!DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX
```

### Create a verifiable credential based on the organisation attestation verification method

```shell
twin-node identity-verifiable-credential-create --load-env="organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --subject-json="subject.json" --output-json="organization-attestation-credential.json" --output-env="organization-attestation-credential.env"
```

### Add a verification method to the organization identity for immutable proofs

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID --output-json="organization-immutable-proof.json" --output-env="organization-immutable-proof.env"
```

### Add a verification method to the organization identity for trust verification

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --controller=!NODE_DID --verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID --output-json="organization-trust.json" --output-env="organization-trust.env"
```

### Add a key associated with the organization to be used for blob encryption

```shell
twin-node vault-key-create --load-env="organization-identity.env" --identity=!ORGANIZATION_DID --key-id=!TWIN_BLOB_STORAGE_ENCRYPTION_KEY_ID --key-type=ChaCha20Poly1305 --output-json="organization-blob-encryption.json" --output-env="organization-blob-encryption.env"
```

### Create a user identity associated with the organization

```shell
twin-node identity-create --load-env="organization-identity.env" --controller=!ORGANIZATION_DID --output-json="user-identity.json" --output-env="user-identity.env" --output-env-prefix=user
```

### Create a user login associated with the user identity

```shell
twin-node user-create --load-env="organization-identity.env,user-identity.env,node-tenant.env" --user-identity=!USER_DID --organization-identity=!ORGANIZATION_DID --tenant-id=!NODE_TENANT_ID --email="admin@node" --output-json="user-account-admin.json" --output-env="user-account-admin.env" --output-env-prefix=admin
```
