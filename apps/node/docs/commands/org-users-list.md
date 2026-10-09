# org-users-list

List all users belonging to an organization DID.

## Tenancy

Available in single-tenant and multi-tenant mode. In single-tenant mode `--org-did` defaults to the node organisation ID, in multi-tenant mode it is required.

## Usage

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

## Examples

In single-tenant mode list the users of the node organisation:

```shell
3sixty-node org-users-list
```

List the users of a specific organisation:

```shell
3sixty-node org-users-list --load-env="organization-identity.env" --org-did=!ORGANIZATION_DID
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
