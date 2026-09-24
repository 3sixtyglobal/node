# identity-resolve

Resolve an identity DID to its full document.

## Tenancy

Available in single-tenant and multi-tenant mode, with the same behaviour in both.

## Usage

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

## Examples

Resolve any DID to its full document, pass `--output-json` to save the document to a file:

```shell
twin-node identity-resolve --identity="did:iota:..."
twin-node identity-resolve --identity="did:iota:..." --output-json="did-document.json"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
