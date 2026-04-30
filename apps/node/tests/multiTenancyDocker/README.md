# Multi-Tenancy Docker Test (Single Node, Multiple Tenants)

Proves tenant isolation on a **single TWIN node**. One container, two tenants sharing the same process and database, different `x-api-key` per tenant. Data written by tenant A must be invisible to tenant B, and vice versa, across multiple subsystems (attestation, NFT, identity profile, ODRL policy).

This is the counterpart to [mobiusSupplyChainDocker](../mobiusSupplyChainDocker/README.md) (multi-node federation) and [kenyaCommunityNodeDocker](../kenyaCommunityNodeDocker/README.md) (same-node multi-tenant DSP). Here the interesting boundary is _inside_ one node, not between nodes, and the focus is the isolation guarantee itself rather than the DSP transfer flow on top of it.

## Scenario

```text
twin-mt-node (one container, one process, one DB)
  +--- Tenant A (apiKey-A, partitionId = tenant-A-id)
  |      user-a@tenant-a    → creates attestation P, NFT P', identity profile, ODRL policy
  |
  +--- Tenant B (apiKey-B, partitionId = tenant-B-id)
         user-b@tenant-b    → creates attestation Q, NFT Q', identity profile, ODRL policy

Assertions across each subsystem:
  GET with x-api-key=A + jwt-A    → sees A's records,   not B's
  GET with x-api-key=B + jwt-B    → sees B's records,   not A's
  GET with x-api-key=A + jwt-B    → 401 tenantIdMismatch (cross-tenant JWT reuse)
  GET without x-api-key           → 401 (TenantProcessor)
```

## What this test validates

- `TenantProcessor` extracts `x-api-key` and sets `contextIds[Tenant]` ([tenantProcessor.ts:75-114](../../../../../api/packages/api-tenant-processor/src/tenantProcessor.ts#L75-L114)).
- `AuthHeaderProcessor` enforces `jwt.tid === contextIds[Tenant]` ([authHeaderProcessor.ts:99-135](../../../../../api/packages/api-auth-entity-storage-service/src/processors/authHeaderProcessor.ts#L99-L135)).
- Entity-storage connectors auto-partition by `contextIds[Tenant]` (memory, file, DynamoDB).
- `tenant-create` CLI provisions tenants at runtime ([tenantCreate.ts](../../../../../node/packages/node-core/src/commands/tenantCreate.ts)).
- Subsystem-by-subsystem isolation: attestation → NFT → identity profile → ODRL policy.
- On-disk partition keys differ between tenants (verified by direct file inspection).

## What this test does NOT cover

- NGINX reverse-proxy injection (we curl the `x-api-key` header directly).
- Subdomain routing.
- DSP/PNP cross-tenant negotiation flow (see [kenyaCommunityNodeDocker](../kenyaCommunityNodeDocker/README.md)).
- Cross-node federation (see [mobiusSupplyChainDocker](../mobiusSupplyChainDocker/README.md)).

## Port mapping

| Service | Internal | Host | Container      |
| ------- | -------- | ---- | -------------- |
| Node    | 3000     | 3030 | `twin-mt-node` |

Distinct from `kenyaCommunityNodeDocker` (3040) and `mobiusSupplyChainDocker` (3020-3023) so all three can coexist on the same machine.

## Prerequisites

- Docker + docker compose v2
- `npm run submodule:dist-no-test` from workspace root
- `jq` installed
- IOTA testnet reachable (for node DID bootstrap)

## Quick start

```bash
cd node/apps/node/tests/multiTenancyDocker

# 1. Build image, bootstrap node, create two tenants + per-tenant users
./setup.sh

# 2. Start node
docker compose up -d

# 3. Run isolation test (Phases 0-20)
./mt-test.sh

# 4. Tear down
docker compose down -v
```

`setup.sh` writes:

- `.node-password` — node admin password generated during bootstrap
- `.tenants` — `TENANT_A_*` and `TENANT_B_*` ids/keys emitted by `tenant-create`
- `.tenant-users` — per-tenant admin email + password

All files are git-ignored. To wipe state: `./setup.sh --clean`.

> **Known gotcha:** if `setup.sh` writes the node-admin password unquoted and your random password contains shell-special characters (e.g. `!`, `$`, `\``), `source .node-password` in `mt-test.sh` will fail at Phase 1 login. The `kenyaCommunityNodeDocker/setup.sh` already applies a `printf '%q'` shell-escape; if you hit this, mirror that one-line patch into `multiTenancyDocker/setup.sh`.

## Test phases

| Phase | Subsystem        | Description                                                          |
| ----- | ---------------- | -------------------------------------------------------------------- |
| 0     | Health           | `/health` is tenant-gated by design (TenantProcessor)                |
| 1     | Auth             | Tenant-scoped logins for both tenants' users                         |
| 2     | Attestation      | Tenant A creates an attestation                                      |
| 3     | Attestation      | Tenant B creates an attestation                                      |
| 4     | Attestation      | Tenant A reads its own (200), cannot see B's                         |
| 5     | Attestation      | Tenant B reads its own (200), cannot see A's                         |
| 6     | Auth (negative)  | Cross-tenant JWT reuse must fail with `tenantIdMismatch`             |
| 7     | Auth (negative)  | Missing `x-api-key` must fail at TenantProcessor                     |
| 8     | Storage          | On-disk partition inspection — attestation/NFT records carry distinct partitionIds |
| 9     | NFT              | Tenant A mints an NFT directly (POST /nft/)                          |
| 10    | NFT              | Tenant B mints an NFT directly (POST /nft/)                          |
| 11    | NFT              | NFT cross-tenant isolation — each tenant resolves only its own NFT   |
| 12    | Identity profile | Tenant A writes its identity profile                                 |
| 13    | Identity profile | Tenant B writes its identity profile                                 |
| 14    | Identity profile | Identity-profile cross-tenant isolation                              |
| 15    | Storage          | On-disk identity-profile partition inspection                        |
| 16    | ODRL policy      | Tenant A creates an ODRL policy (POST /rights-management/policy/admin) |
| 17    | ODRL policy     | Tenant B creates an ODRL policy                                      |
| 18    | ODRL policy     | PAP cross-tenant isolation — each tenant reads only its own policy   |
| 19    | ODRL policy     | PAP list endpoint isolation — the only bulk-leak vector              |
| 20    | Storage          | On-disk odrl-policy partition inspection                             |

See [TEST-PLAN.md](TEST-PLAN.md) for open questions and known gaps to validate during first run, and [findings-from-first-run.md](findings-from-first-run.md) for run history (also the consolidated home for Kenya scaffold findings).
