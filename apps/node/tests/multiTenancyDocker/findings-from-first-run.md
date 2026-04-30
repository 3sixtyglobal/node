# Multi-Tenancy First-Run Findings

**Date:** 2026-04-20
**Test:** `node/apps/node/tests/multiTenancyDocker/`
**Purpose:** Verify whether `TWIN_TENANT_ENABLED=true` produces actual tenant isolation on the default node.

## TL;DR

**Multi-tenancy isolation works on the default node.** `TenantProcessor` is correctly wired, the authentication-user storage is partitioned by `[Node, Tenant]`, and cross-tenant login attempts fail with `userNotFound` — proving the partition filter is active at the storage layer, not just at the middleware.

**As of 2026-04-23:** 8 findings total.

- **3 fixed and merged upstream** (Findings 3, 4, 8 — engine + api PRs published).
- **1 resolved as intentional design** (Finding 1).
- **1 withdrawn as self-inflicted** (Finding 5).
- **2 answered by Lead Dev with direction but mechanism still TBD** (Findings 6, 7) — see "On Q6/Q7" sections for fact-checked verdicts.
- **1 open** (Finding 2 — REST path for cross-tenant user creation; depends on roles/scopes architecture doc that has no owner yet).

All 8 phases of `mt-test.sh` pass.

For a full session-state snapshot (branches, HEADs, Dockerfile overrides, uncommitted diffs), jump to the **"Session state snapshot"** section below.

## Test setup

- One container (`twin-mt-node`), `TWIN_TENANT_ENABLED=true`, file-based entity storage, IOTA for identity/wallet only.
- `bootstrap-legacy` created the node DID and the default `admin@node` user (scope `tenant-admin`).
- `tenant-create` produced two additional tenants:
  - `mobius-freight` — id `019dacbc1bbe...`, apiKey `019dacbc1bbd...`
  - `kenya-trade` — id `019dacbc20f0...`, apiKey `019dacbc20ef...`
- Node tenant (auto-created at bootstrap): id `019dacbaa341...`, apiKey `019dacbaa341...`, `isNodeTenant: true`.

No NGINX, no subdomain routing — just direct `x-api-key` headers in curl. That is deliberate: we are testing the platform primitive, not the infrastructure wrapper.

## What was proven

### 1. `TenantProcessor` runs on every non-`skipTenant` route

Keyless `GET /health` and keyless `POST /authentication/login` both returned:

```json
{
  "error": {
    "name": "UnauthorizedError",
    "source": "TenantProcessor",
    "message": "tenantProcessor.missingApiKey"
  }
}
```

So the middleware is active and gating requests before handlers run. Routes that use `skipTenant: true` (e.g. `POST /tenants/` for the admin listing) correctly bypass `TenantProcessor` and fall through to `AuthHeaderProcessor`, which rejects them with `TokenHelper.missing` when the JWT is absent. Both processor paths observed working correctly.

### 2. Authentication-user storage is partitioned by `[Node, Tenant]`

The stored `admin@node` record on disk (`/app/data/authentication-user/store.json`):

```json
{
  "email": "admin@node",
  "identity": "did:iota:testnet:0xa6c8...3455",
  "organization": "did:iota:testnet:0x2860...93c1",
  "scope": "tenant-admin",
  "partitionId": "Yb3j3cVacb3PVDv4JbQO2dtwj6obQQGAk1Ogz_xvtQY/AZ2suqNBdyuHAKGDXFEjzw"
}
```

