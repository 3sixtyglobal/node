# Multi-Tenancy Test Plan — Open Questions

This test is a **scaffold**. The phases are correct in intent, but two pieces need validation on first run. Both are about the interaction between bootstrap-created identities and per-tenant user tables.

## Open question 1 — Where does the bootstrap admin live?

`TWIN_FEATURES="node-identity,node-wallet,node-admin-user"` creates an `admin@node` user at bootstrap. This user is written **before** any non-node tenant exists, so it is stored in the _node tenant_ partition (`isNodeTenant: true`).

Implications:

- Logging in as `admin@node` with `x-api-key=<node-tenant-key>` works.
- Logging in as `admin@node` with `x-api-key=<tenant-A-key>` **should fail** — that user does not exist in tenant A's partition.

**What we need to confirm:** is the bootstrap admin key exposed anywhere, or does `node-admin-user` generate a password but no API key, meaning you can only reach the node tenant via the default `TWIN_API_KEY` env var (if any)?

Search paths:

- `node/packages/node-core/src/bootstrap/` — how `node-admin-user` is created
- `api/packages/api-tenant-processor/src/` — whether a default node-tenant API key is auto-generated

## Open question 2 — How do we create a user _inside_ a tenant?

To prove isolation we need a user per tenant. Options:

**Option A — Admin-scoped user creation**
The bootstrap admin has admin scopes. If there's an endpoint like `POST /authentication/user` that creates a user in the _current tenant context_ (derived from `x-api-key`), then:

```
# Create user in tenant A
curl -X POST {host}/authentication/user \
  -H "x-api-key: ${TENANT_A_API_KEY}" \
  -H "Authorization: Bearer ${NODE_ADMIN_JWT}" \
  -d '{"email": "user-a@tenant-a", "password": "..."}'
```

But this requires the node-admin JWT to be accepted when the tenant context is `A` — which contradicts the `tid`-match rule in `AuthHeaderProcessor:122`. So this likely fails.

**Option B — Direct entity-storage seed via CLI**
Add a CLI step in `setup.sh` that writes an admin user straight into the tenant's partition by invoking a command that sets the tenant context first. Requires confirming a CLI command exists (e.g., `user-create --tenant-id ...`).

**Option C — Per-tenant bootstrap**
Run a second bootstrap pass _with_ the tenant's API key set, so the admin user is written into the tenant's partition. Needs the bootstrap flow to read `x-api-key`-equivalent from env.

### Proposed resolution for this scaffold

Start with Option A. If Phase 2 fails, switch to Option B or C based on what the CLI actually exposes. `mt-test.sh` has the Phase 2 code path that you edit once the correct mechanism is known.

## Partition wiring

`TWIN_TENANT_ENABLED=true` in `env/node.env` enables the processor, but the entity-storage connectors must also be configured with `partitionContextIds: [Node, Tenant]` for the partition to actually split. The playground-node reference ([playground/apps/playground-node/src/index.ts:32-35](../../../../../playground/apps/playground-node/src/index.ts#L32-L35)) shows the pattern. If the default node (`node/apps/node/src/index.ts`) only registers `[Node]`, we need to either:

1. Adjust the default node builder to add `Tenant` when `TWIN_TENANT_ENABLED=true`, **or**
2. Introduce a test-specific node entry point under this folder that does the playground-style wiring.

If (1) is already implemented, this test should pass without code changes. If not, this is the minimal code change needed to make multi-tenancy demonstrable.

## Success criteria

The test passes if all nine phases succeed, which collectively prove:

1. Two tenants can be provisioned at runtime on one node.
2. Writes are partitioned by tenant.
3. Reads are scoped to the caller's tenant.
4. Cross-tenant JWT reuse is rejected.
5. Missing `x-api-key` is rejected.

A failure at Phase 4–7 means partition wiring is missing or incorrect. A failure at Phase 2 means user-in-tenant provisioning needs a different mechanism.
