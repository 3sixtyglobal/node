# Kenya Community Node — TypeScript End-to-End Test

TypeScript port of `../kenyaCommunityNodeDocker/kenya-test.sh`. The bash version exercises the same-node multi-tenant DSP + PNP scenario by `curl`ing the running container; this version does the same work through the production `@twin.org/*` REST clients so the rest-client surface stays exercised end-to-end.

## What this test does

Phases mirror `kenya-test.sh` one-for-one:

| Phase | Subject                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| 0     | Health check (tenant-gated) + per-tenant logins via `EntityStorageAuthenticationRestClient`                            |
| 1     | Trader queries federated catalogue (proves [Node] partition routing reaches Trader's context)                          |
| 2     | Sanity: KRA's offer was seeded by `provision-storage.sh`                                                               |
| 3     | Trader sees KRA's dataset + extracts the encrypted publisher tenant token from `distribution.accessService` (TICKET-G) |
| 4     | Trader pre-injects PNAP entry and sends `ContractRequestMessage` cross-tenant                                          |
| 5     | Polls for `FINALIZED` / `VERIFIED`, resolves agreement id from Trader PNAP                                             |
| 6     | Trader `requestTransfer` against the agreement                                                                         |
| 7     | Trader `startTransfer`, asserts TICKET-D tenant-token in dataAddress.endpoint, pulls data                              |
| 8     | Push setup REJECTS bare endpoint without tenant token                                                                  |
| 9     | Push setup ACCEPTS endpoint with baked consumer tenant token                                                           |
| 10    | Restart container → S4 composite publisher fallback fires on boot republish                                            |
| 11    | Negative-path tenant isolation (5 sub-assertions, defense-in-depth)                                                    |

## Prereqs

The test reuses the runtime state produced by the sibling `kenyaCommunityNodeDocker/` scaffold:

```bash
cd ../kenyaCommunityNodeDocker

# 1. Bootstrap node, create KRA + Trader tenants + per-tenant admins
./setup.sh

# 2. Start node
docker compose up -d

# 3. Seed KRA's dataset + ODRL offer; capture trust JWTs + session tokens
./provision-storage.sh
```

`provision-storage.sh` writes the following dotfiles, which this TypeScript test reads directly so it never has to re-do setup:

- `.node-password`
- `.tenants`
- `.tenant-users`
- `.session-tokens`
- `.trust-tokens`
- `.seeded-offer`

## Run the test

```bash
cd ../kenyaCommunityNodeTypeScript
npm install
npm run test
```

`npm run test` is just a thin wrapper over `tsx src/kenyaTest.ts`. You can also run that directly without a test framework.

## Type-check only (no runtime)

```bash
npm run test:build
```

## REST clients used

| Client                                  | Purpose                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `EntityStorageAuthenticationRestClient` | `/authentication/login` for KRA + Trader                                                                        |
| `FederatedCatalogueRestClient`          | Catalogue queries (Phases 1, 3, 10)                                                                             |
| `PolicyNegotiationPointRestClient`      | Cross-tenant `ContractRequestMessage` (Phase 4) and negotiation state polling (Phase 5)                         |
| `PolicyNegotiationAdminPointRestClient` | Consumer-side PNAP pre-inject + agreement-id lookup (Phases 4, 5)                                               |
| `PolicyAdministrationPointRestClient`   | Direct-by-URN offer fetch for isolation assertions (Phase 11.2, 11.4)                                           |
| `DataspaceControlPlaneRestClient`       | `requestTransfer` / `startTransfer` (Phases 6, 7, 8, 9), `listAppDatasets` + `getAppDataset` (Phase 11.3, 11.5) |

> Phase 7's data pull hits the absolute URL surfaced by `startTransfer` via `fetch` because that URL is fully-formed by the provider (host, path prefix, encrypted tenant token and access token are all baked in). Wiring a `DataspaceDataPlaneRestClient` against the same URL would require either splitting the URL back into parts or duplicating the rest-client's prefix logic — `fetch` is the cleaner mirror of the bash scaffold's behaviour.

## Cross-tenant routing

Per-tenant routing relies on three knobs threaded through every rest-client construction in `src/restClientFactory.ts`:

1. `headers["x-api-key"]` — pins `ContextIds[Tenant]` before auth (consumed by `api-tenant-processor`).
2. `headers.cookie = "access_token=<session-jwt>"` — surfaces the session JWT for `AuthHeaderProcessor` on authenticated routes.
3. Endpoint URL `?x-enc-tenant-token=<encrypted>` — preserved verbatim by `BaseRestClient` (see `_endpointQuery` handling). This is how a Trader-issued PNP/DSP request gets routed into KRA's partition on the inbound side.

## Notes

- The bash test uses `docker compose restart` + `docker exec` in Phase 10. The TypeScript port shells out via `child_process.spawn("docker", [...])` to mirror this — you need docker on your PATH.
- Phase 7's data pull URL is provider-supplied (it's the decrypted dataAddress.endpoint). The bash test translates the container-internal host (`http://twin-kenya-node:3000`) to the public host; this port does the same string replacement.
- Phase 4's PNP `requestFromConsumer` mirrors what `policyNegotiationPointService.sendRequestToProvider` does internally on the consumer side (callback URL with `?x-enc-tenant-token=`), since the rest client itself does not run that path-decoration logic.
