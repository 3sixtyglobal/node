# Kenya Community Node Docker (Same-Node Multi-Tenant DSP + PNP)

End-to-end test scaffold for the Kenya Community Node use case. Validates the encrypted `tenantToken` mechanism — and the full DSP/PNP/data-plane chain on top of it — on a **single node with two tenants**.

## Status (as of 2026-04-29)

**Phases 0-7: all green ✅** — full PNP negotiation + DSP transfer + tenant-scoped data pull. Every TICKET in the A-G arc is empirically verified, plus two latent platform bugs (BaseRestClient query-string preservation + `getDatasetTargets` for multi-target dataset extraction) shaken out and fixed during this scaffold's development.

Phase 8 (negative-path tenant isolation) is intentionally not yet automated — to be added once we have a stable green baseline to assert against.

## Scenario (2-tenant minimum viable cut)

```text
twin-kenya-node (one container, one process, one DB)
  +--- KRA Tenant (apiKey-KRA, partition = kra-tenant-id)
  |      admin@kra → seeds consignment dataset + ODRL offer (jsonpath constraint)
  |
  +--- Trader Tenant (apiKey-Trader, partition = trader-tenant-id)
         admin@trader → discovers via catalogue, negotiates via PNP, pulls via DSP
```

Full Kenya scenario has 5 tenants (KRA, KPA, KENTRADE, AFA, Trader). This scaffold runs the 2-tenant minimum (KRA + Trader) — sufficient to validate the same-node multi-tenant DSP path. Additional tenants are publish-side (each becomes a producer on its own dataset under the distributed model — see `same-node-multi-tenancy-analysis.md`).

## Quick start

```bash
cd node/apps/node/tests/kenyaCommunityNodeDocker

# 1. Build image, bootstrap node, create KRA + Trader tenants + per-tenant admins
./setup.sh

# 2. Start node
docker compose up -d

# 3. Seed KRA's dataset + ODRL offer, capture trust JWTs and session tokens
./provision-storage.sh

# 4. Run the full test (Phases 0-7)
./kenya-test.sh

# 5. Tear down
docker compose down -v
```

`setup.sh` writes:

- `.node-password` — node admin password generated during bootstrap
- `.tenants` — `TENANT_KRA_*` and `TENANT_TRADER_*` ids/keys
- `.tenant-users` — per-tenant admin email + password

`provision-storage.sh` writes:

- `.session-tokens` — KRA + Trader session JWTs
- `.trust-tokens` — KRA + Trader JWT-VC trust tokens + DIDs + encrypted tenantTokens
- `.seeded-offer` — `KRA_OFFER_ID`, `KRA_DATASET_ID`

All git-ignored. To wipe state: `./setup.sh --clean`.

## Test phases

| Phase | Description                                                                    | Status                                                                  |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 0     | Health (TenantProcessor gate) + per-tenant logins                              | ✅ Implemented                                                          |
| 1     | Trader queries federated catalogue (cross-tenant `[Node]` discovery)           | ✅ Implemented                                                          |
| 2     | KRA's offer presence (seeded by `provision-storage.sh`)                        | ✅ Implemented                                                          |
| 3     | Trader sees KRA's dataset + encrypted `twin:tenantToken` (TICKET-G)            | ✅ Implemented                                                          |
| 4     | Trader initiates PNP negotiation against KRA's offer                           | ✅ Implemented                                                          |
| 5     | Negotiation reaches FINALIZED (REQUESTED → AGREED → FINALIZED)                 | ✅ Implemented                                                          |
| 6     | Trader requestTransfer against the agreement                                   | ✅ Implemented                                                          |
| 7     | Trader startTransfer + encrypted `dataAddress.endpoint` (TICKET-D) + data pull | ✅ Implemented                                                          |
| 8     | Negative-path tenant isolation                                                 | ⏳ Intentionally not yet automated (awaiting stable Phase 0-7 baseline) |

Per-phase outcomes and run history are recorded in the master findings doc at [`../multiTenancyDocker/findings-from-first-run.md`](../multiTenancyDocker/findings-from-first-run.md) under "Kenya empirical findings".

## What this scaffold validates

- **TICKET-A** — trust auto-enable when rights-management/synchronised-storage/dataspace is enabled
- **TICKET-B/C/E** — vault key bootstrap + per-tenant trust JWT generation
- **TICKET-D** — encrypted `dataAddress.endpoint` round-trip (the data plane URL contains the consumer's encrypted `tenantToken`)
- **TICKET-G** — federated catalogue publishes encrypted `twin:tenantToken` on each dataset (verified at 80 chars)
- **TICKET-G+1** — `TenantProcessor` decode-only path on `skipTenant: true` cross-node routes
- **`getDatasetTargets` Q1 fix** — DSP `extractDatasetId` walks only top-level `policy.target`, ignoring rule-level constraint refinements
- **Engine-driven `TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH`** — single source of truth for PNP service callback path AND rest-client `pathPrefix`

## Port mapping

| Service | Internal | Host | Container         |
| ------- | -------- | ---- | ----------------- |
| Node    | 3000     | 3040 | `twin-kenya-node` |

Distinct from `multiTenancyDocker` (3030) and `mobiusSupplyChainDocker` (3020-3023) so all three can coexist on the same machine.

## Prerequisites

- Docker + docker compose v2
- All workspace submodule dists green (`npm run dist` in api / dataspace / rights-management / federated-catalogue / engine / node)
- Local-link chain established (api-tenant-processor + the multi-tenant engine + dataspace + rights-management + federated-catalogue packages); see TICKET-D close-out notes for the full link list
- `jq` installed
- IOTA testnet reachable (for node DID bootstrap)

## What this scaffold does NOT cover

- **Cross-tenant write operations** — under the distributed model (each producer publishes its own dataset), there is no cross-tenant write path; consumers aggregate client-side. Validated as the right pattern by the supply-chain `feat/consignment-sharing` PR. Not a gap.
- **NGINX subdomain routing** — DevOps wiring, separate from platform validation. The scaffold uses `x-api-key` header injection directly.
- **Phase 8 negative-path isolation** — see the status table above.
