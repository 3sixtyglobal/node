# Findings from the Third Run (2026-06-19) — Latest-published shakedown + a platform regression fixed

> Created: 2026-06-19
> Last updated: 2026-06-24

## RE-VALIDATION #2 (2026-06-24) — WHOLE PLATFORM ON 0.9.0-next.1, BOTH GREEN

Newest entry, WINS over everything below. After a `merge next`, the whole platform moved off the
mixed `next.55`/`next.66` line onto a single **`0.9.0-next.1`** line (node-core jumped
`next.66` → `0.9.0-next.1`; dataspace-control-plane `next.55` → `0.9.0-next.1`; etc.). Re-ran both
scaffolds clean against latest-published.

**Result: BOTH GREEN.**

- **Kenya: 25 OK / 0 FAIL / 0 WARN** (10 phases).
- **Mobius: 69 OK / 0 FAIL / 0 WARN** (13 phases).
  Verified `0.9.0-next.1` in-container for entity-storage + dataspace-test-app on both.

**Three fixes were required (all NEW this run, uncommitted):**

1. **`dataspace-test-app` caret-cap (the predicted recurrence).** `package.json` pinned it
   `^0.0.3-next.16`, which caps at `<0.0.4`; once test-app jumped to the `0.9.0` line it stuck at
   `0.0.3-next.55` while the rest of the platform was `0.9.0-next.1` (an extension/platform version
   skew). This is exactly the latent caret flagged in RE-VALIDATION (2026-06-23). Fix: pin → `next`
   (forced past the lockfile with an explicit `npm install @twin.org/dataspace-test-app@next`).
   Now `0.9.0-next.1`.
