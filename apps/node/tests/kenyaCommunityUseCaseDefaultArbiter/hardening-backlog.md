# Kenya + Mobius Scaffold Hardening Backlog

> Created: 2026-06-20
> Last updated: 2026-06-29

## STATUS (2026-06-29) — READ FIRST

Baseline: both scaffolds green on the latest published `0.9.1-next.x` line — **Kenya 36 OK**,
**Mobius 76 OK** (0 FAIL / 0 WARN). Branch `feature/n2n-docker-test-with-pnp-negotiation`.

- **DONE + committed:** **F** (contract-shape assertions, `9cf675c`), **G** (proof signing — org-DID
  signed immutable proofs, `f9d3ffe` + de-flake/H in `c390131`), **H** (routing/trust negatives,
  2 of 4 — `c390131`). All on Kenya; F also on Mobius. See the per-item ✅ marks + the Implementation
  Log at the bottom.
- **MOOT (not actionable, documented):** **A, C, D** — all blocked by the same wall: consumer-side
  negotiation init (`negotiateAgreement` / `sendRequestToProvider`) is IN-PROCESS ONLY (no REST
  route), and the regressions they targeted are already covered by upstream twin-dataspace unit
  tests. Do not re-attempt as scaffold work.
- **NEXT (open, HTTP-reachable):** **J** (FilterByMetadata — catalogue `ownerId`/metadata filter;
  cheap), then **I** (UserOrganisation ≠ Organisation), **K** (push-subscription lifecycle), the
  deferred halves of **H** (transfer-level `transferWrongOrganization`, CLI alias rotation), and
  **B**/**E** (mostly policy). **L** (multi-node multi-tenant scaffold) + **M** (SQL connector) are P3.
- **Key gotchas for whoever continues:** (1) the immutable-proof in G notarizes via a BACKGROUND TASK
  with variable latency (6s fresh → ~60s on a backed-up node) — any proof test must poll generously
  and create work up front so it runs concurrently (see G log). (2) Session JWTs in `.session-tokens`
  expire — re-`provision-storage.sh` before a standalone test run. (3) `.node-passwords` is written
  unquoted; pass Mobius passwords to `mobius-test.sh` as single-quoted args. (4) `--clean` is the
  canonical run. (5) This doc + `findings-from-third-run.md` are gitignored (local only); the `.sh`
  test scripts + `env/*.env` are tracked and committed.

Hardening ideas for the two end-to-end docker scaffolds (`kenyaCommunityUseCaseDefaultArbiter`
= single-node multi-tenant; `mobiusSupplyChainDocker` = multi-node single-tenant), prioritised
by value-for-cost. Each item names the bug class it would catch and which scaffold(s) it applies
to. Grounded in real gaps observed across the first/second/third runs (see
[`194-trust-mode-findings.md`](194-trust-mode-findings.md),
[`findings-from-second-run.md`](findings-from-second-run.md),
[`findings-from-third-run.md`](findings-from-third-run.md)).

## Cross-reference: the existing expansion ladder

`multiTenancyDocker/findings-from-first-run.md` (April 2026, pre org-identifiers refactor) has a
**"Test coverage gaps"** section and an **"Expansion ladder for broader coverage" (Tiers 0-5)**.
Most of it is DONE (Tiers 0-2: regression, more entity types, rights-management; Tier 4 = the
Kenya same-node DSP scaffold itself now exists). The still-open item there is **Tier 5 =
multi-node multi-tenant**, which overlaps item H below. That ladder is about _topology/entity
breadth_; this backlog is about _altitude and fidelity_ (testing the real consumer API and
production-faithful credentials), the dimension that let recent bugs slip through.

## Root pattern these hardenings address

The scaffolds exercise the platform at the wrong altitude and with the wrong credentials, which
is why a whole class of bug slips past green runs:

1. **Hand-rolled low-level DSP routes** instead of the high-level consumer API real clients use
   (missed the `negotiateAgreement` implicit-trust regression, `trustInfo.identity === organizationId`).
2. **The harness holds every party's credentials** and calls the provider's `startTransfer`
   itself (hid the provider auto-start / callback gap raised by Jose; CLAUDE.md "workaround on
   every run = hidden platform gap" smell).
3. **The PNAP pre-inject** (`PUT /negotiations/admin`) substitutes for the consumer's own
   `sendRequestToProvider`/`negotiateAgreement`, the exact code path where bugs live.

## P1 — cheap, high value (do first as one hardening pass)

- **A. Drive the consumer flow through the high-level API (`negotiateAgreement`, plus the
  transfer convenience method `prepareTransfer`/`startDataTransfer`) instead of hand-rolled
  routes.** ~~Catches: regressions in the consumer-facing convenience layer real clients use
  (would have caught Jose's `negotiateAgreement` implicit-trust bug). Scaffolds: Kenya + Mobius.
  Cost: medium-low.~~
  **UPDATE 2026-06-24 — NOT ACTIONABLE AS WRITTEN / REDUNDANT. Do not build.** This item rested on
  a wrong assumption. `negotiateAgreement`/`prepareTransfer` are IN-PROCESS ONLY: they throw
  `NotSupportedError` on the rest client ("contract negotiation is in-process only"), have NO REST
  route (`dataspaceControlPlaneRoutes.js` exposes only `transfers/*` + `app-datasets/*`), and have
  ZERO production HTTP callers. So the HTTP-driven scaffolds cannot reach them at all; a
  `docker exec node -e` won't work either (fresh process = empty `ComponentFactory`). Reaching them
  would require building a new in-server test extension (P3-sized), not a cheap P1. AND it is
  redundant: the exact regression (Jose's cross-org implicit-trust bug) is FIXED in `next.55`
  (two-part `getLocalOriginContext` guard) and already covered by upstream unit tests
  (twin-dataspace `dataspaceControlPlaneService.spec.ts` → `describe("Contract Negotiation -
Implicit Trust")`, incl. the "Regression for the cross-org bug" test). The right altitude for
  this class is the package-level test where the method lives, not the E2E docker scaffold. The
  feasible, non-redundant parts of the "altitude/fidelity" goal live in items C and F below (both
  reachable over HTTP). See `findings-from-third-run.md` (2026-06-24 correction).
- **B. Credential / role scoping.** Each step uses ONLY the credentials the real actor holds;
  consumer steps never reach into the provider. Catches: auth/routing/auto-start gaps,
  cross-tenant impersonation. Forces production fidelity and makes missing automation surface as
  a hang/failure instead of being masked. Scaffolds: both. Cost: low.
- **C. Remove the PNAP pre-inject workaround.** ~~Let the consumer's own request path create its
  negotiation record. Cost: low (falls out of A).~~
  **UPDATE 2026-06-24 — NOT ACTIONABLE (same in-process-only constraint as A/D). Verified; not a bug,
  not a masking crutch.** Traced on `rights-management-pnp-service@0.9.0-next.1`: the consumer record
  IS created by `sendRequestToProvider` (builds a `REQUESTED` negotiation + `.set(...)`), but that
  method is IN-PROCESS ONLY — no REST route calls it; the only caller is `dataspace-control-plane-
service` (the `negotiateAgreement` path). The consumer offer callback `offerFromProvider` REQUIRES
  the record to pre-exist in `REQUESTED` state (`get(consumerPid)` → `negotiationNotFound` if missing;
  it does NOT upsert; a `consumerPid`-absent provider-initiated offer → `providerInitiatedNotSupported`).
  So the `PUT /negotiations/admin` pre-inject is a faithful stand-in for `sendRequestToProvider`'s
  `.set({state: REQUESTED})`, load-bearing because the HTTP scaffold has no in-process consumer —
  removing it makes the first offer callback fail with `negotiationNotFound`. Closing the real gap
  (exercising `sendRequestToProvider`'s record creation) needs the in-process route (test extension,
  P3) — same as A — and is better covered by a package unit test where the method lives.
- **D. Exercise both `negotiateAgreement` branches.** Self-owned dataset → implicit-trust path;
  cross-org → real negotiation. ~~Catches: the exact branch Jose's check decides.~~
  **UPDATE 2026-06-24 — already covered upstream; same in-process constraint as A.** Both branches
  are unit-tested in twin-dataspace (`dataspaceControlPlaneService.spec.ts` → "Contract Negotiation
  - Implicit Trust": cross-org → `sendRequestToProvider` called; same-org → `agreementId` returned,
    provider NOT called). Not reachable from the HTTP scaffolds (see A). No scaffold work needed.
- **E. Make `--clean` the canonical run.** Fresh bootstrap is what caught `TWIN_FEATURES`,
  `publicOrigin` uniqueness, and `datasetMissingPublisher` this session; volume-reuse +
  409-tolerance silently skips them. Catches: setup-time / bootstrap / first-publish
  regressions. Scaffolds: both. Cost: ~zero (policy/CI choice).
- **F. Contract-shape assertions, not just status codes. ✅ DONE 2026-06-24.** Decode and assert:
  trust tokens are identity-only (no `tid`/`org` claims), catalog distribution URLs carry the org
  DID, `dcterms:publisher` present, agreement assignee is a plain org DID. Catches: silent contract
  drift in refactors. Scaffolds: both. Cost: low. **See the implementation log below.**

## P2 — medium value / medium cost

- **G. Assert proof signing (the core #19 goal). ✅ DONE 2026-06-29 (Kenya).** Write an AIS stream /
  AIG vertex / attestation as a tenant user and assert the immutable proof exists and is signed
  by the expected org DID. Catches: proof-skipping / wrong-signer regressions, the entire motivation
  of the org refactor. Scaffolds: Kenya (multi-tenant); Mobius not added (single-tenant per node →
  no per-tenant isolation to prove). Cost: medium. **See the implementation log below.** Note on the
  proposed negative ("missing org context → `contextIdMissing`"): NOT asserted — while authenticated
  the org context is always resolved from the session, so a no-`?organization=` write is attributed
  to the caller's org (verified: a KRA-session write with no org param was attributed to KRA, not the
  node), and `contextIdMissing` is unreachable. The default-org/no-session path is gated 401 by auth
  first, so it isn't reachable either.
- **H. Routing / trust negatives. ✅ DONE 2026-06-29 (Kenya, 2 of 4).** Wrong-org transfer →
  `transferWrongOrganization`; invalid/expired trust token rejected; org-not-entitled negotiation
  rejected; org-alias rotation (`set-tenant-org-id` keeps old catalog URLs resolving, `remove-*-alias`
  stops them). Catches: the routing/trust edges where this session's bugs clustered (org-DID
  resolution). Scaffolds: Kenya. Cost: medium. **DONE: the two cheapest, highest-value HTTP-reachable
  negatives — (1) invalid trust token rejected on a trust-gated route (→ 401), and (2) cross-org read
  isolation: a Trader-owned negotiation is NOT readable via another tenant's `?organization=` (→ 404
  `policyNotFound`), the direct test of the #203 org-routing isolation.** DEFERRED (lower value / more
  setup): transfer-level `transferWrongOrganization` (the gate is verified in code —
  `dataspaceControlPlaneService.js:684/1016`, `entity.organizationIdentity !== callingOrg` — but
  exercising it needs a live transfer pid threaded from Phase 3), and CLI org-alias rotation (needs
  `set-tenant-org-id`/`remove-*-alias` flows). **See the implementation log below.**
- **I. `UserOrganisation` != `Organisation`.** Create a user whose org differs from the tenant
  default and assert ownership/signing uses `UserOrganization`. Catches: the new precedence rule
  that's currently untested (every scaffold user's org == tenant org). Scaffold: Kenya. Cost: medium.
- **J. FilterByMetadata for real.** Phase 1 sends `filter: []`; add an `ownerId` query (only that
  org's entries return) and a metadata filter. Catches: catalogue filter/ownerId regressions.
  Scaffolds: both. Cost: low-medium.
- **K. Push-subscription lifecycle.** suspend / resume / teardown of a push transfer (compensates
  for the ~20 upstream data-plane tests still `test.skip`'d). Catches: data-plane push gaps.
  Scaffolds: both. Cost: medium.

## P3 — bigger investments

- **L. Multi-node multi-tenant scaffold** (= ladder Tier 5). 2 nodes x 2 tenants, one
  cross-node-cross-tenant negotiate→pull + one isolation negative. ~60-70% reuse of Mobius
  topology + Kenya per-node provisioning; the genuinely new/risky bit is cross-node discovery
  scoping when a remote node hosts multiple tenants (does the fedcat remote-endpoint query scope
  by org / `FilterByMetadata` ownerId?). Catches: the untested production superset topology.
  Cost: ~a day.
- **M. SQL connector sanity** (from the ladder's coverage gaps). Run a scaffold against a real
  Postgres/MySQL connector to confirm partitioning matches file/memory. Cost: medium. Low priority.

## Tradeoff to accept before building

Hardening to the real consumer journey (A-D especially) will make the scaffolds go **red more
often** against in-flight platform changes, because they will catch real gaps before publish.
That is the point, more signal, but it is more maintenance and more "is this us or the platform"
triage. Worth explicit buy-in before implementing.

## Suggested sequencing

1. One coherent P1 pass: A + B + C as a single change, plus D, plus make E the default; add F.
   (Would have caught Jose's bug, the provider auto-start gap, and this session's setup-time bugs.)
2. P2: G (proof signing) and H (routing/trust negatives) next.
3. P3: L (MN-MT scaffold) as the deferred bigger item.

---

## Implementation log

### F — Contract-shape assertions (2026-06-24)

Done for BOTH scaffolds (test scripts only — no node rebuild needed; they run on the host against
the running node, so iterating is fast). The goal of F is to assert the SHAPE of what the platform
returns, not just the HTTP status, so a silent contract drift in a refactor fails the run.

**Approach** (matches the existing `ok()/fail()/<cond> || fail` + `curl … | jq` house style; the
frontiers `dataset/scripts/run-flow.sh` uses the same idiom — neither it nor the tutorials decode a
JWT or shape-check a fetched offer/agreement, so those helpers are net-new here):

- New shared helpers added to both `kenya-usecase-test.sh` and `mobiusSupplyChainDocker/mobius-test.sh`:
  - `jwt_claims` — decode a JWT payload with `jq -R '… @base64d | fromjson'` (portable; avoids the
    `base64` binary whose flags differ across macOS/Linux).
  - `is_bare_org_did` — `^did:iota:<network>:0x<hex>$`; rejects the pre-#203 composite
    `nodeDid:hash(tenantId)` and any `#fragment`.
  - `assert_trust_identity_only` — decodes a trust JWT and asserts `iss` == the holder's bare org DID
    AND that no `tid`/`tenantId`/`tenant`/`organization`/`org` claim appears anywhere in the payload
    (post-#203 tenant routing is the `?organization=` param, never a token claim).

**Assertions added:**

| check                                                                                | Kenya                                                                 | Mobius                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------- |
| trust token identity-only                                                            | Trader + KRA                                                          | all 4 nodes                   |
| agreement assigner/assignee are bare org DIDs (assigner=provider, assignee=consumer) | all 4 authorities (phase 3)                                           | all 3 consumer negotiations   |
| `dcterms:publisher` present + bare org DID + == authority DID                        | phase 2 hardened (was a soft `warn`, now a hard per-publisher assert) | (single-publisher; not added) |
| distribution `accessService` URL carries the publisher org DID                       | already asserted in phase 1 (pre-existing)                            | n/a                           |

**Result:** Kenya **25 → 31 OK** / 0 FAIL / 0 WARN; Mobius **69 → 76 OK** / 0 FAIL / 0 WARN.

**Proven they can fail** (CLAUDE.md "never add a test that can't fail"): negative-tested the helpers
out of band — `is_bare_org_did` rejects `…0x..:hash` and `…0x..#vm-1`; the claim scanner detects a
synthetic JWT carrying a `tenant` claim. So a real regression (composite identifier, or a tenant
claim leaking into a token) fails the run instead of passing silently.

**Files:** `kenya-usecase-test.sh`, `mobiusSupplyChainDocker/mobius-test.sh` (both tracked → will be
committed). No env/Dockerfile/package changes. Gotcha noted: `.node-passwords` is written unquoted
by `setup.sh`, so `source`-ing it mangles passwords containing `&`/`$`/`!`; pass them to
`mobius-test.sh` as single-quoted args instead (pre-existing scaffold issue, not introduced by F).

### C — Remove the PNAP pre-inject crutch (2026-06-24) — NOT ACTIONABLE (no code change)

Investigated, not implemented: removing the pre-inject is not possible in an HTTP-driven scaffold,
and the pre-inject is not a masking crutch. Evidence (read on `rights-management-pnp-service@0.9.0-next.1`):

- The consumer-side initiator `sendRequestToProvider` creates the consumer record (`{state: REQUESTED,
handlerId: <requesterType>}` + `.set(...)`) but is IN-PROCESS ONLY — no REST route; only
  `dataspace-control-plane-service` (the `negotiateAgreement` requester path) calls it.
- The consumer offer callback `offerFromProvider` REQUIRES that record in `REQUESTED` state
  (`get(consumerPid)` → `negotiationNotFound` if absent; no upsert; `consumerPid`-absent →
  `providerInitiatedNotSupported`).
- Therefore the `PUT /negotiations/admin` pre-inject faithfully stands in for the in-process
  `sendRequestToProvider.set()`; it is load-bearing. Removing it → first offer callback fails
  `negotiationNotFound`.

Same root cause as A/D (consumer-side negotiation initiation is in-process by platform design). The
real coverage gap (exercising `sendRequestToProvider`) belongs in a package unit test, not the E2E
scaffold. **Outcome: no scaffold change; item marked NOT ACTIONABLE above.** This resolves the
"green-on-a-crutch" question for C: the crutch is verified faithful, not bug-masking.

### G — Proof signing (2026-06-29) — DONE (Kenya)

The first hardening that required _enabling a subsystem_, not just adding assertions. Done on Kenya
(multi-tenant, where org-signed proofs and per-tenant isolation matter); Mobius skipped (single-tenant
per node — nothing extra to prove).

**What it took (traced before building):** the proof-bearing components (AIS / AIG / attestation /
immutable-proof) were installed but NOT route-enabled on the node. node-core enables them via env
(`engineEnvBuilder`): `auditableItemStreamEnabled` → AIS, and AIS auto-pulls in immutable-proof
(`isImmutableProofRequired`), which REQUIRES a notarization connector (`NotarizationConnectorFactory
.get` — throws if absent) + background-task. So three env vars added to `env/node.env`:

- `TWIN_AUDITABLE_ITEM_STREAM_ENABLED="true"`
- `TWIN_NOTARIZATION_CONNECTOR="entity-storage"` — local notarization (no on-chain anchoring); the
  immutable-proof SIGNER logic is identical regardless of backend, so this tests the #19 invariant
  deterministically without IOTA flakiness.
- `TWIN_IMMUTABLE_PROOF_VERIFICATION_METHOD_ID="trust-assertion"` — reuse each tenant's existing
  assertionMethod VM (created in `setup.sh`), so no extra per-tenant setup.

**Why it proves #19:** `immutableProofService` signs as the request's ORGANIZATION identity
(`ContextIdKeys.Organization`) and records `verificationMethod = <orgDID>#<vmId>`. Verified on the
live node: a KRA AIS write → stream `organizationIdentity = <KRA org DID>` (`nodeIdentity` null), proof
`verificationMethod = <KRA org DID>#trust-assertion`, and `/immutable-proof/:id/verify` →
`verified:true` (after the background task notarizes; briefly `notIssued`).

**Test (Phase 11):** for KRA and KPA, write an Auditable Item Stream and assert (a) the stream is
attributed to that tenant's bare org DID, (b) the proof's `verificationMethod` == `<thatOrgDID>#trust-
assertion`, (c) the proof cryptographically `verified:true`. Two tenants → proves per-tenant signing
isolation (KRA's proof signed by KRA, KPA's by KPA — not the node, not each other). Kenya **31 → 34 OK**.

**Negative dropped (documented):** the proposed "missing org → `contextIdMissing`" is unreachable —
while authenticated the org is always resolved from the session (a no-`?organization=` KRA write was
attributed to KRA, not the node; a no-session write is 401 at the auth gate). So there is no orgless
authenticated write to reject.

**Files:** `env/node.env` (3 vars), `kenya-usecase-test.sh` (Phase 11 + the `ais_write_and_check_org`
/ `ais_assert_proof_org_signed` helpers, reusing the F `is_bare_org_did`/`urlenc` helpers). Reuses the
`trust-assertion` VM, so `setup.sh` is unchanged. Validated on a `--clean` fresh bootstrap
(AIS/immutable-proof/notarization init from scratch).

**Flakiness fix (important for anyone extending proof tests):** the immutable proof is notarized by a
BACKGROUND TASK with variable latency — ~6s on a fresh node, but up to ~60s on a heavily-reused node
where the task queue is backed up (the proof always succeeds; it's purely timing). The stream's
`organizationIdentity` is set immediately, but the proof's `verificationMethod` and `verify:true` are
only available AFTER notarization. So Phase 11: (1) creates BOTH tenants' streams up front (asserting
org attribution immediately), so the two proofs notarize concurrently; (2) then polls each proof's
`/verify` with a generous ~120s cap that exits as soon as `verified:true` (a fast node pays no
penalty). A naive per-tenant 40s poll was flaky on a loaded node. Re-validated GREEN (36 OK) on a
deliberately-backed-up node (the worst case).

### H — Routing / trust negatives (2026-06-29) — DONE (Kenya, 2 of 4)

Two HTTP-reachable negatives added as Phase 12, both probe-confirmed against the live node before
wiring (trace-before-build):

1. **Invalid trust token rejected** — a garbage `Authorization: Bearer` on a trust-gated route
   (`/federated-catalogue/request`) → 401 (valid token → 200 baseline). Trust auth gate intact.
2. **Cross-org read isolation** — create a Trader-owned negotiation (`PUT /negotiations/admin`,
   `organizationIdentity=Trader`), confirm Trader reads it (200), then read the SAME id via KRA's
   `?organization=` → 404 `policyNegotiationAdminPointService.policyNotFound`. Proves org-scoped
   isolation: a tenant cannot reach another tenant's record by swapping the routing param — the exact
   class of the `getLocalOriginContext` / tenant-routing bugs this scaffold was built to catch.

**Deferred (documented in the bullet):** transfer-level `transferWrongOrganization` (gate verified in
code but needs a transfer pid threaded from Phase 3) and CLI org-alias rotation. **Result:** Kenya
**34 → 36 OK**. The isolation assertion is the headline: it FAILS loudly ("ORG ISOLATION LEAK") if a
refactor ever lets one org read another's records via the param.
