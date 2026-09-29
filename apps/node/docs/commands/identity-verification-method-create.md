# identity-verification-method-create

Create an identity verification method.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
identity-verification-method-create: Create an identity verification method

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID of the identity to add the verification method to.

controller: (string, did, optional)
The controller DID for the identity. If not provided, the identity will be its own controller.

verification-method-type: (string, default: 'assertionMethod', optional, options: [verificationMethod, authentication, assertionMethod, keyAgreement, capabilityInvocation, capabilityDelegation])
The type of verification method to add.

verification-method-id: (string, optional)
The ID of the verification method to add.

overwrite-mode: (string, default: 'skip', optional, options: [skip, overwrite, error])
The mode to use when a verification method with the same ID already exists.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the command output.

output-env: (string, optional)
Path to a .env file to store the command output.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

Example: identity-verification-method-create --identity="did:iota:...." --verification-method-type="verificationMethod" --verification-method-id="my-key-1" --controller="did:iota:...."
```

## Examples

Add the trust verification method to the organisation identity:

```shell
twin-node identity-verification-method-create --load-env="node-identity.env,organization-identity.env" --identity=!ORGANIZATION_DID --verification-method-type=assertionMethod --verification-method-id=!TWIN_TRUST_VERIFICATION_METHOD_ID --overwrite-mode=skip --output-json="organization-trust.json" --output-env="organization-trust.env"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