2. **node-core 0.9.0 STRICT ENV VALIDATION (new platform behavior).** `buildConfiguration` now
   calls `validateEnvVarKeys`; `TWIN_STRICT_ENV` defaults to `"error"`, so ANY unknown `TWIN_*` var
   aborts bootstrap (`unknownEnvVars`) before DID minting. The scaffolds tripped three vars
   (root-caused against node-core's `models/*EnvironmentVariableKeys.js`, the authoritative key set):
   - `TWIN_TRUST_JWT_TTL_SECONDS` → **renamed** to the real key `TWIN_TRUST_JWT_TTL` (value `3600`
     kept; the config TTL is in seconds per trust-service `tokenTtlInSeconds`). The old `_SECONDS`
     name was never a key, so it had silently been a no-op; the rename makes the 1h intent real.
     Both scaffolds.
   - `TWIN_BLOB_STORAGE_CONNECTOR_PUBLIC` → **removed** (the "public connector" concept is gone in
     0.9.0; not consumed anywhere; valid blob keys are type/default/enableEncryption/encryptionKeyId/
     prefix). Mobius ×4 only.
   - `TWIN_TEST_APP_CONSIGNMENTS` → **allow-listed** via new `TWIN_ENV_ALLOW_LIST=` (it is a custom
     var owned by the dataspace-test-app extension, never a core key). Kenya only.
     After these, all 5 env files validate clean (zero unknowns) against the 0.9.0 key sets.
3. (Carried from 2026-06-23, still in place) entity-storage pins `next`; `dsp-client` `requestTransfer`
   2-arg. The transfer signatures are unchanged on the 0.9.0 line (re-checked).

**Uncommitted from this run (nothing committed — awaiting OK):** `package.json` + `package-lock.json`
(dataspace-test-app → next), `kenya .../env/node.env` (TRUST_JWT_TTL rename + ENV_ALLOW_LIST), and
`mobius .../env/{mobius,ashford,suffolk,mcp}-docker.env` (TRUST_JWT_TTL rename + drop blob public).

**Lesson reinforced:** every caret-pinned `^0.0.3-next.x` cross-module dep is a latent stale-cap that
bites the moment that dep crosses a minor-version line. The convention (`"next"`) avoids it. The two
that remained (`dataspace-test-app`) are now `next`; none left in the root `package.json`.

---

## RE-VALIDATION (2026-06-23) — BOTH SCAFFOLDS GREEN ON LATEST-PUBLISHED 0.9.x

This is the newest entry and WINS over everything below. The "first action for whoever
picks this up" from the 2026-06-20 handoff (rebuild + re-run both on 0.9.x) is now DONE.

**Result: both scaffolds pass on the latest published packages.**

- **Kenya: 25 OK / 0 FAIL / 0 WARN** (all 10 phases). Negotiations FINALIZE on the single
  multi-tenant node (the #180 `getLocalOriginContext` fix is live in the published packages),
  4 slices aggregated, push reject/accept, default-arbiter read-grant/write-deny, KE-constraint
  filtering, write-grant.
- **Mobius: 69 OK / 0 FAIL / 0 WARN** (all 13 phases). Cross-node negotiations FINALIZE, all
  three consumers' transfers COMPLETE, per-item ODRL location filtering correct
  (Ashford→Dover, Suffolk→Felixstowe, MCP→both), push setup accepted.

**Reference point:** the published node image is now `twinfoundation/twin-node:0.0.3-next.66`
(api-service `0.9.0-next.1` carrying #180; node-core `next.66`; dataspace `next.55`). The
scaffolds still BUILD LOCALLY (they must — the published image does NOT contain the
`dataspace-test-app` test extension), but the locally-built image was verified to bake the SAME
tree as the published image (top-level entity-storage `0.9.0-next.1`, intentional nested
`0.0.3-next.33` under `api-*` because `api-service@0.9.0-next.1` pins it exactly).

**Two fixes were required to get green on 0.9.x (both NEW since 2026-06-20, uncommitted):**

1. **Stale entity-storage pin (twin-node/package.json) — the "latest published" gap.** The root
   `twin-node/package.json` caret-pinned `@twin.org/entity-storage-models` and
   `entity-storage-service` at `^0.0.3-next.24`. A caret on a `0.0.x` prerelease caps at
   `<0.0.4`, so npm resolved them to `0.0.3-next.33` — it could NOT reach `0.9.0-next.1` (the
   line jumped from `0.0.3-next.33` straight to `0.9.0-next.1`). Every nested consumer and the
   published image use `0.9.0-next.1`, so the locally-built image baked a stale,
   internally-inconsistent entity-storage tree (a `does not provide an export named X` waiting
   to happen). Fix: both pins → `"next"` (the project convention for cross-module deps), then
   `npm install` + an explicit `npm install <pkg>@next` to force the dist-tag re-resolution past
   the lockfile. Verified `0.9.0-next.1` IN both rebuilt containers. (These three deps —
   incl. `dataspace-test-app` — are LOCAL additions to the root package.json, not on origin/next.)
2. **`requestTransfer` signature 3-arg → 2-arg (dataspace-control-plane next.55).** The third
   run (next.51) had `requestTransfer(request, options, trustPayload)`; next.55 REMOVED the
   `options` arg → `requestTransfer(request, trustPayload)`. Auto-start is now a provider-side
   config (`autoStartTransfers`, default false), never a consumer param. Kenya's
   `scripts/dsp-client.mjs` was passing `(message, undefined, trustPayload)`, so `undefined`
   landed in the `trustPayload` slot → `Guards.stringValue("trustPayload", undefined)` →
   `guard.string` at Phase 3. Fix: `requestTransfer(message, opts['trust-payload'])`. Mobius is
   UNAFFECTED (it does transfers via direct `curl` to `/dataspace/transfers/request`, not the
   rest-client wrapper). The scaffold's explicit `requestTransfer`→`startTransfer` flow is still
   correct because `autoStartTransfers` defaults to false.

**Latent (not fixed, flagged):** `@twin.org/dataspace-test-app` is still caret-pinned
`^0.0.3-next.16` in the same block. It currently resolves fine (`0.0.3-next.55` = latest), but
it is the SAME caret-capping class — convert to `"next"` if/when test-app jumps version lines.

**Uncommitted changes from this re-validation (nothing committed — awaiting OK):**

- `twin-node/package.json` (2 entity-storage pins `^0.0.3-next.24` → `next`)
- `twin-node/package-lock.json` (entity-storage resolved to `0.9.0-next.1`)
- `kenyaCommunityUseCaseDefaultArbiter/scripts/dsp-client.mjs` (`requestTransfer` 2-arg)
- this doc.

**CORRECTION (2026-06-24): Jose's `negotiateAgreement` implicit-trust bug is FIXED, not open.**
The 2026-06-20 handoff (and earlier notes) called it "STILL OPEN at
`dataspaceControlPlaneService.ts:2073`, bare `trustInfo.identity === organizationId`". That was a
misread: line 2073 is the SECOND clause of a TWO-part guard; line 2072 adds
`localProviderContext?.[ContextIdKeys.Organization] === organizationId &&`. Verified in BOTH the
published dist (`dataspace-control-plane-service@0.0.3-next.55`, the version both green runs used)
and twin-dataspace source (`next.55`, src lines 2069-2076):

```ts
const localProviderContext = await this._platformComponent.getLocalOriginContext(providerEndpoint);
if (
  localProviderContext?.[ContextIdKeys.Organization] === organizationId &&
  trustInfo.identity === organizationId
) {
  return this.negotiateImplicitTrustAgreement(organizationId, datasetId);
}
```

The implicit-trust shortcut now fires ONLY when the provider endpoint resolves to the SAME local
org as the consumer. A cross-org provider (different local org) or a remote provider
(`getLocalOriginContext` → `undefined`) falls through to a real negotiation. Note: this fix is
built ON TOP of our #180 `getLocalOriginContext` org-routing fix, so the two compose.

**Already regression-tested upstream** (so it can't silently regress): twin-dataspace
`tests/dataspaceControlPlaneService.spec.ts` → `describe("Contract Negotiation - Implicit Trust")`.
The test `"should NOT shortcut to implicit trust for a cross-org provider whose endpoint is not
local…"` is explicitly commented _"Regression for the cross-org bug"_ and asserts
`sendRequestToProvider` IS called (negotiationId set, agreementId undefined); sibling tests assert
the same-org branch returns an `agreementId` without calling the provider. Both branches covered.

**Hardening backlog item A (drive `negotiateAgreement` from the scaffolds) is NOT actionable as
written** and is now redundant. `negotiateAgreement`/`prepareTransfer` are IN-PROCESS ONLY:
`NotSupportedError` on the rest client ("contract negotiation is in-process only"), no REST route
(`dataspaceControlPlaneRoutes.js` exposes only `transfers/*` and `app-datasets/*`), and zero
production HTTP callers. The HTTP-driven docker scaffolds cannot reach it without building a new
in-server test extension (a `docker exec node -e` starts a fresh process with an EMPTY
`ComponentFactory`, so that route doesn't work either). And even if built, it would only duplicate
the upstream unit coverage above. See the updated `hardening-backlog.md` item A. No bug to file.

---

## CURRENT STATE (2026-06-20) — READ THIS FIRST

This section is the cold-start handoff and reflects the workspace as of 2026-06-20. The
chronological body below documents the third run as it happened on **2026-06-19 against the
`0.0.3-next.x` line**; where they differ, THIS section wins. The platform has since moved to a
new version line, so the body's "uncommitted / pending / all green" claims are historical.

**Big change since the run: version line jumped `0.0.3-next.x` → `0.9.0-next.1`** across the
platform (twin-api src/published/installed all `0.9.0-next.1`; twin-node `node_modules` updated).
twin-node is on branch `feature/n2n-docker-test-with-pnp-negotiation`, which has merged `next`
(recent commits incl. #240/#241).

**Status of each item from the run:**

- **Platform fix (our `getLocalOriginContext` org-routing bug): MERGED + PUBLISHED.** Landed as
  `bceb9f1 fix: resolve local origin context by organization routing param (#180)` in twin-api,
  shipped in `api-service@0.9.0-next.1`. No longer a local overlay; it's the real published code.
- **Scaffold fixes (4 Kenya + Mobius `TWIN_FEATURES`): COMMITTED** on the twin-node branch
  (verified present in source, no uncommitted diff). The four: `TWIN_FEATURES="wallet,admin-user"`,
  drop `--public-origin`, `dcterms:publisher` in dataset body, `dsp-client.mjs` `requestTransfer`
  3-arg. Mobius env files carry the `TWIN_FEATURES` fix.
- **Jose's separate bug (`negotiateAgreement` implicit-trust, `trustInfo.identity === organizationId`):
  STILL OPEN.** Present in current dataspace source at
  `dataspace-control-plane-service/src/dataspaceControlPlaneService.ts:2073` →
  `negotiateImplicitTrustAgreement`. The `offerAssigners.includes(organizationId)` fix that was a
  local uncommitted change last session is GONE / never merged. This is the high-altitude
  consumer-method path our scaffolds do NOT exercise (low-level DSP routes only), so a green
  Kenya/Mobius run does not clear it. Needs an upstream fix + the `negotiateAgreement` coverage
  from the hardening backlog (item A/D). Bug ticket text was drafted (see git history / clipboard
  notes); confirm it's filed.

**NOT YET RE-VALIDATED on the 0.9.x line.** The green results below (Kenya 25/0, Mobius 69/0)
were on `0.0.3-next.x` with a local api-service overlay. On 0.9.x the fix is now native, so a
re-run is expected green, but it has NOT been done. The running Mobius container is ~4 days old
(stale image). **First action for whoever picks this up: rebuild + re-run both scaffolds on
0.9.x to confirm, before trusting any "green" claim.**

**How to run (unchanged):**

- Kenya: from `kenyaCommunityUseCaseDefaultArbiter/`: `./setup.sh --clean` (do NOT touch docker
  until it fully completes — a premature `docker compose up` collides with the bootstrap and
  half-bootstraps the node), then `docker compose up -d`, `./provision-storage.sh`,
  `./kenya-usecase-test.sh`. Expect 10 phases, 25 OK.
- Mobius: from `mobiusSupplyChainDocker/`: `./setup.sh --clean`, `docker compose up -d twin-mobius
twin-ashford twin-suffolk twin-mcp`, `./mobius-test.sh '<pw>' '<pw>' '<pw>' '<pw>'` (passwords in
  `.node-passwords`). Expect 13 phases, 69 OK.
- `--clean` is canonical (fresh bootstrap catches setup-time regressions reuse hides). Each
  `--clean` mints DIDs on IOTA testnet via pre-funded mnemonics (~5-15 min).

**Gotchas (still apply):** never `npm install` inside the baked image (re-reifies the whole
@twin.org tree, overwrites any local patch); after any image rebuild meant to carry a change,
verify the changed line IN the container before testing; `GET /spec` serves a stale baked file —
trust the startup "Added REST route" logs.

**Related docs:** [`hardening-backlog.md`](hardening-backlog.md) (P1-P3 scaffold hardenings;
item A "drive the high-level consumer API" would have caught Jose's bug),
[`findings-from-second-run.md`](findings-from-second-run.md),
[`194-trust-mode-findings.md`](194-trust-mode-findings.md).

---

Follow-up to [`194-trust-mode-findings.md`](194-trust-mode-findings.md) and
[`findings-from-second-run.md`](findings-from-second-run.md). (Naming note: this Kenya folder
has no `findings-from-first-run.md`; the original analysis lived in `194-trust-mode-findings.md`,
then `findings-from-second-run.md`, so `findings-from-third-run.md` is the correct next name.
A separate `multiTenancyDocker/findings-from-first-run.md` exists for a different scaffold.)

## Goal

Re-verify the Kenya Community Use Case (Default Arbiter) runs cleanly on the **latest published
npm packages** (so it works for everyone), after ~4 days of platform churn. Two parallel agents
mapped (a) every breaking change in the last ~5 days across node-core/dataspace/rights-management/
federated-catalogue/api/engine/trust, and (b) the scaffold's exact CLI/REST/env surface, then we
cross-referenced and ran a full `--clean` bootstrap.

## Dependency state

twin-node `node_modules` refreshed via clean reinstall to latest published `next`:
api-service `next.50`, api-tenant-processor `next.50`, dataspace-\* `next.51`,
rights-management-pnp-service `next.58`, federated-catalogue-service `next.23`,
entity-storage-connector-file `next.33`, trust-service `next.24`. (node-core source on the
branch is `next.59`; published is `next.62` — branch is 9 commits behind origin/next, those are
additive mutex-timeout env vars + component bumps; not merged here to avoid an unapproved commit.
The dependency packages — what others install — are all latest published.)

## Scaffold fixes required for latest-published (4) — all from recent platform changes

1. **`TWIN_FEATURES` rename.** node-core dropped the `node-` prefix on bootstrap features
   (`node-wallet`→`wallet`, `node-admin-user`→`admin-user`; node identity now created
   unconditionally — `bootstrapLegacy.ts:125,131,289`). The scaffold's old
   `node-identity,node-wallet,node-admin-user` silently skipped wallet + admin-user creation, so
   bootstrap printed no admin password and `setup.sh` failed at password extraction. Fixed in
   `env/node.env` → `TWIN_FEATURES="wallet,admin-user"`. (This is the 16-June standup's
   "Node Admin/User → Wallet/Admin User" rename.)
2. **`publicOrigin` uniqueness.** `tenant-create` now rejects a duplicate publicOrigin
   (`tenantAdminService.publicOriginAlreadyExists`, guarded by `Is.stringValue(publicOrigin)`).
   Five tenants on one node can't share an origin. Fixed by dropping `--public-origin` in
   `setup.sh` (post-#203 routing is by `?organization=<org-did>`, not origin; empty origin is
   exempt from the check; the scaffold's callbacks use a hardcoded internal URL).
3. **Dataset publisher required.** federated-catalogue now hard-requires `dcterms:publisher`
   (`federatedCatalogueService.ts:233`, `datasetMissingPublisher`). Added
   `"dcterms:publisher": <org DID>` to the dataset body in `provision-storage.sh`.
4. **`requestTransfer` signature.** dataspace control-plane rest client dropped `publicOrigin`
   and inserted an `options` param: `requestTransfer(request, options, trustPayload)` (3-arg;
   `startTransfer`/`getTransferProcess` stay 2-arg). `scripts/dsp-client.mjs` was passing
   `(message, trustPayload)`, so the trust JWT landed in the `options` slot and the request went
   unauthenticated. Fixed → `requestTransfer(message, undefined, trustPayload)`.

## The platform regression (Bug: same-node cross-tenant negotiation cannot FINALIZE)

With the four scaffold fixes, Phases 0-2 passed but **Phase 3 failed**: every negotiation went
`TERMINATED` with `policyNegotiationPointService.negotiationNotFound` for the consumer pid, no
offer/agreement callback POST was ever emitted, and the consumer record stayed REQUESTED.

**Root cause (verified in source, not inferred).** `PlatformService.getLocalOriginContext(url)`
(twin-api, `bd3162f`, merged 2026-06-19) resolves a URL's local tenant context by ORIGIN only:
if the URL origin equals the current context's `PublicOrigin`/`LocalOrigin` it returns the
CURRENT context; otherwise it looks up a tenant by `publicOrigin`. It never reads the
`?organization=<org-did>` query param that #203 made the tenant discriminator. The PNP "local
optimization" (`13858ea`, #216, merged 2026-06-19) uses it to short-circuit same-node
negotiation callbacks in-process: `ContextIdStore.run(localContext, () => action(this))`
(`policyNegotiationPointService.ts:1813-1828`). On a single multi-tenant node every tenant
shares one origin, so for any callback to the node the origin matches `PublicOrigin` and
`getLocalOriginContext` returns the CALLER's (provider/KRA) context. The provider then runs the
consumer-side `offerFromProvider` in KRA's partition, the Trader negotiation record isn't there
→ `negotiationNotFound` → provider record TERMINATED, no HTTP callback emitted. Cross-node
(Mobius) is unaffected (callback origin ≠ local origin → falls through to correct remote HTTP
dispatch).

**By design? No — stale wiring + a test gap.** Origin-based resolution predates the #203
org-DID routing model (tenants used to have distinct origins; now they share one and are
distinguished by `?organization=`). Same class as the blob-storage stale `?x-enc-tenant-token`
decoder in CLAUDE.md. The test gap that let it through: the existing
`platformService.spec.ts > getLocalOriginContext` tests use **origin-only URLs**, never an
`?organization=` param, so the org-routing path was never exercised; #216 was then built on top
without a same-node cross-tenant negotiation test.

**Provenance.** All by Martyn Janes, all merged **2026-06-19** (today): `bd3162f` add
getLocalOriginContext, `5e024d5` platform isLocalOrigin (#173), `1aaf7f5` ensure publicOrigin
unique, `13858ea` local optimization (#216). That recency is exactly why the second-run (older
published) was green and this one regressed.

## The fix (applied locally; basis for the upstream PR)

`getLocalOriginContext` now checks the `?organization=` param FIRST: if present, resolve the
tenant by `organizationId` (mirrors `TenantProcessor` inbound routing) and return THAT tenant's
context; if the org is not a local tenant, return `undefined` (→ remote dispatch). Only when
there is no org param does it fall back to the existing origin-based resolution, so origin-only
URLs keep their behavior. File: `twin-api/packages/api-service/src/platformService.ts`.

Tests added to `platformService.spec.ts` (proven to fail on the unpatched code — the precedence
test returned the caller's org-1 context instead of org-2):

- org-param precedence even when origin matches the current context (single-node multi-tenant);
- org-param that resolves to no local tenant → undefined (cross-node).
  api-service suite: 28/28 green; twin-api format+lint clean.

**Scope note for the upstream PR:** the local fix does the primary `organizationId` lookup only.
`TenantProcessor.resolveByOrganizationId` also falls back to the `organizationIdLegacy` alias
(for rotated orgs); the official fix should mirror that for consistency (it needs a
`@twin.org/entity` dep on api-service for `ComparisonOperator`, which is why the minimal local
fix omits it). Not exercised by this scaffold (no org rotation).

## Result — ALL 10 PHASES GREEN: 25 OK / 0 FAIL / 0 WARN

Validated against the latest published deps + the four scaffold fixes + the local api-service
fix (synced into `twin-node/node_modules` and baked into the image; fix confirmed in-container
before testing). Negotiations FINALIZE, pulls aggregate 4 distinct slices, push gate
reject/accept, default-arbiter read-grant/write-deny, KE constraint filtering, write-agreement
grant — all pass.

## Topology coverage (which deployment shapes we actually test)

The platform routing is a 2x2 matrix; the fix is topology-agnostic (it asks "is this org a
tenant on THIS node?", local org → local context, non-local org → remote HTTP dispatch):

|               | single node                             | multi-node                      |
| ------------- | --------------------------------------- | ------------------------------- |
| single-tenant | trivial (origin/self-callback), covered | Mobius (to verify)              |
| multi-tenant  | **Kenya — verified**                    | superset, **no scaffold (gap)** |

- Org aliases (rotated default org → `organizationIdLegacy`): still correct under the minimal
  fix — an alias-addressed same-node callback misses the primary `organizationId`, returns
  `undefined`, and takes the remote-HTTP path where the inbound `TenantProcessor` alias
  fallback routes it. Loses only the in-process optimization for aliases.
- No-org-param (legacy origin-routed) callers: unchanged.

**Follow-up (deferred):** add a minimal multi-node multi-tenant scaffold (2 nodes × 2 tenants,
one cross-node-cross-tenant negotiate→pull + one isolation negative). ~60-70% reuse of
Mobius topology + Kenya per-node provisioning; the genuinely new/risky bit is cross-node
discovery scoping when a remote node hosts multiple tenants (does the fedcat remote-endpoint
query scope by org / `FilterByMetadata` ownerId?). Estimated ~a day; not a blocker.

## Status / TODO

> Superseded by the CURRENT STATE section at the top (2026-06-20). The bullets below were true on
> 2026-06-19 (the `0.0.3-next.x` line) and are kept for history.

- ~~Four scaffold fixes: uncommitted in the working tree.~~ **COMMITTED** on the twin-node branch.
- ~~Platform fix: uncommitted in twin-api; needs PR.~~ **MERGED + PUBLISHED** as twin-api
  `bceb9f1` / #180 in `api-service@0.9.0-next.1`. (The maintainer's merged version, verify whether
  it added the `organizationIdLegacy` alias fallback the scope note recommended.)
- ~~The fix is an in-`node_modules` overlay.~~ No longer an overlay; it's the published code now.
- DONE (on 0.0.3-next.x): Mobius re-run **ALL 13 PHASES GREEN, 69 OK / 0 FAIL / 0 WARN**, only
  needed `TWIN_FEATURES`. Confirmed the negotiation regression was SAME-NODE ONLY. **Re-run on
  0.9.x still pending** (see CURRENT STATE).
- STILL OPEN: Jose's `negotiateAgreement` implicit-trust bug (dataspace, not fixed upstream) —
  see CURRENT STATE.
- DEFERRED: multi-node multi-tenant scaffold (see Topology coverage above).
- TODO for next picker-up: (1) rebuild + re-run Kenya and Mobius on 0.9.x to confirm green;
  (2) confirm Jose's dataspace bug ticket is filed and chase the upstream fix; (3) optionally
  start the P1 hardening pass (`hardening-backlog.md`) so the scaffolds would catch Jose's class
  of bug.
