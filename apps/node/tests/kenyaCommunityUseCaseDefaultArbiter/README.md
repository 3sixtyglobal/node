# Kenya Community Use Case — Default Arbiter

A copy of `kenyaCommunityUseCaseDocker` configured with the **default** policy arbiter

- enforcement processor (the pass-through scaffold uses no-op stamps). Its purpose is
  to prove the inbox PEP gate (ticket #124) under a **real** arbiter, in the same-node
  multi-tenant topology the Kenya use case actually uses.

## What differs from the base scaffold

|                                 | base (`kenyaCommunityUseCaseDocker`)  | this folder                     |
| ------------------------------- | ------------------------------------- | ------------------------------- |
| arbiter / enforcement processor | `pass-through`                        | **`default`**                   |
| host port                       | 3041                                  | **3042**                        |
| container / volume / network    | `twin-kenya-usecase-*`                | `twin-kenya-defaultarb-*`       |
| Phase 8                         | accept-only (pass-through grants all) | **read GRANTED + write DENIED** |

Negotiator/requester stay `pass-through` (so read agreements are created), exactly
matching `mobiusSupplyChainDocker`'s proven default-arbiter config.

## What it proves (#124)

Inbox deliveries hit `notifyActivity` → `enforceInboxPolicy`, and the **DefaultPolicyArbiter**
decides per action + constraint against the transfer's agreement:

- **8a** provider **read** delivery, read agreement → `action=read` matches → **GRANTED (202)**.
- **8b** consumer **write**, read-only agreement → `action=write`, no write permission → **DENIED (401)**.
- **9** read agreement with a constraint (`destinationCountry eq KE`): KE payload → **GRANTED (202)**, non-KE payload → **DENIED (401)** — constraint-based filtering.
- **10** consumer **write**, **write** agreement → `action=write` matches → **GRANTED (202)**.

8b + 10 are the two halves of the ticket's req 3 ("a read holder is rejected; a write
holder succeeds"); 9 is Martyn's country-constraint example. The pass-through scaffold
can only show accepts — only a real arbiter produces the denials.

## Post-#203 (organization identifiers)

Migrated 2026-06-11 for the org-identifiers refactor (twin-node#19 / PR #203) — see
[`findings-from-second-run.md`](findings-from-second-run.md). Highlights: tenants are
created with `--organization-id=<did>` (their minted DID), all non-login routes are
tenant-routed via `?organization=<org-did>` (encrypted tenant tokens are gone), the
catalogue bakes the publisher org DID into distributions, trust tokens are
identity-only, and the Docker image consumes only the published npm packages.

## Run

```bash
./setup.sh --clean        # bootstrap node + 5 tenants (IOTA testnet, pre-funded mnemonics)
docker compose up -d
./provision-storage.sh    # seed the 4 publisher offers/datasets
./kenya-usecase-test.sh   # Phases 1-7 (discover/negotiate/pull/aggregate) + Phases 8-10 (gate deny/accept)
```
