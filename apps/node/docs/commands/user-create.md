# user-create

Create a user.

## Tenancy

Available in single-tenant and multi-tenant mode. In multi-tenant mode `--tenant-id` is required, in single-tenant mode it must not be supplied.

## Usage

```text
user-create: Create a user

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

user-identity: (string, DID, required)
The DID to associate the user with.

organization-identity: (string, DID, required)
The organization DID to associate the user with.

tenant-id: (string, hex(32), optional)
The tenant ID to associate the user with (multi-tenant mode only).

email: (string, email, required)
The email address of the user.

password: (string, optional)
The password for the user.

scope: (string, optional)
List of scopes to associate with the user, comma separated.

given-name: (string, optional)
The given name of the user.

family-name: (string, optional)
The family name of the user.

overwrite-mode: (string, default: 'skip', optional, options: [skip, overwrite, error])
The mode to use when a user with the same identity already exists.

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Path to a .json file to store the command output.

output-env: (string, optional)
Path to a .env file to store the command output.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

Example: user-create --user-identity="did:iota:...." --organization-identity="did:iota:...." --email="bob@examples.com" --password="pass1234" --scope="tenant-admin" --givenName="Bob" --familyName="Smith"
```

## Examples

Create a user in single-tenant mode:

```shell
3sixty-node user-create --load-env="organization-identity.env,admin-user-identity.env" --user-identity=!ADMIN_USER_DID --organization-identity=!ORGANIZATION_DID --email="admin@node" --given-name="Node" --family-name="Admin" --scope="user-admin" --output-json="user-account-admin.json" --output-env="user-account-admin.env" --output-env-prefix=admin
```

Create a user in multi-tenant mode:

```shell
3sixty-node user-create --load-env="organization-identity.env,admin-user-identity.env,node-tenant.env" --user-identity=!ADMIN_USER_DID --organization-identity=!ORGANIZATION_DID --tenant-id=!NODE_TENANT_ID --email="admin@tenant" --scope="tenant-admin,user-admin" --output-json="user-account-admin.json"
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
