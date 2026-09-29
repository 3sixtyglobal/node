# identity-verification-method-import

Import an identity verification method.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
identity-verification-method-import: Import an identity verification method

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID of the identity to import the verification method to.

controller: (string, did, optional)
The controller DID for the identity. If not provided, the identity will be its own controller.

verification-method-type: (string, default: 'assertionMethod', required, options: [verificationMethod, authentication, assertionMethod, keyAgreement, capabilityInvocation, capabilityDelegation])
The type of verification method to import.

verification-method-id: (string, required)
The ID of the verification method to import.

private-key-hex: (string, required)
The private key in hex format.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Example: identity-verification-method-import --identity="did:iota:...." --verification-method-type="verificationMethod" --verification-method-id="my-key-1" ----private-key-hex="15...a2"
```

## Examples

Import an existing attestation verification method key:

```shell
twin-node identity-verification-method-import --load-env="node-identity.env,organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!DID_VERIFICATION_METHOD_ID --private-key-hex=!DID_VERIFICATION_METHOD_PRIVATE_KEY_HEX
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
