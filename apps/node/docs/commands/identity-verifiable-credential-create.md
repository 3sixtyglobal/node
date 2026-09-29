# identity-verifiable-credential-create

Create a verifiable credential.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

```text
identity-verifiable-credential-create: Create a verifiable credential

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

identity: (string, did, required)
The DID of the identity to use to create the credential.

controller: (string, did, optional)
The controller DID for the identity. If not provided, the identity will be its own controller.

verification-method-id: (string, did with fragment, required)
The ID of the verification method to use to create the credential.

subject-json: (string, file, required)
The subject JSON file to load.

credential-id: (string, url, optional)
The id of the verifiable credential.

expiration-date: (string, ISO date-time, optional)
The expiration date of the verifiable credential.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the command output.

output-env: (string, optional)
Path to a .env file to store the command output.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

Example: identity-verifiable-credential-create --identity="did:iota:...." --verification-method-id="my-id" --subject-json="./subject.json"
```

## Examples

Create a verifiable credential using the attestation verification method:

```shell
twin-node identity-verifiable-credential-create --load-env="organization-identity.env,organization-attestation.env" --identity=!ORGANIZATION_DID --verification-method-id=!TWIN_ATTESTATION_VERIFICATION_METHOD_ID --subject-json="subject.json" --output-json="organization-attestation-credential.json" --output-env="organization-attestation-credential.env"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
