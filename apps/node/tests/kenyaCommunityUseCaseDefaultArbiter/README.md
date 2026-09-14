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

## Testing a published image

By default the image is built from this checkout's `node_modules`. To run the scaffold
against a published `twinfoundation/twin-node` image instead (first used to verify the
0.9.3 hotfix, twin-dataspace #362), vendor the test-app extension the scaffold needs and
select `Dockerfile.image`:

```bash
mkdir -p vendor && cd vendor \
  && npm pack @twin.org/dataspace-test-app@0.9.3 --silent && tar -xzf *.tgz \
  && mv package dataspace-test-app && rm -f *.tgz && cd ..
export KENYA_DOCKERFILE=apps/node/tests/kenyaCommunityUseCaseDefaultArbiter/Dockerfile.image
export TWIN_NODE_IMAGE=twinfoundation/twin-node:0.9.4   # any published tag
./setup.sh --clean && docker compose up -d && ./provision-storage.sh && ./kenya-usecase-test.sh
```

`scripts/dsp-client.mjs` runs on the host and needs `@twin.org/dataspace-control-plane-rest-client`
resolvable from this directory (the repo's `node_modules` on a normal checkout).

## MySQL-backed run (the connector RC/Production use)

`docker-compose.mysql.yml` swaps the node's entity storage from `file` to `mysql` (a `mysql:8.4`
service with a healthcheck, fresh volume per `./setup.sh --clean`). Opt in with two variables
before any `docker compose` / script call; everything else runs unchanged, and
`provision-storage.sh` reads its tenant-attribution proof from the DB when no file store exists:

```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.mysql.yml
export KENYA_START_SERVICES=twin-kenya-mysql   # setup.sh starts the DB before the CLI bootstrap
./setup.sh --clean && docker compose up -d && ./provision-storage.sh && ./kenya-usecase-test.sh && ./option3-test.sh
```

Combine with `KENYA_DOCKERFILE`/`TWIN_NODE_IMAGE` above to run a published image on MySQL
(done for 0.9.3 on 2026-09-04: 13 phases + option 3 green, PAP paging on the SQL connector).

## Option 3: twin-dataspace #362 reproduction

`./option3-test.sh` (after the run above) reproduces both halves of #362 against the live
node: Phase 13 seeds more than one PAP page of agreements for the KRA/Trader/dataset triple
and checks that the in-process `negotiateAgreement` reuses the NEWEST one (page 2, then a
freshly minted real one); Phase 14 seeds a stale newest agreement, runs `prepareTransfer`,
and checks the provider rejection, the consumer prune (`unknownAtProvider`, PAP 404) and the
recovery to the real agreement. Both in-process methods are reached through
`probe/option3-probe.mjs`, loaded as a `TWIN_EXTENSIONS` entry in one-shot `docker compose run`
node processes that share the scaffold's data volume; each probe writes `.option3-probe-<n>.log`.

### twin-api #282: provider auto-start on the in-process route

The last option 3 step keeps the probe alive after `prepareTransfer` and runs it with
`TWIN_DATASPACE_AUTO_START_TRANSFERS=true` (the main node keeps auto-start off, so the phases are
unchanged). None of the scaffold's tenants stores a `publicOrigin`, so the provider's auto-start only
works when `PlatformService.getLocalOriginContext` inherits the node origin (`@twin.org/api-service`
0.9.3, <https://github.com/iotaledger/twin-api/issues/282>). The step fails with
`autoStartPublicOriginMissing` on an unfixed api-service and passes when the provider record reaches
`STARTED`. `provision-storage.sh` now waits for the node to answer before its first login, so the
README one-liners no longer race the extension install on a fresh image. The probe process runs
with `TWIN_LOGGING_CONNECTOR=console`: on the file connector a second writer corrupts the shared
`log-entry` store once it has grown to a few MB.
