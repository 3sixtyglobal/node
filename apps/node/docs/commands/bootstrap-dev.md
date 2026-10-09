# bootstrap-dev

Bootstrap the development environment.

## Tenancy

Available in single-tenant and multi-tenant mode. In single-tenant mode the organisation identity is stored as the node organisation ID, in multi-tenant mode a node tenant is created and associated with the organisation identity. Re-running the command reuses anything that already exists.

## Usage

```text
bootstrap-dev: Bootstrap the development environment

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

Deprecated aliases: bootstrap-legacy

Example: bootstrap-dev --load-env="./.env.bootstrap-dev"
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

## Examples

Run the complete bootstrap sequence using values from `.env.bootstrap-dev`:

```shell
3sixty-node bootstrap-dev --load-env=".env.bootstrap-dev"
```

The step-by-step equivalent is shown in the [usage guide](../usage.md#bootstrap-step-by-step).

See the [usage guide](../usage.md) for running the node and the full list of commands.