The two-segment `partitionId` is `<Node-hash>/<Tenant-hash>`. This matches the `ContextIdHelper.pickKeysFromAvailable(..., [Node, Tenant])` pattern confirmed at [nft.ts:49-58](../../../../engine/packages/engine-types/src/components/nft.ts#L49-L58). The user record is tenant-scoped to the node tenant at storage level.

### 3. Cross-tenant login fails cleanly

Login as `admin@node` with `x-api-key = TENANT_A_API_KEY`:

```text
401 UnauthorizedError
  source: EntityStorageAuthenticationService
  message: entityStorageAuthenticationService.loginFailed
  cause:   entityStorageAuthenticationService.userNotFound
```

The error is `userNotFound`, not `invalidPassword` — confirming the partition filter returned an empty result set. `admin@node` in partition `[Node, NodeTenant]` was invisible when the query ran in partition `[Node, TenantA]`. This is end-to-end isolation at the storage layer.

### 4. JWT `tid` claim carries the tenant binding

Successful login as `admin@node` with the node-tenant key returned a JWT with:

```json
{
  "sub": "did:iota:testnet:0xa6c8...3455",
  "org": "did:iota:testnet:0x2860...93c1",
  "tid": "019dacbaa341772b8700a1835c5123cf",
  "scope": "tenant-admin",
  "exp": 1776723816
}
```

`tid` matches the node tenant id exactly. Any subsequent authenticated request will be rejected by [authHeaderProcessor.ts:122](../../../../api/packages/api-auth-entity-storage-service/src/processors/authHeaderProcessor.ts#L122) if the `x-api-key` on the request resolves to a different tenant. The defence-in-depth link between the tenant processor and the auth processor is real and active.

### 5. The tenant lookup table is correctly node-scoped, not tenant-scoped

All three tenant records (node, mobius-freight, kenya-trade) share the same `partitionId` `Yb3j3cVacb3PVDv4JbQO2dtwj6obQQGAk1Ogz_xvtQY`. That matches the Node-only partition key. This is the "unpartitioned lookup table" the Jan 23 2026 design doc discussed — every request needs to resolve its tenant before it has a tenant context, so the tenant registry itself cannot be partitioned by tenant.

## Lead Dev responses (2026-04-21)

Martyn (Lead Dev) responded to the first four questions. Verbatim excerpts below. His framing across all answers: _"with all of these question I always try to think, what if these were separate nodes, how should it behave (as that is what tenancy is ultimately trying to achieve)"_.

### On Q1 — `/health`, `/info`, `/spec` tenant-gating

> they should all require tenantId, why should we allow access to any of the APIs in a multi-tenant setup to anyone that doesn't have a valid tenantId (the exceptions being the negotiation/DP endpoints)
>
> and with health although we haven't wired up any components to health monitoring, the idea is if you have components that are separated by tenant e.g. different DBs you only want the health for your components

**Verdict:** intentional. Tenant-gating is the design, not a miss. Our local patch (adding `skipTenant: true`) was wrong and needs to be reverted. Follow-up thread opened on how infra-level orchestration probes are meant to work (see Q8 below).

### On Q2 — REST path to create users in non-node tenants

> I think it all depends on how we want to treat node-admins, at the moment they still have an org association as well which might not be correct (do we actually need a node-admin, or should they be a tenant-admin?)
>
> or we could potentially use scopes with a new node-admin value, if set this would allow an override tid to be sent in the queryparams
>
> we should carefully map out what the requirements are for the user types
>
> This should probably form the basis for an architecture document on roles/scopes etc

**Verdict:** open design question. CLI workaround (`node-set-tenant` + `user-create`) is fine short-term. Real resolution needs a roles/scopes architecture doc — new deliverable, ownership not yet decided.

### On Q3 — CP vs DP `TransferProcess` partition

> I think it should be [Node, Tenant] in both places, I don't think one tenant should know about the transfers for another tenant - I thought the initialize skipped if it already existed, but yes it could lookup to see if there is a mismatch
>
> more to the point is the policy/defcat tables and how they are partitioned, they should really be partitioned by tenant (for admin purposes), but then how does a negotiation lookup the correct dataset (we might need to include an encoded version of the tenantId in the service endpoint that is published that can be decoded)

**Verdict:** align CP **up** to `[Node, Tenant]` (opposite of our initial gut). DP was correct, CP's `[Node]`-only comment represented reasoning that's now superseded. Martyn agrees the silent-skip-on-duplicate behaviour should become a conflict check. Separately, he floated a new design direction — **encoded tenantId in the published service endpoint** as the mechanism for cross-node negotiation to resolve per-tenant dataset lookups. That's the same architectural gap the Kenya analysis identified; worth tracking explicitly (Q9 below).

### On Q4 — 401 masked as 500 by `FastifyWebServer`

> that sounds like a bug, maybe something is catching and rethrowing the error wrapped, there were some issues around this before that Rodrigo spotted, but I thought they were fixed

**Verdict:** confirmed bug, believed fixed previously. Worth digging in — Rodrigo has context, ping him when investigating.

### On Q6 — central partition policy (sent + answered 2026-04-23)

> you could introduce a method in the engine somewhere which is `getDefaultPartitionKeys` and then for things like DID it just doesn't call it, so most initialisers would call `pickKeysFromAvailable(getDefaultPartitionKeys())`

**Verdict:** Martyn proposes a helper rather than enforcing partitioning by default. Per-component opt-in stays; the helper just makes the standard case less error-prone.

**Fact-check:** `pickKeysFromAvailable(availableKeys?, desiredKeys?)` exists at [contextIdHelper.ts:174](../../../../framework/packages/context/src/helpers/contextIdHelper.ts#L174). No `getDefaultPartitionKeys` exists today — his suggestion is to add one.

**What this doesn't fully address:** the silent-leak-on-forget concern. A new initializer that forgets to call the helper still defaults to no partitioning. Worth a follow-up question on whether (a) we should open a PR introducing the helper + migrating initializers, and (b) whether some convention/CI check should ensure new initializers call it.

### On Q7 — attestation `skipAuth: true` but tenant-gated (sent + answered 2026-04-23)

> since attestations use nft internally which for test purposes using the entity-storage version the data could be partitioned so it becomes tricky, we might have to remove the partitioning for entity-storage NFTs (since we are pretending we are on-chain like Identity) then you could use `skipTenant`, but then you would have to skipTenant for all the other routes as well, which in theory means you would see the NFTs from other tenants, but since there is no query method maybe that doesn't matter (and its only for testing with entity-storage anyway)

**Verdict:** the tension is real but cascading — making attestation truly publicly verifiable would require (a) dropping partitioning on entity-storage NFTs, (b) adding `skipTenant: true` to attestation GET, (c) doing the same for all NFT routes. Cross-tenant NFT visibility wouldn't actually leak data because there's no query method (you'd need the exact id).

**Fact-check:** Confirmed all four claims:

- NFT entity-storage variant partitions by `[Node, Tenant]` ([nft.ts:54-58](../../../../engine/packages/engine-types/src/components/nft.ts#L54-L58)).
- NFT IOTA variant doesn't partition (on-chain storage; no `initialiseEntityStorageConnector` call).
- NFT routes have zero `skipAuth`/`skipTenant` flags — all 5 routes (mint/resolve/burn/transfer/update) require both.
- NFT has no query/list method — only `resolve` (GET by id), confirming Martyn's "no query, knowing the id is required" point.

**What this doesn't decide:** the design comment / docs question. Does the "publicly verifiable" comment in attestation routes get updated to reflect the current "tenant-scoped verifiability" reality, or is the long-term intent to actually do the cascade and unlock public verification? Worth a follow-up.

### On Q9 — tenantId-encoded service endpoint (sent + answered 2026-04-23)

> performing is the encryption/decryption of the tenantId, we probably need to pass the authSigningKey into config for the tenantProcessor, same as the auth service (will need an engine update to pass the config)
> the encryption side is a bit tricky, not sure which service this should live inside, basically you need to pass a url and the tenantId and say add the encrypted query param
> the decryption side should just be a case of extending the tenantProcessor to support the encoded query string param as an alternative to api-key headers/query

**Verdict:** direction confirmed. URL encodes encrypted tenantId as query param. Decoder is a `TenantProcessor` extension. Engine config wiring follows the AuthHeader pattern. One open design point Martyn explicitly flagged: where the URL-encryption helper lives.

### On Q14 — Federated Catalogue partition (sent + answered 2026-04-23)

> I think the fedcat stays Node only partitioned, it synchronises from all the other tenants anyway so you can lookup their datasets (future cloud plans means this will probably be an independent centralised service with no synchronisation anyway)

**Verdict:** option (a) — FedCat stays `[Node]` only. RFC-005 doesn't need amendment. Cross-tenant catalogue access is by design (catalogue is a node-level aggregation). Future direction is a centralised cloud catalogue with no per-node partitioning at all, so flipping to `[Node, Tenant]` now would be churn we'd reverse later. Important consequence: this makes Q9 the _small_ version (1-2 days) — no FedCat schema flip. Q9 mechanism is still needed for negotiation routing into the right tenant's PAP/PNP.

### On Q13 — Rights management hard-depends on trust at engine init (sent + answered 2026-04-23)

> trust is a requirement, we could remove the TRUST_ENABLED flag, and in the node-core configureTrust method auto enable it if other components which require it are enabled e.g. pnp/synchronised storage/dataspace

**Verdict:** cleaner than the (a)/(b)/(c) options I proposed. Remove `TWIN_TRUST_ENABLED` entirely; `configureTrust` auto-enables when any dependent component is configured. Trust becomes an inferred dependency rather than a separately-managed flag — the right abstraction.

### Codebase verification of Martyn's batch 2 answers (2026-04-23)

Before scoping the implementation work, verified each of Martyn's references against the source.

**Q9 — engine config wiring pattern:** confirmed. AuthHeader processor at [engineServerEnvBuilder.ts:255-262](../../../../node/packages/node-core/src/builders/engineServerEnvBuilder.ts#L255-L262) receives `options.config.signingKeyName: envVars.authSigningKeyId`. Tenant processor at [156-161](../../../../node/packages/node-core/src/builders/engineServerEnvBuilder.ts#L156-L161) currently passes nothing. Adding the same `options.config` block is the exact mirror — ~5 lines for REST + 5 for socket processors.

**Q9 — URL helper home:** confirmed. `@twin.org/api-tenant-processor/src/utils/` already exists with `TenantIdHelper.ts` as sibling. New `TenantUrlHelper.ts` (encrypt/decrypt) is the natural fit — symmetrical with where decryption logic lives in the same package's `tenantProcessor.ts`. **Caveat:** the package doesn't currently depend on `@twin.org/vault-models` ([package.json](../../../../api/packages/api-tenant-processor/package.json) deps: api-models, context, core, entity, entity-storage-models, nameof, web only). Adding vault-models is a new dep edge but no circular risk (vault doesn't depend on tenant-processor).

**Q9 — query param naming:** convention is **camelCase**, not kebab. Verified across `actorId`, `organizationId`, `tenantId`, `cursor`, `nodeId`, `event`, `startDate`, `endDate`. Underscore prefix (`_tid`) appears nowhere. Critical: `tenantId` is **already taken** as a query param at [entityStorageAuthenticationAuditRoutes.ts:201](../../../../api/packages/api-auth-entity-storage-service/src/routes/entityStorageAuthenticationAuditRoutes.ts#L201) (used as a search filter, not for tenant context). The new encrypted-tenant param must use a different name. **Pick: `tenantToken`** — camelCase, available, signals "encrypted token, not raw id".

**Q9 — crypto incompatibility (NEW finding worth raising as a sub-question):** Martyn said "encryption/decryption" but the existing `auth-signing` key is bootstrapped as **Ed25519** at [bootstrapLegacy.ts:159](../../../../node/packages/node-core/src/commands/bootstrapLegacy.ts#L159) (asymmetric, JWT-only). The `IVaultConnector.encrypt()` API enforces a key-type match — at [entityStorageVaultConnector.ts:383-387](../../../../vault/packages/vault-connector-entity-storage/src/entityStorageVaultConnector.ts#L383-L387) it throws `keyTypeMismatch` if you try to encrypt with anything other than a `ChaCha20Poly1305` key. So the `auth-signing` key cannot be reused for symmetric encryption — this is the only thing left needing his decision. See Q15 in the follow-ups section.

**Q13 — full trust-dependent surface:** verified all callers across the workspace.

- **HARD (will throw if trust missing):**
  - [rightsManagementPnp.ts:47](../../../../engine/packages/engine-types/src/components/rightsManagementPnp.ts#L47) — `getRegisteredInstanceType("trustComponent")`
  - [synchronisedStorage.ts:67](../../../../engine/packages/engine-types/src/components/synchronisedStorage.ts#L67) — `getRegisteredInstanceType("trustComponent")`
  - `dataspace/apps/dataspace-rest-server/src/dataspaceControlPlane.ts:124` — `getRegisteredInstanceType("trustComponent")` (standalone DSP server, separate repo)
  - `dataspace/apps/dataspace-rest-server/src/dataspaceDataPlane.ts:154` — `getRegisteredInstanceType("trustComponent")` (standalone DSP server, separate repo)
- **SOFT (uses if available, no throw):**
  - [dataspaceControlPlane.ts:65](../../../../engine/packages/engine-types/src/components/dataspaceControlPlane.ts#L65) — engine-types CP variant
  - [dataspaceDataPlane.ts:83](../../../../engine/packages/engine-types/src/components/dataspaceDataPlane.ts#L83) — engine-types DP variant

`configureTrust` should auto-enable when **PNP, synchronised-storage, or dataspace** components are configured. Matches Martyn's list exactly. FedCat does NOT depend on trust.

**Q13 — env var removal style:** the project is at `0.0.3-next.X`, pre-1.0. Recent changelog entries (`#118 authentication services`, `#102 synchronised storage construction`) ship breaking changes without deprecation cycles. Conclusion: just remove `TWIN_TRUST_ENABLED` and document in changelog — no `no-op-with-warning` needed for this maturity level.

### Open follow-up threads (status as of 2026-04-23)

- **Q8 — infra-level health probes** _(open)_: if `/health` is intentionally tenant-scoped, what endpoint does a k8s liveness / Docker HEALTHCHECK / load balancer upstream check use? Is there a reserved node-level probe, or do all orchestration tools need a dedicated ops-tenant API key?
- **Q9 — tenantId-encoded service endpoint** _(answered 2026-04-23)_: Martyn confirmed direction — encrypted query param, decoder extends `TenantProcessor`, engine config wiring mirrors AuthHeader pattern. See "On Q9" section. **One sub-question still open: see Q15 below** (crypto key compatibility).
- **Q10 — ownership of the roles/scopes architecture doc** _(open)_: do we draft it or does it sit with him / the team?
- **Q11 (Q6 follow-up)** _(ready to send, lower priority)_ — ~30 call sites of `pickKeysFromAvailable` across engine-types. Worth opening a PR introducing `getDefaultPartitionKeys()` + migrating the standard `[Node, Tenant]` cases?
- **Q12 (Q7 follow-up)** _(ready to send, lower priority)_ — the attestation cascade trade-off (cascade for true public verification vs update the design comment).
- **Q13 — rights-management trust dependency** _(answered 2026-04-23)_: Martyn picked a cleaner option than my (a)/(b)/(c) — remove `TWIN_TRUST_ENABLED` flag entirely, `configureTrust` auto-enables when PNP/synchronised-storage/dataspace components are configured. Implementation is unblocked.
- **Q14 — FedCat partition** _(answered 2026-04-23)_: Martyn picked option (a) — FedCat stays `[Node]` only by design (catalogue is a node-level aggregation; future is centralised cloud catalogue with no node partitioning at all). RFC-005 unchanged.
- **Q15 — crypto key compatibility for Q9 implementation** _(decided locally 2026-04-23, option a)_: Martyn implied reusing `auth-signing` for URL-tenant encryption, but `auth-signing` is bootstrapped as Ed25519 (asymmetric) and `vaultConnector.encrypt()` enforces a `ChaCha20Poly1305` key-type match. After verifying codebase patterns we picked **option (a)** — bootstrap a new symmetric key (`tenant-url-encryption`, ChaCha20Poly1305) + new env var + `TenantProcessor` uses it via `vaultConnector.encrypt/decrypt`. Three signals all point the same way: (1) two existing `vaultConnector.encrypt` callers ([blobStorageService.ts:200](../../../../blob-storage/packages/blob-storage-service/src/blobStorageService.ts#L200), [blobStorageHelper.ts:171](../../../../synchronised-storage/packages/synchronised-storage-service/src/helpers/blobStorageHelper.ts#L171)) use the exact same shape; (2) no codebase precedent for HMAC-style signing of small tokens — Ed25519 is only used for JWTs which would be ~4× larger than ChaCha20Poly1305 ciphertext for a 16-byte tenant id; (3) Martyn's language was "encryption/decryption", which (a) honours and (b) reinterprets. The added bootstrap step + env var are trivial and match the existing `auth-signing` setup pattern. Sent confirmation Q15 to Martyn to lock in.

### Re-examining Q5, Q6, Q7 against the new context (updated 2026-04-22)

Questions 5, 6, and 7 were not in the first batch sent to Martyn. After Q5 turned out to be self-inflicted, we re-verified Q6 and Q7 empirically before sending:

- **Q5 — withdrawn (false positive).** Reply to Martyn confirming our setup mistake; no platform action needed. See Finding 5 for details.
- **Q6 — verified real.** Re-read `engineServerEnvBuilder.ts`: `tenantEnabled` only enables `x-api-key` in CORS, advertises `Tenant` in `availableContextIdKeys`, and registers `TenantProcessor`. No central storage-partition env var exists anywhere in `node-core` (`grep -rn "TWIN_.*PARTITION"` returns nothing). Per-component opt-in via `pickKeysFromAvailable([Node, Tenant])` is the only mechanism. Reframe to focus on whether this should be the default behaviour, given Martyn's _"they should all require tenantId"_ stance.
- **Q7 — verified real.** Code: `attestationRoutes.ts` has `skipAuth: true` on `GET /attestation/:id`. Live probe against the running test container: `curl http://localhost:3030/attestation/foo` → `401 tenantProcessor.missingApiKey`. So the route's own design intent (publicly verifiable) collides with the tenant gate. Reframe to ask which intent should win — the route should add `skipTenant: true` too, or the design comment should be updated.

## Confirmed findings to file

### Finding 1 — `/health`, `/info`, `/spec` are gated by `TenantProcessor`

Keyless probes to `/health` return 401 `tenantProcessor.missingApiKey`. This breaks Docker/Kubernetes health checks and orchestration probes unless every probe carries an API key. Standard practice is for `/health` to be a zero-auth public endpoint with `skipTenant: true` (and ideally `skipAuth: true`, which it already has).

Root cause at [informationRoutes.ts](../../../../api/packages/api-service/src/informationRoutes.ts): three routes (`/info`, `/health`, `/spec`) only had `skipAuth: true` but were missing `skipTenant: true`. The sibling routes `/`, `/favicon.ico`, `/livez` had both flags set. Clearly the same bug pattern across three definitions.

**Original analysis (superseded):** added `skipTenant: true` to the three routes locally, rebuilt, verified `GET /health` returns 200 without a key.

**2026-04-21 — Lead Dev verdict: INTENTIONAL, not a bug.** Martyn: _"they should all require tenantId, why should we allow access to any of the APIs in a multi-tenant setup to anyone that doesn't have a valid tenantId (the exceptions being the negotiation/DP endpoints) ... if you have components that are separated by tenant e.g. different DBs you only want the health for your components"_.

Rationale: in a real multi-tenant deployment tenants may have separate infrastructure, so health must be tenant-scoped. A keyless probe can't report anything meaningful — whose storage? whose DB? The existing behaviour is correct; our patch was wrong.

**Action:** revert the `skipTenant: true` addition to `informationRoute`, `healthRoute`, `specRoute` in `api-service/src/informationRoutes.ts`, rebuild, confirm `/health` returns 401 again on a keyless probe.

**New follow-up (Q8):** how should infra-level probes (Docker HEALTHCHECK, k8s liveness, load balancer upstream checks) work if `/health` is tenant-scoped? Probably needs a reserved node-level probe, or an "ops" tenant convention. Not answered yet.

Severity: no platform bug here after all — our test scaffold just needs to stop sending keyless health probes.

### Finding 2 — No REST path to create users in arbitrary tenants

`POST /authentication-admin/users` requires `user-admin` scope plus `tid` match between JWT and tenant context ([authHeaderProcessor.ts:122](../../../../api/packages/api-auth-entity-storage-service/src/processors/authHeaderProcessor.ts#L122)). The node admin's JWT always has `tid = nodeTenantId`, so calling with `x-api-key = someOtherTenant` will always fail with `tenantIdMismatch`. There is no code path today that lets an admin create users across tenants via REST.

**CLI workaround is now wired into `setup.sh` (2026-04-20):** Step 4 performs `node-set-tenant → user-create → node-set-tenant` for each target tenant, reusing the node's own DID as the user and organization identity (fine for isolation testing — users are keyed by email and tenant partition, not by DID uniqueness). A trap ensures the node tenant is restored even on failure.

**Isolation proven end-to-end via the CLI workaround:**

- `admin@mobius-freight` logging in with Tenant A's key → `200 OK` with a JWT.
- Same credentials logging in with Tenant B's key → `401 entityStorageAuthenticationService.userNotFound` (wrapped in `loginFailed`).
- The error path is the storage query returning empty — confirming the partition filter is active on user lookups, not just on middleware.

So the foundation works. The CLI approach proves the primitive but is awkward for any admin UI and burns IOTA if the user DID is not reused.

**2026-04-21 — Lead Dev verdict: open design question, needs a roles/scopes architecture doc.** Martyn: _"it all depends on how we want to treat node-admins, at the moment they still have an org association as well which might not be correct (do we actually need a node-admin, or should they be a tenant-admin?) or we could potentially use scopes with a new node-admin value, if set this would allow an override tid to be sent in the queryparams ... This should probably form the basis for an architecture document on roles/scopes etc"_.

**Action:** keep the CLI workaround in `setup.sh` — Martyn explicitly didn't rule it out, and there's no better-defined path today. Track the architecture doc deliverable as a separate work item (ownership Q10 below).

Severity: medium UX gap, waiting on a roles/scopes architecture decision to resolve properly.

### Finding 3 — Control Plane vs Data Plane `TransferProcess` partitioning disagreement

Both planes register the same entity name with different `partitionContextIds`; the second registration is silently dropped by `initialiseEntityStorageConnector`. Dormant today because without `TWIN_TENANT_ENABLED=true` both sides degenerate to `[Node]` and accidentally agree. Activates the moment any production node enables tenancy.

**Upgraded understanding (2026-04-20):** the comment at [dataspaceControlPlane.ts:44](../../../../engine/packages/engine-types/src/components/dataspaceControlPlane.ts#L44) reads `// Partition by Node only - transfers are cross-tenant operations`. That suggested CP's choice was deliberate and DP's was the outlier. Our proposed fix at the time was to align DP down to `[Node]`.

**2026-04-21 — Lead Dev verdict: align CP UP to `[Node, Tenant]`.** Martyn: _"I think it should be [Node, Tenant] in both places, I don't think one tenant should know about the transfers for another tenant"_. So the correct fix is the opposite of our initial gut — the CP comment represents outdated reasoning, not the current design.

On the framework-level helper, Martyn confirmed: _"I thought the initialize skipped if it already existed, but yes it could lookup to see if there is a mismatch"_. Green light to propose a conflict check in `initialiseEntityStorageConnector`.

**A second architectural thread Martyn opened:** _"more to the point is the policy/defcat tables and how they are partitioned, they should really be partitioned by tenant (for admin purposes), but then how does a negotiation lookup the correct dataset (we might need to include an encoded version of the tenantId in the service endpoint that is published that can be decoded)"_. This is the mechanism that unblocks the Kenya same-node DSP flow — tracked as Q9.

**Action applied locally (2026-04-21):** changed `partitionContextIds` in `dataspaceControlPlane.ts` from `[ContextIdKeys.Node]` to `[ContextIdKeys.Node, ContextIdKeys.Tenant]`. Replaced the superseded `// Partition by Node only - transfers are cross-tenant operations` comment with a new one noting the shared-storage alignment with DP and citing the 2026-04-21 Lead Dev decision. Rebuilt `engine-types` (`npm run build`) so `dist/es/components/dataspaceControlPlane.js` reflects the change. Ready to PR against the `engine` submodule.

**Not yet shipped into this test's Docker image** because our Dockerfile doesn't override `@twin.org/engine-types` (we only override the api and node packages). Our test suite doesn't exercise DSP, so the fix doesn't affect the current green run — but any image that picks up the rebuilt `engine-types` will have it.

**Separate follow-up still pending:** propose the conflict-check improvement in `initialiseEntityStorageConnector` (throw on duplicate registrations with differing partition keys).

Severity: real bug, answer confirmed, fix applied in source, pending PR.

### Finding 4 — `AuthHeaderProcessor` 401 is masked as a 500 to clients

When a request hits an auth-required route with a valid JWT but a mismatched `x-api-key` (e.g., `x-api-key=tenantA + JWT.tid=tenantB`), `AuthHeaderProcessor` correctly throws `tenantIdMismatch` and the response _should_ be `401`. Internally everything is fine — the server log shows:

```text
LoggingProcessor <=== 401 POST /attestation duration: 5394µs
FastifyWebServer The web server could not handle the request {
  name: 'GeneralError',
  source: 'AuthHeaderProcessor',
  message: 'authHeaderProcessor.tenantIdMismatch'
}
```

But the client receives **HTTP 500**, not 401. Something in `FastifyWebServer`'s outer error handler runs after the pre-processor has already set the 401 response, and overrides the status code with 500. The 7ms gap between the LoggingProcessor's 401 line and the "could not handle" line is the override window.

**Why it matters:** the security boundary is intact — the request is rejected at the auth layer in ~5ms, well before any handler runs, and no attestation is created. But:

- API consumers can't distinguish auth/tenant problems (which they can fix) from server crashes (which they can't).
- Monitoring/alerting on 5xx will treat normal cross-tenant rejections as platform errors.
- Anyone debugging a misconfigured client will follow the wrong trail.

Reproduced reliably during this test run via `mt-test.sh` Phase 6.

**2026-04-21 — Lead Dev verdict: confirmed bug, was believed fixed previously.** Martyn: _"that sounds like a bug, maybe something is catching and rethrowing the error wrapped, there were some issues around this before that Rodrigo spotted, but I thought they were fixed"_.

**Root cause traced (2026-04-21):**

`AuthHeaderProcessor.pre()` in [authHeaderProcessor.ts:99-136](../../../../api/packages/api-auth-entity-storage-service/src/processors/authHeaderProcessor.ts#L99-L136) catches its own errors internally, including the `tenantIdMismatch` throw at line 123:

```typescript
} catch (err) {
    const error = BaseError.fromError(err);
    HttpErrorHelper.buildResponse(response, error, HttpStatusCode.unauthorized);
}
```

Meanwhile `runProcessorsRest` in [fastifyWebServer.ts:551-632](../../../../api/packages/api-server-fastify/src/fastifyWebServer.ts#L551-L632) uses a `hasPreError` flag that is only set to `true` when the pre loop's try/catch fires — i.e., only when a pre-processor actually throws:

```typescript
try {
    for (const routeProcessor of filteredProcessors) {
        await pre(...);                // AuthHeaderProcessor catches its own throw, returns normally
    }
} catch (err) {
    hasPreError = true;               // never reached
}

if (!hasPreError) {
    // Run route handler — which then overwrites the 401 with its own response/error
}
```

Because `AuthHeaderProcessor.pre()` swallows its own throw, no error escapes the outer try/catch, `hasPreError` stays `false`, and the route handler runs anyway. The handler then sets its own response (either a 5xx when it blows up because auth context isn't populated, or a 2xx in the worst case) and overwrites the 401 that `AuthHeaderProcessor` carefully put in place.

**Fix options (both valid, (b) is less invasive):**

- **(a) Make pre-processors re-throw after setting an error response** — convention: if you built a response and set a non-2xx status code, you also throw so `runProcessorsRest` halts the chain. Cleaner, but ripples across every pre-processor.
- **(b) Make `runProcessorsRest` check response state after the pre loop** — after the for loop, if `httpResponse.statusCode >= 400` set `hasPreError = true`. One-line change in `runProcessorsRest`, no ripples. Catches this whole bug class in one place.

**2026-04-22 — Root cause identified and fixed.**

After deeper investigation the REAL cause of the 401→500 mask was found: **`HttpErrorHelper.buildResponse` was setting `response.body = error` where `error` is a `BaseError` instance (which extends `Error`).** Fastify has special behaviour for `reply.send(errorInstance)` — when the argument is an `Error`, Fastify routes it through `setErrorHandler`, bypassing the configured status code and producing a 500. Instrumented trace that proved it:

```text
body-instanceof-Error=true  body-preview={"source":"AuthHeaderProcessor","name":"GeneralError"}
setErrorHandler FIRED       (between reply.status(401).send() and return)
```

**Fix applied (root-cause level, 2026-04-22):** `api/packages/api-models/src/helpers/httpErrorHelper.ts` — `buildResponse` now converts Error instances to plain serialisable `IError` objects before setting `response.body`:

```typescript
response.body = BaseError.fromError(error).toJsonObject();
```

`BaseError.fromError(unknown)` normalises any input (BaseError, plain Error, or IError-shaped object) into a BaseError, and `.toJsonObject()` emits a plain IError. One line, no `instanceof` checks (disallowed by the project lint config).

This is the proper architectural fix: response bodies should never be Error instances because most HTTP frameworks (not just Fastify) treat them specially. Any caller that previously passed an Error object to `buildResponse` now gets a plain object response.

**Secondary fix also applied (defence in depth, `fastifyWebServer.ts`):** invariant check after the pre loop that sets `hasPreError = true` when `httpResponse.statusCode >= 400`. This catches any pre-processor that builds an error response without throwing upward, regardless of body type. Cheap safety net that complements the root-cause fix — keeping both.

**Verification:** Phase 6 now returns HTTP 401 to the client (previously 500). `mt-test.sh` Phase 6 tightened — now fails the test if 500 returns (treats it as a regression of the `buildResponse` fix). All 8 phases of `mt-test.sh` pass against the cleaned-up code.

**Status:** RESOLVED. Both fixes ship together in one PR against the `api` submodule.

Severity: cosmetic-but-misleading for security (boundary intact); real correctness bug for status-code-dependent clients.

### Finding 5 — _withdrawn_ — was a self-inflicted issue in our test scaffold, not a platform bug

**Originally reported (2026-04-20):** `bootstrap-legacy` doesn't create the `attestation-assertion` verification method needed for attestation. First attestation call returned 500 `iotaIdentityConnector.createVerifiableCredentialFailed`. We added Step 5 to `setup.sh` to call `identity-verification-method-create` manually as a workaround.

**Withdrawn (2026-04-22) after deeper investigation:** bootstrap **does** create the attestation VM correctly. Two facts settle it:

- [bootstrapLegacy.ts:266](../../../../node/packages/node-core/src/commands/bootstrapLegacy.ts#L266) calls `identityVerificationMethodCreate({ identity: organisation.did, verificationMethodId: "attestation-assertion", ... })` when the attestation connector is registered. Confirmed by a fresh-bootstrap experiment — the bootstrap output prints `Creating attestation method for organisation identity` followed by the VM details.
- [attestationService.ts:87-90](../../../../attestation/packages/attestation-service/src/attestationService.ts#L87-L90) signs with `contextIds[ContextIdKeys.Organization]` (the user's organisation DID from the JWT `org` claim) — not the node DID.

**Why we hit the false positive:** our `setup.sh` Step 4 creates per-tenant users with `--organization-identity="${NODE_DID}"`, reusing the node DID instead of the actual organisation DID. The JWTs we issue therefore carry `org=NODE_DID`. The attestation service tries to sign with `NODE_DID#attestation-assertion`, but bootstrap created the VM on the _real_ organisation DID (a different DID). Sign fails. Step 5 was creating a duplicate VM on the node DID to compensate for our own non-standard user setup.

**What this means:**

- Bootstrap is correct; nothing to fix in the platform.
- Our `setup.sh` Step 4 is non-standard but works. Step 5 is a test-scaffold workaround for that, not a platform fix.
- A cleaner test would either (a) read the actual organisation DID from `engine-state.json` after bootstrap and pass it as `--organization-identity` for tenant users, or (b) keep Step 5 as a documented compensating shim.
- **Q5 to the Lead Dev was a false alarm.** Reply: confirmed self-inflicted, no action needed on his side.

Severity: none (operator error during test scaffolding).

### Finding 6 — `TWIN_TENANT_ENABLED=true` doesn't centrally partition storage

The env flag does two things only ([engineServerEnvBuilder.ts:148-160](../../../../node/packages/node-core/src/builders/engineServerEnvBuilder.ts#L148-L160)): adds `Tenant` to `availableContextIdKeys`, registers `TenantProcessor` and `TenantAdminComponent`. It does **not** configure any entity-storage connector to partition by Tenant. Each component initializer in `engine-types/src/components/` decides independently via `ContextIdHelper.pickKeysFromAvailable(engineCore.getContextIdKeys(), [ContextIdKeys.Node, ContextIdKeys.Tenant])`.

Audit of sampled initializers:

| Component                                                                                                                         | Hardcoded list   | Tenant-aware when flag is on?                |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------- |
| NFT ([nft.ts:49-58](../../../../engine/packages/engine-types/src/components/nft.ts#L49-L58))                                      | `[Node, Tenant]` | Yes                                          |
| Identity Profile ([identityProfile.ts:46-55](../../../../engine/packages/engine-types/src/components/identityProfile.ts#L46-L55)) | `[Node, Tenant]` | Yes                                          |
| Data Plane `TransferProcess`                                                                                                      | `[Node, Tenant]` | Yes                                          |
| Identity DID document ([identity.ts:66-71](../../../../engine/packages/engine-types/src/components/identity.ts#L66-L71))          | `[]`             | **No — never partitioned**                   |
| Control Plane `TransferProcess` (after 2026-04-21 fix)                                                                            | `[Node, Tenant]` | Yes — was `[Node]` only before Finding 3 fix |

**Why this matters:** turning `TWIN_TENANT_ENABLED=true` on in production does not mean all data is tenant-isolated — it means only the components whose initializers happened to opt in are. Any new entity type added by any contributor has to remember to include Tenant. The failure mode is silent: data just lands in the root/node partition and leaks across tenants with no error.

**Three possible intervention points:**

- Invert the default — when Tenant is an available context key, all entity-storage connectors include it in their partition list unless an explicit opt-out is declared (`partitionContextIds: [Node]` or `[]`).
- Central config — one env var `TWIN_TENANT_PARTITION_KEYS` that all component initializers read.
- Status quo + audit gate — every new component initializer must declare a partition choice as part of its PR description, and CI checks for `pickKeysFromAvailable` usage.

**2026-04-23 — Lead Dev verdict: introduce `getDefaultPartitionKeys()` helper.** Martyn proposes a getter so most initializers become `pickKeysFromAvailable(getDefaultPartitionKeys())` and only outliers (Identity DID) hardcode their own list. Per-component opt-in stays; the helper just makes the standard case ergonomic.

**What this leaves open:** the helper doesn't enforce partitioning by default — a new initializer that forgets to call the helper still gets no partitioning. Worth a follow-up Q on whether (a) someone should open a PR to introduce the helper + migrate initializers, and (b) whether a CI check or PR-review convention should ensure new initializers use it.

Severity: architectural. Direction confirmed; mechanism is the next decision.

### Finding 7 — Attestation GET is `skipAuth: true` but still tenant-gated — breaks "publicly verifiable" story

`GET /attestation/:id` has `skipAuth: true` ([attestationRoutes.ts:263](../../../../attestation/packages/attestation-service/src/attestationRoutes.ts#L263)). The intent is that attestations are **publicly verifiable** — they carry their own JWT proof chain, so anyone with the ID can verify the attestation authentically without authenticating to the server.

But `TenantProcessor` still fires on the route. That means:

- A keyless GET returns `401 tenantProcessor.missingApiKey` — not publicly callable at all.
- A GET with `x-api-key=B` against Tenant A's attestation returns `404` — the partition filter hides the record.

Net effect: only a caller who has the right tenant's API key can even **find** the attestation to verify. The "publicly verifiable" property the design declared is effectively cancelled by the tenant gate.

**Two possible resolutions, both legitimate:**

- GET route should also have `skipTenant: true` — attestations become truly universally verifiable; anyone with the ID can fetch and check the proof. Consistent with the original design intent, but means attestations published by Tenant A leak discoverability outside the tenant (the proof itself is still self-contained, but the existence of the record becomes public).
- Keep the tenant gate and re-frame — attestations are "verifiable by any peer already inside the owning tenant". That's a valid model for regulated multi-tenant deployments, but the design notes and API docs should be updated because the current wording promises something else.

**2026-04-23 — Lead Dev verdict: cascade required if we want true public verification.** Martyn's reasoning (fact-checked against the code):

- Attestation delegates to NFT.
- Entity-storage NFT variant partitions by `[Node, Tenant]`; IOTA NFT variant doesn't (on-chain).
- True public verification requires (a) dropping partitioning on entity-storage NFTs to mimic on-chain, (b) `skipTenant: true` on attestation GET, (c) `skipTenant: true` on all NFT routes too.
- Cross-tenant NFT visibility wouldn't actually leak data because there's no query method (you'd need the exact id).

Net: he's not picking a side, but acknowledges the cascade. The decision is whether the cascading work is worth doing or whether we update the design comment to reflect "tenant-scoped verifiability" as the current behaviour.

Severity: product/design tension. Decision pending — needs a follow-up to commit to one direction.

### Finding 8 — Pre-processors run outside `ContextIdStore.run`, so tenant-scoped storage lookups fail

**Surfaced 2026-04-22** after pulling the latest api submodule (which merged commits #93 auth enhancements and #88 auth header processor use entity storage directly).

In the updated `AuthHeaderProcessor.pre()`, the `verifyUser` callback does a tenant-scoped entity lookup:

```typescript
const user = await this._userEntityStorage.get(userIdentity, 'identity');
if (user?.identity === userIdentity) validParts.push('user');
```

The entity storage connector resolves partitions by reading `ContextIdStore.getContextIds()` (async-local). But in `runProcessorsRest`, only the **process** loop is wrapped in `ContextIdStore.run(contextIds, ...)` — the **pre** loop runs outside it. So during `AuthHeaderProcessor.pre()` the async context is empty, the lookup hits the root partition, finds nothing, and `TokenHelper.verify` throws `userNotVerified`.

This breaks every legitimate request as soon as `TWIN_TENANT_ENABLED=true` on the latest api codebase. Our test's Phase 2 (Tenant A's own attestation create) failed with 401 `userNotVerified` after the pull, even though Tenant A's user correctly exists in Tenant A's partition.

**Fix applied locally (2026-04-22):** wrap the pre loop in `ContextIdStore.run(contextIds, ...)` the same way the process loop already is. `contextIds` is passed by reference, so values added by earlier pre-processors (TenantProcessor setting `Tenant` mid-loop) are visible to later pre-processors (AuthHeaderProcessor looking up users).

**Verified:** after the fix, all 8 phases of `mt-test.sh` pass again. Tenant-scoped user lookups now resolve against the correct partition during `pre`.

Severity: correctness bug introduced by the recent auth enhancements PR. Without this fix, the current api/next branch is broken for any multi-tenant deployment. Fix is defensive and consistent with how the process loop already works.

## Secondary observations

- The `source .node-password .tenants` pattern does not source both files — `source` takes one argument, subsequent args become positional params for that sourced file. `setup.sh` should emit a single file or the docs should show two separate `source` lines. Non-critical.
- `data-space-connector/` folder was renamed upstream to `dataspace/`. The two test Dockerfiles that referenced the old path have been updated; old folder can be deleted.

## Session state snapshot (2026-04-22)

For context continuity across compactions.

### Submodule states

| Submodule                | Branch                                         | HEAD                                                 | Uncommitted changes                                                                                                                                                          | Notes                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`                    | `next`                                         | `881862f` (pulled & merged to origin/next)           | `packages/api-models/src/helpers/httpErrorHelper.ts` (Finding 4 root cause) + `packages/api-server-fastify/src/fastifyWebServer.ts` (Finding 4 defence-in-depth + Finding 8) | Pull brought in auth enhancements + user-entity-storage refactor. `node_modules` reinstalled, dist rebuilt, debug logs cleaned up, `npm run lint:code` green, full `npm run test` passes (169 tests). |
| `engine`                 | `next`                                         | `19cd1b7` (up to date with origin/next at pull time) | `packages/engine-types/src/components/dataspaceControlPlane.ts` — Finding 3 fix ([Node, Tenant] alignment)                                                                   | dist rebuilt. Not present in multiTenancyDocker Dockerfile overrides.                                                                                                                                 |
| `node`                   | `feature/n2n-docker-test-with-pnp-negotiation` | `fd1a7c4 chore: merge next` (merged origin/next)     | mobius+nodeToNode\* test scaffold changes (dataspace rename path updates)                                                                                                    | stash@{0} contains "mobius Dockerfile + env tweaks (dataspace rename)" (pre-merge state).                                                                                                             |
| workspace (superproject) | `next`                                         | `803593d`                                            | multiTenancyDocker test folder, kenyaCommunityNodeDocker test folder, dataspace rename fixups in test docs                                                                   | submodule pointers ahead of superproject (submodules show `+` in `git submodule status`).                                                                                                             |

### Local code changes applied

1. **api/packages/api-service/src/informationRoutes.ts** — no uncommitted diff. Earlier we added `skipTenant: true` to info/health/spec; after Martyn's verdict we reverted. Tree is back to upstream state.
2. **api/packages/api-server-fastify/src/fastifyWebServer.ts** (MODIFIED):
   - Finding 4 fix: added post-pre-loop check that sets `hasPreError = true` when `httpResponse.statusCode >= 400` even if no error escaped upward.
   - Finding 8 fix: wrapped the pre loop in `ContextIdStore.run(contextIds, ...)` so tenant-scoped storage lookups resolve correctly during pre.
   - Still contains `[DEBUG-FW]` console.log lines — remove before PR.
3. **engine/packages/engine-types/src/components/dataspaceControlPlane.ts** (MODIFIED) — Finding 3 fix: `partitionContextIds` changed from `[Node]` to `[Node, Tenant]`, comment rewritten to reference the 2026-04-21 Lead Dev decision. Ready for PR.

### Dockerfile state (multiTenancyDocker/Dockerfile)

Currently overrides from local source:

- `node/packages/node-core`
- `api/packages/api-core`
- `api/packages/api-service`
- `api/packages/api-server-fastify` (added during Finding 4 debugging)
- `api/packages/api-tenant-processor`
- `api/packages/api-auth-entity-storage-service`
- `api/packages/api-auth-entity-storage-models` (added after pull)
- `api/packages/api-auth-entity-storage-rest-client` (added after pull)
- `api/packages/api-models`
- `framework/packages/entity`

Not overridden (but possibly should be after next pulls):

- `engine/packages/engine-types` — Finding 3 fix only lands in Docker if this is added.
- Any new package added upstream that depends on bumped transitive deps.

### Test state

All 20 phases of `mt-test.sh` pass (8 original + 7 added in Tier 1 + 5 added in Tier 2):

1. Phase 0 — /health tenant-gated (keyless→401, keyed→200). ✓
2. Phase 1 — per-tenant user login. ✓
3. Phase 2–3 — attestation create per tenant. ✓
4. Phase 4–5 — read-your-own / cannot-read-other. ✓
5. Phase 6 — cross-tenant JWT rejection, now returns HTTP 401 to the client (previously 500 before the `HttpErrorHelper.buildResponse` fix). ✓
6. Phase 7 — missing x-api-key rejection. ✓
7. Phase 8 — on-disk NFT partition keys differ. ✓
8. Phase 9–10 — Tier 1: NFT direct mint per tenant (`POST /nft/`). ✓
9. Phase 11 — Tier 1: NFT resolve cross-tenant isolation (own→200, peer→404). ✓
10. Phase 12–13 — Tier 1: identity-profile write per tenant via PUT (user-create auto-provisions an empty profile, so PUT updates it; falls back to POST for older builds). ✓
11. Phase 14 — Tier 1: identity-profile cross-tenant isolation. Both tenant users share the same identity DID (node DID, see setup.sh Step 4); each tenant's GET resolves to its own profile because of `[Node, Tenant]` partitioning. ✓
12. Phase 15 — Tier 1: on-disk identity-profile partition keys (3 distinct: node tenant + Tenant A + Tenant B). ✓
13. Phase 16–17 — Tier 2: ODRL policy create per tenant via `POST /rights-management/policy/admin`. ✓
14. Phase 18 — Tier 2: PAP get-by-id cross-tenant isolation (own→200, peer→404). ✓
15. Phase 19 — Tier 2: PAP list-endpoint cross-tenant isolation (each tenant's list contains its own policy id, excludes the peer's — only bulk-leak vector). ✓
16. Phase 20 — Tier 2: on-disk `odrl-policy/store.json` shows 2 distinct partition keys. ✓

### Test coverage gaps (deliberately out of scope, but worth tracking)

The current test proves the multi-tenancy foundation works for one vertical. Several scopes of "multi-tenancy works" are NOT covered yet — none of these are broken, just unverified by our test. Worth picking off when we want broader confidence:

- ~~**Other entity types beyond attestation.**~~ **Partially closed by Tier 1 + Tier 2 (2026-04-22):** mt-test.sh now exercises NFT direct (Phases 9–11), identity-profile (Phases 12–14), and rights-management `OdrlPolicy` (Phases 16–18), all of which partition correctly with `[Node, Tenant]`. Remaining unverified entity types: auditable-item-graph, auditable-item-stream, telemetry. Same low-effort extension pattern if/when needed.
- **Same-node cross-tenant DSP** (Kenya use case). KRA tenant publishes a consignment, Trader tenant negotiates and pulls from the same node. Parked on Q9 (tenantId-encoded service endpoint design) — needs platform decision before scaffolding the test.
- ~~**Per-tenant rights management / ODRL policies.**~~ **Closed by Tier 2 (2026-04-22):** mt-test.sh Phases 16–19 verify per-tenant ODRL Set policies are created via PAP, isolated cross-tenant on read, and visibly partitioned on disk. Engine partition for `OdrlPolicy` is `[Node, Tenant]` ([rightsManagementPap.ts:48-51](../../../../engine/packages/engine-types/src/components/rightsManagementPap.ts#L48-L51)) and now demonstrably enforced end-to-end. PNP/PEP not exercised — they store no data, they're runtime negotiation/enforcement; partition isolation isn't a meaningful surface for them.
- **Per-tenant federated catalogue.** Each tenant's catalogue entries should partition correctly. Engine currently uses `[Node]` only on federated catalogue ([federatedCatalogue.ts:47](../../../../engine/packages/engine-types/src/components/federatedCatalogue.ts#L47)) — that's an open design question (is the catalogue meant to be node-shared or per-tenant?). Important for the Kenya use case.
- **Cross-node multi-tenancy.** Two nodes, each with their own tenants, federating data. Currently no test covers this combination — `mobiusSupplyChainDocker` does multi-node but single-tenant per node.
- **MySQL / PostgreSQL connectors.** The earlier MySQL question turned out to be developer misconfiguration. Worth a sanity test against a real SQL connector to verify partitioning behaves identically to the file/memory connectors we use today. Low priority.

## Next steps

Current state after Lead Dev response (2026-04-21) and local fixes applied (2026-04-22): 3 findings locally fixed and ready to PR, 3 pending reframe, plus follow-up threads.

### Ready to PR / open issue

- [x] **Finding 3 — DONE 2026-04-22**, engine PR #102 (commit `b651361`). CP `TransferProcess` aligned to `[Node, Tenant]`, both planes match. Confirmed in published `engine-types@0.0.3-next.31` and verified via mobiusSupplyChainDocker Tier 0 regression run.
- [x] **Finding 4 — DONE 2026-04-22**, shipped in `api-models@0.0.3-next.26` and `api-server-fastify@0.0.3-next.26`. Root-cause fix in `httpErrorHelper.ts` + `hasPreError` invariant check in `fastifyWebServer.ts`.
- [x] **Finding 8 — DONE 2026-04-22**, shipped in `api-server-fastify@0.0.3-next.26` alongside Finding 4. `ContextIdStore.run` now wraps the pre-loop.
- [ ] **Framework-level improvement**: make `initialiseEntityStorageConnector` throw on duplicate registrations with differing `partitionContextIds`, instead of silently dropping the second. Martyn-approved. Small, self-contained PR against `engine`.

### Resolved / no further action needed

- [x] **Finding 1 — reverted.** `/health`, `/info`, `/spec` tenant-gating is intentional per Martyn. Local patch and dist rebuild are reverted. mt-test.sh Phase 0 updated to test the gate as intended.
- [x] **Application-level isolation proven.** All 8 phases of `mt-test.sh` pass: auth isolation, attestation round-trip isolation, cross-tenant JWT rejection, missing-key rejection, distinct on-disk partition keys.
- [x] **Finding 8 identified and fixed locally.** Caused by `ContextIdStore.run` only wrapping the process loop; fix wraps pre loop too. Without this, the current `api/next` branch is broken on any multi-tenant deployment.

### Pending reframe before Slack follow-up

- [ ] **Question 5 (bootstrap + verification methods)** — unaffected by Martyn's answers. Can send as-is.
- [ ] **Question 6 (central partitioning policy)** — Martyn's _"they should all require tenantId"_ view partially answers the principle. Reframe to focus on the mechanism: should `TWIN_TENANT_ENABLED=true` default to tenant-aware partitioning across all connectors, or stay per-component opt-in?
- [ ] **Question 7 (attestation GET publicly-verifiable vs tenant-gated)** — Martyn's exception list for tenant-free access is _"negotiation/DP endpoints"_ only. Attestation isn't in that list, so the tenant gate on attestation GET is almost certainly intentional. Reframe to ask whether the "publicly verifiable" comment in attestation design docs should be updated, not whether to change the route.

### Follow-up threads opened by Martyn's responses

- [ ] **Q8** — infra-level probe mechanism in multi-tenant deployments. How should k8s liveness / Docker HEALTHCHECK / LB upstream checks work if `/health` is tenant-scoped?
- [ ] **Q9** — design of the "tenantId-encoded service endpoint" that Martyn floated for cross-node negotiation resolution. Load-bearing for the Kenya same-node DSP flow.
- [ ] **Q10** — ownership of the roles/scopes architecture doc (Q2 deliverable).

### Deferred

- **Kenya use case test scaffold.** Depends on Q9 (encoded tenant endpoint) being decided. Revisit after Martyn confirms direction.
- **UK MVP use case test scaffold.** Independent of Kenya; scope TBD.
- **Roles/scopes architecture doc** itself (the deliverable Martyn named in Q2 response).

### Expansion ladder for broader coverage

Concrete tiers mapped to the "Test coverage gaps" above. Easiest first; each tier independently valuable.

- **Tier 0 — regression check (15 min, zero code). DONE 2026-04-22.** Ran `mobiusSupplyChainDocker` end-to-end against the new published packages (api-models@0.0.3-next.26 with the `httpErrorHelper` fix, api-server-fastify@0.0.3-next.26 with the `ContextIdStore.run` pre-loop wrap + `hasPreError` invariant, engine-types@0.0.3-next.31 with CP `TransferProcess` partition `[Node, Tenant]`). All 12 phases of the mobius supply-chain test passed. Confirms our engine + api PRs did not regress the existing multi-node DSP flow.
- **Tier 1 — more entity types in single-node multi-tenant. DONE 2026-04-22.** Extended `mt-test.sh` from 8 to 15 phases. Phases 9–11 cover NFT direct (mint via `POST /nft/`, resolve via `GET /nft/:id`, cross-tenant isolation). Phases 12–14 cover identity-profile (`PUT /identity/profile/` to set a tenant-distinguishing name on the profile that `user-create` auto-provisions, `GET /identity/profile/` returns each tenant's own name, never the other's). Phase 15 inspects on-disk partition keys for `identity-profile/store.json` (found 3 distinct partitions: node-admin tenant + Tenant A + Tenant B). All 15 phases pass against the published packages. Confirms `[Node, Tenant]` partitioning works end-to-end for both entity types.
- **Tier 2 — add rights management on the single-node multi-tenant scaffold. DONE 2026-04-22.** Enabled `TWIN_RIGHTS_MANAGEMENT_ENABLED=true` (with `TWIN_TRUST_ENABLED=true` — the PNP service depends on `trustComponent` at engine init even when the test only exercises PAP; surfaced as Q13 below). Extended `mt-test.sh` from 15 to 20 phases. Phase 16–17 create per-tenant ODRL Set policies via `POST /rights-management/policy/admin`; Phase 18 confirms get-by-id cross-tenant isolation (own→200, peer→404); Phase 19 confirms list-endpoint cross-tenant isolation (own id present, peer id absent — the only bulk-leak vector); Phase 20 inspects `/app/data/odrl-policy/store.json` and finds 2 distinct partition keys. All 20 phases pass. Confirms `[Node, Tenant]` partitioning works for `OdrlPolicy` end-to-end. PNP itself stores no data, but PNAP partitions `PolicyNegotiation` by `[Node, Tenant]` and passes `tenantAdminType` + `partitionContextIds` into the service ([rightsManagementPnap.ts:43-66](../../../../engine/packages/engine-types/src/components/rightsManagementPnap.ts#L43-L66)) — meaning it's engineered for multi-tenancy more thoughtfully than PAP. A same-node cross-tenant negotiation test fits naturally inside Tier 4 (Kenya same-node DSP) rather than Tier 2.
- **Tier 3 — federated catalogue on the single-node multi-tenant scaffold (half to full day).** Enable `TWIN_FEDERATED_CATALOGUE_ENABLED=true`, seed per-tenant catalogue entries. Forces the open design question: federated catalogue currently uses `[Node]`-only partition ([federatedCatalogue.ts:47](../../../../engine/packages/engine-types/src/components/federatedCatalogue.ts#L47)) — is that right? Test produces a clear "passes / fails because catalogue is node-shared" result.
- **Tier 4 — same-node cross-tenant DSP (day+).** Fork scaffold into `kenyaCommunityNodeDocker/`, enable `TWIN_DATASPACE_ENABLED=true`, attempt KRA publishes → Trader pulls flow on one node. **Path now unblocked (2026-04-23):** Q9 (tenantId-encoded endpoint) and Q14 (FedCat partition stays `[Node]`) both answered by Martyn. Implementation work for Q9 is the gating item — once shipped, Tier 4 test scaffolding can begin. Q15 (crypto choice) is the only remaining blocker on the implementation side.
- **Tier 5 — multi-node multi-tenant (day+).** Fork into `ukMvpDocker/` or similar, full cross-node federation with tenants on each side. Represents the UK MVP / Kenya target state. Depends on Tier 4 working.

## How to reproduce

From `node/apps/node/tests/multiTenancyDocker/`:

```bash
./setup.sh                     # build, bootstrap, create two tenants
docker compose up -d
sleep 5

source .node-password
source .tenants
NODE_API_KEY="<read from /app/data/tenant/store.json, isNodeTenant:true entry>"

# Proof 1 — TenantProcessor active
curl -si -X POST http://localhost:3030/authentication/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@node\",\"password\":\"${NODE_ADMIN_PASSWORD}\"}" | head -10
# Expected: 401 tenantProcessor.missingApiKey

# Proof 2 — cross-tenant isolation
curl -si -X POST http://localhost:3030/authentication/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${TENANT_A_API_KEY}" \
  -d "{\"email\":\"admin@node\",\"password\":\"${NODE_ADMIN_PASSWORD}\"}" | head -15
# Expected: 401 userNotFound

# Proof 3 — correct-tenant success
curl -si -X POST http://localhost:3030/authentication/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${NODE_API_KEY}" \
  -d "{\"email\":\"admin@node\",\"password\":\"${NODE_ADMIN_PASSWORD}\"}" | head -15
# Expected: 200 OK + Set-Cookie: access_token=<JWT with tid=nodeTenantId>

# Proof 4 — partition layout
docker exec twin-mt-node cat /app/data/authentication-user/store.json | jq '.[0].partitionId'
# Expected: "<Node-hash>/<Tenant-hash>" two-segment string
```

---

## Slack draft — message to Lead Dev

> Hey — been digging into multi-tenancy on the default node (single container, `TWIN_TENANT_ENABLED=true`, two tenants provisioned via `tenant-create`). Foundation looks good: `TenantProcessor` runs on every non-`skipTenant` route, `authentication-user` storage partitions by `[Node, Tenant]`, and cross-tenant login attempts correctly come back as `userNotFound` instead of leaking. Happy with that.
>
> Three questions came up — want to run them by you before I file anything, in case I'm misreading the intent:
>
> **1. `/health`, `/info`, `/spec` — are these meant to be tenant-gated, or did they just miss the `skipTenant: true` flag?** Keyless probes to all three return 401 `tenantProcessor.missingApiKey`, which broke my Docker healthcheck. Looking at `api-service/src/informationRoutes.ts`, the sibling routes `/`, `/favicon.ico`, `/livez` all have both `skipAuth: true` AND `skipTenant: true`, but these three only have `skipAuth: true`. Looks like the same oversight repeated across three definitions, but is there any reason a liveness/info/spec probe would want tenant context that I'm not seeing? I patched it locally (added `skipTenant: true` to all three, rebuilt, `GET /health` now returns `200 {"status":"ok"}` without a key) and can send a PR if you confirm it's a miss.
>
> **2. Is there a REST path for creating users inside non-node tenants that I've missed?** `POST /authentication-admin/users` enforces `tid` match between JWT and tenant context (`authHeaderProcessor.ts:122`), and the bootstrap admin's JWT always has `tid = nodeTenantId`. So calling with `x-api-key = <otherTenant>` just fails with `tenantIdMismatch` every time. I wired the CLI workaround (`node-set-tenant` + `user-create`) into my test setup and it DOES produce properly isolated users — `admin@mobius-freight` logs in with Tenant A's key (200 + JWT) and fails with Tenant B's key (401 `userNotFound`), which is great. But before I assume CLI-only is the intended model: is there a `tenant-admin`-scoped endpoint planned / already somewhere I haven't found that takes a `tenantId` parameter and switches context internally?
>
> **3. On `TransferProcess` partitioning — want to sanity-check this with you.** Spotted it while digging into the partitioning story for the multi-tenancy test. Control Plane registers `TransferProcess` with `[Node]` only and carries a comment `// Partition by Node only - transfers are cross-tenant operations`. Data Plane registers the same connector name with `[Node, Tenant]`, grouped under the same `partitionContextIds` variable as ActivityLog and ActivityTask. `initialiseEntityStorageConnector` silently keeps whichever registers first. Dormant today because without tenancy both degenerate to `[Node]` and agree by accident — activates the moment anyone flips `TWIN_TENANT_ENABLED=true` on a DSP deployment.
>
> I went back through the history on this and I honestly can't tell from the code alone whether the disagreement was a considered design choice or a moment where TransferProcess inherited DP's shared partition variable mechanically. The CP side has a comment that reads like deliberate reasoning; the DP side looks more like convenience grouping with the sibling entities — there's even a comment on the DP registration saying "TransferProcessEntity storage is shared with Control Plane", which only really makes sense if both sides are meant to agree. My gut says CP's `[Node]`-only choice is the considered one and DP's TransferProcess registration should align down (while keeping ActivityLog/ActivityTask at `[Node, Tenant]` — they genuinely belong per-tenant). But I didn't want to flip it without checking: **(a)** does that match how you'd read it, or is there context where DP specifically needs TransferProcess per-tenant? And **(b)** independent of (a) — should `initialiseEntityStorageConnector` throw when the same name is registered with different partition keys, instead of silently dropping the second? That feels like a generic footgun regardless of how the CP/DP question resolves.
>
> Evidence + repro steps + the local fix for (1) are in the test folder: `node/apps/node/tests/multiTenancyDocker/findings-from-first-run.md`. Let me know how you want to track these.

### Shorter / casual version

Same three questions, trimmed for scannability. Pick whichever fits the channel:

> hey martyn — quick multi-tenancy things to check with you while they're fresh. been running a single-node test with `TWIN_TENANT_ENABLED=true` and two tenants. foundation looks solid, but 4 questions came up:
>
> **1)** `/health`, `/info`, `/spec` all return 401 without an api-key. looks like they're just missing `skipTenant: true` (siblings `/`, `/favicon.ico`, `/livez` have both flags set). patched locally and `/health` returns 200 now. intentional or a miss? happy to PR if you confirm.
>
> **2)** creating a user inside a non-node tenant via REST — is there a path i've missed? `POST /authentication-admin/users` enforces tid match so the node-admin JWT can't reach other tenants. CLI workaround (`node-set-tenant` + `user-create`) works and isolation holds, but is CLI-only the intended model or is there an endpoint planned/hiding somewhere?
>
> **3)** CP registers `TransferProcess` with `[Node]` only (comment says "transfers are cross-tenant operations"). DP registers the same name with `[Node, Tenant]`, grouped with ActivityLog/ActivityTask. `initialiseEntityStorageConnector` silently keeps whichever registers first → fine today, trips the moment anyone flips tenancy on a DSP deployment. honestly can't tell if the split was considered or if TransferProcess got pulled into DP's shared variable by accident (the "shared with Control Plane" comment on DP makes me think partitions were meant to agree). my gut: align DP down to `[Node]`, keep ActivityLog/ActivityTask at `[Node, Tenant]`. sound right? and separately — should `initialiseEntityStorageConnector` throw on conflicting partitions for the same name? feels like a generic footgun.
>
> **4)** when `AuthHeaderProcessor` throws `tenantIdMismatch` (cross-tenant JWT reuse), the server log confirms it fires in ~5ms and the LoggingProcessor records a 401 — but the client receives a 500. Looks like something in `FastifyWebServer`'s outer error handler is masking the 401 with a 500 about 7ms after the pre-processor set the correct response. Security boundary is fine (request is rejected before any handler runs), but the status code going out to clients is wrong. Have you seen this before, or is it worth me digging in and sending a fix?
>
> full evidence + repro in `node/apps/node/tests/multiTenancyDocker/findings-from-first-run.md` when you have a sec.

### My Version of the Slack Message

Hey @Martyn, I want to check some multi-tenancy things with you while they're fresh. I've been running a single-node test with TWIN_TENANT_ENABLED=true and two tenants.

All looks solid, but I have these questions:

1. /health, /info, /spec all return 401 without an api-key. Looks like they're just missing skipTenant: true. Was this intentional or a miss?

2. Should we have a path for creating a user inside a non-node tenant via REST? The existing POST /authentication-admin/users enforces tid match, so the node-admin JWT can't reach other tenants. I did use the CLI (node-set-tenant + user-create), which works, but is CLI-only the intended way?

3. CP registers TransferProcess with [Node] only. DP registers the same name with [Node, Tenant], grouped with ActivityLog/ActivityTask. initialiseEntityStorageConnector silently keeps whichever registers first, but trips the moment anyone flips tenancy on. Should we align DP down to [Node], keep ActivityLog/ActivityTask at [Node, Tenant]? And also, should initialiseEntityStorageConnector throw on conflicting partitions for the same name?

4. When cross-tenant JWT reuse hits an auth-required route, AuthHeaderProcessor throws tenantIdMismatch and the server log shows a 401 in ~5ms, but the client receives a 500. FastifyWebServer's outer error handler seems to override the 401 with a 500 a few ms later. The security boundary holds (request is rejected before any handler runs), but the status code going out to clients is wrong. Have you seen this, or worth me digging in?

### Follow-up questions — current state

- **Q5** withdrawn (false positive on our side).
- **Q6, Q7** sent and answered — see Lead Dev responses section.
- **Q9, Q13, Q14** sent (2026-04-23) and answered — see Lead Dev responses + codebase verification sections above.
- **Q11, Q12** are sharpened drafts, lower priority. Hold until Q15 round-trip is done.
- **Q15** is the only multi-tenancy blocker still open — see below.

**Q15 (Q9 follow-up — crypto key compatibility, ready to send):**

> on the encryption side: `auth-signing` is bootstrapped as Ed25519 ([bootstrapLegacy.ts:159](node/packages/node-core/src/commands/bootstrapLegacy.ts#L159)) and `vaultConnector.encrypt()` enforces a key-type match — it'll throw `keyTypeMismatch` if you try to encrypt with anything other than a `ChaCha20Poly1305` key ([entityStorageVaultConnector.ts:383-387](vault/packages/vault-connector-entity-storage/src/entityStorageVaultConnector.ts#L383-L387)). So the choices are:
>
> (a) bootstrap a new symmetric key (e.g. `tenant-url-encryption`, ChaCha20Poly1305) + new env var for its name + `TenantProcessor` uses it via `vaultConnector.encrypt/decrypt`. Matches blob-storage pattern at [blobStorageService.ts:200](blob-storage/packages/blob-storage-service/src/blobStorageService.ts#L200). Adds ~1 bootstrap step + 1 env var.
>
> (b) skip encryption, HMAC-sign with the existing Ed25519 key (tenant id visible but unforgeable). No new key, no new env var. Reuses `authSigningKeyId` exactly mirroring the AuthHeader processor wiring.
>
> Lean (a) for opacity, (b) for minimum surface. Confirm and I'll go.

**Q11 (Q6 follow-up — sharpened, hold until Q15 closed):**

> back on the `getDefaultPartitionKeys()` direction. there are ~30 call sites of `pickKeysFromAvailable` across engine-types — most use `[Node, Tenant]`, some use `[Node]` (taskScheduler, federatedCatalogue, backgroundTask) which I assume are intentional, Identity DID uses `[]`. worth me opening a PR introducing the helper + migrating the standard `[Node, Tenant]` cases? I'd leave the Node-only and `[]` ones alone unless you want them reconsidered.

**Q12 (Q7 follow-up — sharpened, hold until Q15 closed):**

> on the attestation cascade — the surface is smaller than it sounds (~7-8 lines: drop entity-storage NFT partitioning + `skipTenant: true` on attestation GET + same on the 5 NFT routes). the "no query method" point holds at the REST layer, but the underlying `IEntityStorageConnector` does have `query()` so anything that hits the entity store directly (admin tooling, debug paths) would see cross-tenant data. comfortable with that trade for entity-storage being the "test flavour" of on-chain, or do you want to keep current behaviour and just update the attestation design comment to "verifiable by any peer inside the owning tenant"?

### Implementation decisions we made ourselves from the codebase (no need to ask Martyn)

After verifying patterns in the source, the following are decided locally with grounded references:

- **URL-encryption helper home**: `@twin.org/api-tenant-processor/src/utils/TenantUrlHelper.ts` — sibling to existing `TenantIdHelper.ts`. Adds new dep on `@twin.org/vault-models`.
- **Query param name**: `tenantToken` — camelCase (matches convention), and disambiguates from existing `tenantId` query param at `entityStorageAuthenticationAuditRoutes.ts:201`.
- **Engine config wiring**: ~5 lines added to the Tenant processor block at `engineServerEnvBuilder.ts:156-161`, mirroring the AuthHeader block at lines 255-262. Uses new `envVars.tenantUrlEncryptionKeyId` (option a, decided 2026-04-23).
- **`configureTrust` trigger list**: PNP, synchronised-storage, dataspace (all variants). Verified by grepping all `getRegisteredInstanceType("trustComponent")` and `getRegisteredInstanceTypeOptional("trustComponent")` callers across the workspace.
- **`TWIN_TRUST_ENABLED` removal style**: hard remove + changelog entry. Project is pre-1.0; no precedent for `no-op-with-warning` pattern in node-core.

## Implementation plan (2026-04-23) — six tickets across four submodules

All multi-tenancy-blocking design questions resolved. The work breaks into six tickets across four submodules. Ticket A is fully independent. Tickets B → C → (D, E) form a chain with one fan-out. Ticket F is the test scaffold and depends on everything else.

### Dependency graph

```text
A (trust auto-enable) ─────────────────────────┐
                                               │
B (TenantUrlHelper + decoder)                  │
   │                                           │
   └─→ C (bootstrap key + engine wiring)       │
          │                                    │
          ├─→ D (dataspace endpoint encrypt)   │
          │                                    │
          └─→ E (rights-mgmt PNP encrypt)      │
                                               │
                                       ┌───────┴───────┐
                                       │               │
                                       └─→ F (Tier 4 test scaffold)
```

### Ticket detail

**TICKET-A — Trust auto-enable (Q13)** — _independent, ship anytime_

- Repo: `node`
- Files: `engineEnvBuilder.ts` (`configureTrust` infers from PNP/sync-storage/dataspace), `bootstrapLegacy.ts:164` (replace `Coerce.boolean(envVars.trustEnabled)` check), `IEngineEnvironmentVariables.ts` (remove `trustEnabled` field). Update env example files. Changelog entry.
- Estimate: 0.5–1 day
- Risk: low (additive logic, removes a footgun)
- Note: standalone trust use (no PNP/sync/dataspace) is no longer possible without a workaround. Worth flagging in PR description; should be a non-issue in practice.

**TICKET-B — TenantUrlHelper + TenantProcessor decryption (Q15)** — _independent, foundation for D and E_

- Repo: `api`
- Files: new `api-tenant-processor/src/utils/TenantUrlHelper.ts` (encrypt/decrypt static methods), extend `tenantProcessor.ts` `pre()` to read `tenantToken` query param via vault when present, new constructor opt for `signingKeyName`, `package.json` adds `@twin.org/vault-models` dep, models update for `ITenantProcessorConfig`.
- Estimate: 1–2 days
- Risk: low (additive — internal only, no callers yet)

**TICKET-C — Bootstrap symmetric key + engine config (Q15)** — _depends on B_

- Repo: `node`
- Files: `bootstrapLegacy.ts` (new `vaultKeyCreate` for `tenant-url-encryption`, `keyType: "ChaCha20Poly1305"`, mirroring auth-signing setup at line 157-162), `defaults.ts` (new `TENANT_URL_ENCRYPTION_KEY_ID = "tenant-url-encryption"`), `IEngineServerEnvironmentVariables.ts` (new `tenantUrlEncryptionKeyId` field), `engineServerEnvBuilder.ts:156-161` (pass `signingKeyName` to TenantProcessor options config — mirrors AuthHeader at 255-262).
- Estimate: 0.5–1 day
- Risk: low (additive bootstrap step)

**TICKET-D — Dataspace endpoint construction uses encrypted tenant (Q9)** — _depends on B + C_

- Repo: `dataspace`
- Files: `dataspace-control-plane-service/src/dataspaceControlPlaneService.ts` lines 776, 842, 900 — wrap callback URL construction with `TenantUrlHelper.encrypt(url, tenantId, vault, keyName)`.
- Estimate: 0.5–1 day
- Risk: medium (DSP message `callbackAddress` format changes — verify via `mobiusSupplyChainDocker` regression run before merge)

**TICKET-E — Rights-management PNP endpoint construction uses encrypted tenant (Q9)** — _depends on B + C, parallel with D_

- Repo: `rights-management`
- Files: `rights-management-pnp-service/src/policyNegotiationPointService.ts:283` — wrap negotiation callback URL with `TenantUrlHelper.encrypt`.
- Estimate: 0.5–1 day
- Risk: medium (negotiation callback format changes — same regression check)

**TICKET-F — Tier 4 test scaffold (Kenya same-node DSP)** — _depends on A + B + C + D + E_

- Repo: `node` (test folder under `node/apps/node/tests/`)
- Files: new `kenyaCommunityNodeDocker/` test folder (env, Dockerfile, docker-compose, setup.sh, test script). Two tenants on one node, each publishes a consignment via DSP, each successfully negotiates from the other through the encrypted-endpoint mechanism.
- Estimate: 1–2 days
- Risk: low (test scaffold; surfaces real bugs but isn't itself risky)

**TICKET-G — Encrypted tenantToken at discovery surfaces** — _surfaced by TICKET-F (2026-04-26); Martyn-prescribed mechanism (line 280)_

- **Why:** B/D/E added the encryption mechanism for **request-time** URLs (DSP `dataAddress.endpoint`, PNP outbound `callbackAddress`). Verified end-to-end. Kenya Phase 4c proved the **discovery layer** (catalogue + ODRL offer publish-time URLs) doesn't yet plant tenant tokens — so consumer-initiated negotiations land in the consumer's tenant context with no token to switch into the offer-owner's context, and PAP's `[Node, Tenant]` partition blocks the lookup → `policyNegotiationPointService.noOfferFound`.
- **Mechanism:** Same `TenantUrlHelper.encrypt` + `TenantProcessor` decode pattern from B/D/E, applied at publish-time:
  - **Federated catalogue:** when a tenant publishes a `Dataset`, any URL field carried in the published JSON-LD (e.g. `accessService`, distribution endpoints) gets the publishing tenant's encrypted `tenantToken` appended.
  - **ODRL offer:** when a tenant writes an offer to PAP, any URL the offer advertises for callback / fulfilment carries the tenant token.
- Repos: `federated-catalogue` (publish path in `FederatedCatalogueService.set` and / or the test-app's `datasetsHandled`), `rights-management` (PAP write paths if URLs are emitted there), possibly `dataspace` (if test-app or DSP control plane emits the `accessService` URL). Wiring: `node-core` to pass `signingKeyName` into the catalogue service config; `engine-types` factory to inject `vaultConnectorType` (mirror D/E pattern).
- Estimate: medium — 2–4 days. Same encryption mechanism, ~2 new wiring sites, plus discovery of the exact emit points.
- Risk: medium. Output format change for catalogue dataset entries means consumers see opaque URLs. Pre-1.0 acceptable; needs a regression run against `mobiusSupplyChainDocker` (single-tenant) to confirm no unintended changes there.
- Doesn't block UK MVP (multi-node case already works via mobius pattern). Only blocks same-node Kenya scenario.
- Verification: `kenyaCommunityNodeDocker/kenya-test.sh` Phase 4c → 7 should pass without further code changes once G is shipped.

### Ordering and parallelism

- **TICKET-A and TICKET-B can ship in parallel** (different repos, no shared files).
- **TICKET-C must wait for TICKET-B** (needs the api package version with `signingKeyName` config).
- **TICKETS D and E can ship in parallel** after C (different repos, both need the helper + vault key).
- **TICKET-F lands last**, after everything else is merged and the involved packages are published.

### Estimated total

3.5 to 7 working days end-to-end if done sequentially; ~2.5 to 4 if A is parallelised against B-E. Tier 4 test scaffold adds another 1-2 days on top.

### Implementation tracking

Working branches:

- **node**: `feature/n2n-docker-test-with-pnp-negotiation` — all node-side changes go here first to validate end-to-end against the existing N2N+PNP test scaffolds. Once validated, the user ports each change to `next` and merges back into the feature branch.
- **api, dataspace, rights-management**: `next` (default).

Per-ticket workflow at submodule root: `npm run format && npm run lint && npm run dist`.

Status:

- [x] **TICKET-A** (node): trust auto-enable — _completed & verified 2026-04-23 (Phase 0+1 of mt-test green; subsequent phases unrelated pre-existing issues)_
- [x] **TICKET-B** (api): `TenantUrlHelper` + `TenantProcessor` decoder — _completed 2026-04-23 (additive, no callers yet — verified via unit tests; end-to-end exercised by D/E/F)_
- [x] **TICKET-C** (node): bootstrap symmetric key + engine wiring — _completed & verified 2026-04-24 (bootstrap creates `tenant-token-encryption` ChaCha20Poly1305 key; mt-test Phases 0+1 green proving back-compat preserved with new TenantProcessor wiring)_
- [x] **TICKET-D** (dataspace): endpoint encrypt — _completed & verified 2026-04-24 (DSP `startTransfer` now wraps PULL-mode `dataAddress.endpoint` with TenantUrlHelper.encrypt; node-core unit test suite green incl. DSP-enabled and multi-tenant startup; mid-flight refinement adopted BlobStorage's "service-only-resolves-vault-when-vaultConnectorType-passed + factory-injects-it" pattern)_
- [x] **TICKET-E** (rights-management): PNP endpoint encrypt — _completed & verified 2026-04-24 (3 outbound URL sites encrypted; tenantId persisted on PolicyNegotiation entity to survive setTimeout-delayed callbacks; rights-management+engine+node dist green)_
- [x] **TICKET-F** (node tests): Tier 4 same-node DSP test scaffold — _completed & ran 2026-04-26_. Empirical Kenya results consolidated below in "Kenya empirical findings". **Headline:** encryption layer (B/D/E) verified end-to-end; discovery→negotiation handoff blocked at PAP `[Node, Tenant]` lookup (`noOfferFound`) → motivated TICKET-G.
- [x] **TICKET-G** (federated-catalogue + engine + node): encrypt `tenantToken` into publish-time catalogue dataset URLs — _code shipped & verified 2026-04-27_. Catalogue's `set()` captures publishing tenant on the entity; query response post-normalize injects `twin:tenantToken` per dataset; engine factory + node-core wiring follow D/E pattern; Kenya Phase 3 prints the 80-char token. **Surfaced TICKET-G+1 (decode on `skipTenant` routes — shipped same day) and TICKET-G+2 (bidirectional callback routing — open).** See "Kenya empirical findings" → "2026-04-27 — TICKET-G + TICKET-G+1 ran end-to-end".

---

## Kenya empirical findings (consolidated from `kenyaCommunityNodeDocker/findings.md`)

This section consolidates the run history for the Kenya same-node multi-tenant DSP scaffold. The standalone `kenyaCommunityNodeDocker/findings.md` file was merged here on 2026-04-27 to keep one source of truth.

### 2026-04-26 — Foundation phases 0-1 ✅

First end-to-end run of the scaffold. Phase 0 + Phase 1 both passed.

`setup.sh --clean` ran cleanly. Bootstrap output included `Creating tenant token encryption key for node identity` (TICKET-C verified). Both KRA and Trader tenants created, both per-tenant admin users provisioned via the `node-set-tenant` CLI workaround.

**Phase 0 — Health + per-tenant logins:**

- ✅ Keyless GET `/health` → 401 (TenantProcessor gate intact)
- ✅ GET `/health` with KRA api-key → 200
- ✅ GET `/health` with Trader api-key → 200
- ✅ KRA admin (`admin@kra`) logged in
- ✅ Trader admin (`admin@trader`) logged in
- **Implication:** TICKETs A (trust auto-enable) + C (tenant-token-encryption vault key bootstrap) work cleanly in single-node multi-tenant configuration.

**Phase 1 — Trader queries federated catalogue:**

- ✅ HTTP 404 + `federatedCatalogueService.noDatasetsFound` (route reachable, catalogue empty)
- Server log: `FederatedCatalogueService Catalogue query complete, found 0 results`
- **Implication:** the **catalogue partition fix is verified empirically**. Trader's request (different tenant from publisher) successfully reached the catalogue service. Confirms `federatedCatalogue.ts:47` `[Node]`-only partitioning works as intended for cross-tenant discovery.

**Setup-side latent bug fixed:** `setup.sh` originally wrote `NODE_ADMIN_PASSWORD=...` unquoted, causing `source` under `set -u` to fail when the password contained `$`. Switched to `printf '%q'` shell-escaping. Same bug exists in `multiTenancyDocker/setup.sh` — flagged as follow-up.

### 2026-04-26 — Phases 2-4 partial: ✅ KRA seed + cross-tenant catalogue discovery, ❌ cross-tenant PNP negotiation

The empirical Kenya-scenario answer pre-TICKET-G. **What works** (the encryption layer) is verified end-to-end. **What didn't work** is the discovery→negotiation handoff, for a clear platform-level reason.

**Setup additions:** added `TWIN_EXTENSIONS="@twin.org/dataspace-test-app"` to `env/node.env` so the federated catalogue gets populated at DSP startup with the test-app's `Consignment` dataset. Wrote real `provision-storage.sh` that logs in as KRA + Trader, generates trust JWTs, verifies the dataset is in the catalogue, and seeds an ODRL offer in KRA's PAP.

**Phase 2 — KRA seeds offer in PAP:** ✅ HTTP 201 Created. KRA's session JWT successfully wrote `urn:policy:kra-offer-...` into the OdrlPolicy storage in KRA's tenant partition. PAP write works for the producer's own tenant — single-tenant rights-management is unaffected.

**Phase 3 — Trader sees KRA's dataset in catalogue:** ✅ HTTP 200 with `dataset[0]["@id"] = "https://twin.example.org/data-service-1"`. Server log: `Catalogue query complete, found 1 results`. **Cross-tenant catalogue discovery works.**

**Phase 4 — Trader initiates PNP negotiation against KRA's offer:**

- ✅ **4a — Trader PNAP pre-inject:** HTTP 204
- ✅ **4b — Trader's trust JWT generated and verified:** server log `TrustService Payload verified successfully`. **TICKETs B/C/E vault wiring verified end-to-end** in single-node multi-tenant configuration.
- ❌ **4c — PNP `requestFromConsumer` lookup:** HTTP 400 with `policyNegotiationPointService.noOfferFound` for `urn:policy:kra-offer-...`.

**Root cause** (matches the open question Q3 of the [same-node-multi-tenancy-analysis.md](../kenyaCommunityNodeDocker/same-node-multi-tenancy-analysis.md)):

1. Trader's POST to `/rights-management/negotiations/request` arrives with `x-api-key: TRADER_API_KEY` (no `tenantToken=` query param)
2. TenantProcessor sets `ContextIds[Tenant] = TRADER`
3. PNP `requestFromConsumer` runs in Trader's tenant context
4. PAP `getOffer(KRA_OFFER_ID)` queries `OdrlPolicy` storage, partitioned `[Node, Tenant]`
5. KRA's offer lives in `[Node, KRA]`; current context is `[Node, TRADER]` → query returns nothing
6. PNP throws `noOfferFound` → DSP `ContractNegotiationError`

**Implication:** TICKETs B/D/E encryption layer works correctly; the gap is upstream — discovery surfaces don't carry per-tenant routing tokens. **Motivates TICKET-G.**

### Phases 5-7 — not reached pre-TICKET-G

Negotiation didn't complete, so transfer phases were skipped.

### 2026-04-27 — TICKET-G + TICKET-G+1 ran end-to-end

**TICKET-G — catalogue publishes encrypted `twin:tenantToken`:** ✅ verified (Phase 3 prints `Catalogue published encrypted tenantToken (TICKET-G verified, 80 chars)`).

**Phase 4 first attempt — `noOfferFound`:** confirmed the predicted gap. Debug log added to `TenantProcessor.pre()` proved the route was `skipTenant: true` and the new decode path was never reaching the negotiation request handler. `?tenantToken=` query param was being silently ignored. → Motivated **TICKET-G+1**.

**TICKET-G+1 — decode-only `?tenantToken=` on `skipTenant` routes:** shipped & verified. `api-tenant-processor/src/tenantProcessor.ts:pre()` now decodes `?tenantToken=` even when `route.skipTenant === true`, sets `ContextIds[Tenant]`, and falls through (no api-key check). Decryption errors still 401; a missing token preserves prior anonymous behavior. After rebuild + Docker image refresh, debug log confirmed: `tokenPresent=true vault=true signingKey=true nodeId=did:iota:... → contextTenant=<KRA-tenant-id>`. Debug logs removed before final commit.

**Phase 4 (Trader → KRA negotiate):** ✅ `Negotiation initiated` after the test-scaffold workaround in `provision-storage.sh` Step 5b re-tags the test-app dataset's `tenantId` field to KRA. Without the re-tag, the catalogue routes to the auto-created `isNodeTenant` tenant (`019dd0a56da9...` in this run), not KRA — because `DataspaceControlPlaneService.start()` populates the catalogue at engine startup in NODE tenant context. Federated catalogue dataset storage is `[Node]`-only partitioned, so flipping the `tenantId` field alone is sufficient (no partitionId change). This is a test-scaffold patch, not a platform fix; production needs TICKET-G+1 follow-up below.

**Phase 5 (state polling FINALIZED):** ❌ — negotiation goes `REQUESTED → TERMINATED` within ~1s. Root cause located: KRA's outbound callback `POST /rights-management/negotiations/<consumerPid>/offers → 400`. KRA accepted the negotiation, then tried to send `ContractOfferMessage` to Trader's `callbackAddress` (= `http://twin-kenya-node:3000`, no token). The receiving handler is also `skipTenant: true`; with no `?tenantToken=` Trader's tenant context isn't established and PNAP can't find Trader's pre-injected entry → 400 → KRA terminates. → Motivates **TICKET-G+2**.

### 2026-04-29 — Phases 0-7 ALL PASS end-to-end

Full DSP/PNP loop verified on the Kenya scaffold. Every TICKET in the A-G arc plus two latent platform bugs are now empirically validated.

```
Phase 0: ✅ Health + per-tenant logins
Phase 1: ✅ Trader queries federated catalogue (cross-tenant discovery)
Phase 2: ✅ KRA's offer presence
Phase 3: ✅ Catalogue publishes encrypted twin:tenantToken (TICKET-G verified, 80 chars)
Phase 4: ✅ Negotiation initiated
Phase 5: ✅ Negotiation reaches FINALIZED (REQUESTED → AGREED → FINALIZED in ~1s, full PNP auto-chain)
Phase 6: ✅ Transfer created (TransferProcess initiated, agreement matched against catalog offer)
Phase 7: ✅ Trader pulls 2 items from KRA's data plane (TICKET-D verified — encrypted dataAddress.endpoint round-tripped)
```

**Two latent platform bugs surfaced + fixed in this round:**

1. **`BaseRestClient` mangled endpoint URLs containing query strings** — string-concatenated `endpoint + pathPrefix + route` instead of URL-parsing. When `endpoint` was a URL with `?tenantToken=…`, the result was malformed (path became part of query). Fixed in `api/packages/api-core/src/clients/baseRestClient.ts`: parse the endpoint with `new URL()` once in the constructor, store searchParams separately in `_endpointQuery`, append to every outbound request's queryKeyPairs. Backward-compatible try/catch fallback for non-URL endpoints. Two regression tests added.

2. **PNP `_callbackPath` double-prefix** — `policyNegotiationPointService.buildCallbackUrl` was producing `${publicOrigin}/${this._callbackPath}` (where `_callbackPath` came from `TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH` env, default `"rights-management"`). The receiving rest-client (`PolicyNegotiationPointRestClient`) hardcodes `"rights-management"` as its pathPrefix. Result: any callback URL going through the rest-client became `/rights-management/rights-management/…` and 404'd. This was a latent bug since Martyn's PR #65 (Jan 2026) — the design intent of "split runtime origin from config path" was never followed through to the rest-client side. Fix: removed `_callbackPath` from `buildCallbackUrl`, the rest-client's hardcoded prefix is now the single source of truth. Removed the field, the `IPolicyNegotiationPointServiceConfig.callbackPath` config option, the `rightsManagementCallbackPath` env field/wiring/docs, the `TWIN_RIGHTS_MANAGEMENT_CALLBACK_PATH` env var across 18 env files, and 4 test fixtures across engine + dataspace. Slack heads-up sent to Martyn.

**Test scaffold workarounds (live in `provision-storage.sh` and `kenya-test.sh`):**

- **Step 5b — re-tag dataset's `tenantId` to KRA.** Test-app publishes datasets at engine startup in node tenant context. Real Kenya deployment would have KRA's own dataspace app publish via its tenant. ~10 lines `docker exec node` patching `/app/data/dataset/store.json`.
- **Step 5c — mint Trader's encrypted tenantToken.** Real Trader-side service would call `buildCallbackUrl` internally; we're curl, so we mirror `EntityStorageVaultConnector.encrypt` directly (`@twin.org/crypto` ChaCha20Poly1305 with the vault key) via `docker exec node`. Trader's `callbackAddress` then carries the token correctly.
- **Single-target offer.** Stripped `target: "twin:jsonpath:$"` from `permission[0]` in both `provision-storage.sh` (seed) and `kenya-test.sh` Phase 4 (negotiation echo). Mirrors `dataspace-test-app/testDataspaceDataPlaneApp.ts`'s pattern of `permission: [{ action: "read" }]`. Without this, DSP's `extractDatasetId` rejects the agreement with `agreementMultipleTargetsNotSupported` because `OdrlPolicyHelper.getTargets()` walks both top-level and rule-level targets and the strings differ.
- **Phase 6 transfer `callbackAddress` — bare host.** Phase 4 was already `${INTERNAL_URL}?tenantToken=…` (no path); fixed Phase 6 to match. The `/dataspace` path was being double-added by the DSP rest-client's pathPrefix.

**Other A1a-related platform changes shipped in this round:**

- `IPolicyNegotiationPointServiceConfig.callbackPath: string` field removed.
- `IPolicyNegotiationPointServiceConstructorOptions.config: ...` made optional (matches PAP service pattern).
- `PolicyNegotiationPointService` constructor: `options?:` now optional, all field accesses use optional chaining.
- `RightsManagementPnpComponentConfig.options?:` made optional on the `Service` variant (matches PAP variant).
- 4 engine test fixtures + 1 dataspace integration test fixture cleaned up to drop the now-removed `config: { callbackPath: "" }` blocks.
- 4 PNP unit tests updated to expect bare-host callback URLs (no `/callback` suffix).

### 2026-04-29 (afternoon) — Q1 platform fix shipped + both scaffolds clean

**Multi-target dataset extraction (`agreementMultipleTargetsNotSupported`) — proper platform fix shipped.** `OdrlPolicyHelper.getDatasetTargets()` added as a sibling to `getTargets()`: walks ONLY the top-level `policy.target` (the dataset/asset), ignoring rule-level targets (which are constraint refinements per ODRL semantics — `AssetCollection`s with refinements, JSONPath filters, etc.). `dataspaceControlPlaneService.extractDatasetId` switched to call the new helper. Existing multi-top-level-target validation tests still pass (correct behavior); a new positive test verifies that an agreement with single top-level target + rule-level AssetCollection refinement is no longer rejected.

**Test-scaffold workarounds reverted:** Kenya's `provision-storage.sh` and `kenya-test.sh` Phase 4 now use the proper ODRL shape `permission: [{ action: "read", target: "twin:jsonpath:$" }]` again. No more single-target hacks needed.

**Both scaffolds now run end-to-end on the same platform code:**

```
Kenya (1 node, 2 tenants, same-node multi-tenant DSP):
  Phases 0-7: all green ✅ (negotiation, FINALIZED, transfer, encrypted dataAddress, data pull)

Mobius (4 nodes, cross-node DSP, per-consumer ODRL filtering):
  Phases 0-11: all green ✅ (3 negotiations, 3 transfers with LOCODE filtering, IPFS, final consistency)
```

The `[WARN] No data access token, using consumer trust` lines in Mobius Phase 7-9 are expected — Mobius is single-tenant per node, so TICKET-D's per-tenant endpoint encryption doesn't fire (no tenant context to encrypt). The data plane authorizes via consumer trust JWT, which is the original pattern. Pure cosmetic; the test scaffold could be smarter about not warning when running cross-node single-tenant.

**Cross-topology validation:** the platform changes (BaseRestClient query-string preservation, `_callbackPath` removal, `getDatasetTargets`) all work cleanly across **both** topologies — same-node multi-tenant (Kenya) and cross-node single-tenant (Mobius). No topology-specific quirks. Anyone running TWIN in either configuration benefits.

## Open follow-ups (Kenya / TICKET-G family)

- **TICKET-G+1 (test-app multi-tenant publishing) — STILL OPEN as platform work:** the test-scaffold re-tag in `provision-storage.sh:5b` is a workaround. Production needs one of:
  - (a) Test-app reads `TWIN_TEST_APP_PUBLISHER_TENANT` env var; wraps its `set()` in `ContextIdStore.run({Tenant})`
  - (b) Add a REST endpoint `POST /federated-catalogue/datasets` (admin-scoped) so any tenant can publish via session JWT in their own context
- **Service-mount-path single source of truth (deferred — pending Martyn's decision):** the `_callbackPath` removal collapsed three sources of truth (engine `serverRestRouteGenerators.json defaultPath`, rest-client constructor pathPrefix, PNP `_callbackPath`) into one (rest-client's hardcoded prefix). For real deployment flexibility (reverse proxy with path rewriting, multi-service single-port via K8s ingress, custom mount paths), the right fix is to make engine's `defaultPath` the single source of truth that propagates to both the rest-client `pathPrefix` and the service's callback URL builder. Slack heads-up sent to Martyn 2026-04-29 — awaiting his preference on whether to keep the option removed or revert + implement engine-driven version.
- **Setup-side:** `multiTenancyDocker/setup.sh` still has the unquoted `NODE_ADMIN_PASSWORD=...` shell-escape bug we fixed in `kenyaCommunityNodeDocker/setup.sh`. One-line `printf '%q'` patch.

## PR landscape — 6 PRs in dependency order

| #   | Submodule               | Headline                                                                                                                                                                                                                                                                                                                     | Depends on                        |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | **api**                 | `BaseRestClient` URL-parses endpoint to preserve query strings; `TenantProcessor` decodes `?tenantToken=` on `skipTenant` cross-node routes (TICKET-G+1, folded into G)                                                                                                                                                      | none                              |
| 2   | **rights-management**   | Removed vestigial `_callbackPath` (rest-client's hardcoded prefix is single source of truth); `config` and `options` parameters now optional; **added `OdrlPolicyHelper.getDatasetTargets()`** — top-level-only target extraction for DSP's `extractDatasetId` (fixes multi-target false-positive on rule-level refinements) | none (independent of 1)           |
| 3   | **engine**              | Factory wiring for `vaultConnectorType` injection across 5 components (TICKETs B/D/E/G); `RightsManagementPnpComponentConfig.options?:` optional; test fixtures cleaned                                                                                                                                                      | api (1), rights-management (2)    |
| 4   | **federated-catalogue** | TICKET-G — catalogue captures publishing tenant on `set()`, injects encrypted `twin:tenantToken` per dataset in query response                                                                                                                                                                                               | engine (3)                        |
| 5   | **dataspace**           | TICKET-D — DSP outbound endpoint encryption; **`extractDatasetId` switched to use `getDatasetTargets`** (top-level-only); setupPnpIntegration test fixture cleaned                                                                                                                                                           | engine (3), rights-management (2) |
| 6   | **node**                | TICKET-A trust auto-enable + TICKET-C vault key bootstrap + B/D/E/G env wiring; Kenya scaffold (Step 5b/c, single-target offer, Phase 6 callback URL); removed `rightsManagementCallbackPath` env field across 18 env files                                                                                                  | all of the above                  |

PRs 1 and 2 land first in parallel. Then 3 (depends on both). Then 4 and 5 (depend on 3). Then 6 last (depends on everything).
