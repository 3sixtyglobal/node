# user-update-password

Update the password of a user.

## Tenancy

Available in single-tenant and multi-tenant mode. In multi-tenant mode `--tenant-id` is required, in single-tenant mode it must not be supplied. The new password must satisfy the password policy of the authentication service.

## Usage

```text
user-update-password: Update the password of a user

env-prefix: (string, optional)
Prefix to use for standard .env files e.g. TWIN_.

email: (string, email, required)
The email address of the user to update.

password: (string, optional)
The new password. If not provided a random password will be generated.

current-password: (string, optional)
The current password, verified before the change when provided.

tenant-id: (string, hex(32), optional)
The tenant ID the user belongs to (multi-tenant mode only).

load-env: (string, optional)
Comma separated list of paths to .env files to read input parameters from.

output-json: (string, optional)
Output the details of the password update to a JSON file.

output-env: (string, optional)
Output the details of the password update to an .env file.

output-env-prefix: (string, optional)
Prefix to use for variables in the output .env file.

Example: user-update-password --email="user@example.com" --tenant-id="0011..aabb" --output-env="user-password.env"
```

## Examples

Generate a new password for a user and store it in an .env file:

```shell
3sixty-node user-update-password --email="bob@example.com" --output-env="bob-password.env"
```

Set a specific password in multi-tenant mode, verifying the current password first:

```shell
3sixty-node user-update-password --load-env="node-tenant.env" --tenant-id=!NODE_TENANT_ID --email="bob@example.com" --current-password="..." --password="..."
```

See the [usage guide](../usage.md) for running the node and the full list of commands.
