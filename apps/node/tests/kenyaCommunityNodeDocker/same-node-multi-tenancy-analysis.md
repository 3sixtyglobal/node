# Same-Node Multi-Tenancy — Five Questions, Answered from the Codebase

This file answers the five questions raised about whether the Kenya Community Node use case ([Kenya-Community-Node.md](Kenya-Community-Node.md)) can run on the platform as it is today, and what would need to change. Every answer is grounded in code we read, with file:line citations.

---

## ⚠️ Status update (re-verified 2026-04-24)

Two of the three blockers this analysis flagged have been resolved since it was written. The analysis below is preserved verbatim for historical context, but the **current state is**:

| #   | Blocker as originally documented                                                                          | Current state                                                                                                                                            | Verified at                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Appendix A — `TransferProcess` partition mismatch (Control Plane `[Node]` vs Data Plane `[Node, Tenant]`) | ✅ **FIXED** in `engine` PR #102 (commit `b651361`, 2026-04-22). Both planes now align on `[Node, Tenant]`.                                              | [dataspaceControlPlane.ts:48-51](../../../../engine/packages/engine-types/src/components/dataspaceControlPlane.ts#L48-L51)                                                                                                                       |
| 2   | Q3 — Federated Catalogue partitioned `[Node, Tenant]`, blocking cross-tenant discovery                    | ✅ **NOT THE ACTUAL STATE** — catalogue has been `[Node]`-only since at least March 2026 (Martyn's PR #90). The analysis cited the wrong partition list. | [federatedCatalogue.ts:47](../../../../engine/packages/engine-types/src/components/federatedCatalogue.ts#L47)                                                                                                                                    |
| 3   | Q3 — `OdrlPolicy` (PAP) and `PolicyNegotiation` (PNAP) partitioned `[Node, Tenant]`                       | ⚠️ **STILL `[Node, Tenant]`**. Whether this is a blocker depends on the actual cross-tenant DSP path, which TICKET-F will exercise empirically.          | [rightsManagementPap.ts:48-50](../../../../engine/packages/engine-types/src/components/rightsManagementPap.ts#L48-L50), [rightsManagementPnap.ts:43-45](../../../../engine/packages/engine-types/src/components/rightsManagementPnap.ts#L43-L45) |

Net effect: the Kenya scenario is meaningfully more achievable today than this analysis suggested. **TICKET-F (kenyaCommunityNodeDocker scaffold) will be the empirical test of how far same-node multi-tenant DSP gets with fixes 1 + 2 in place.**

The TICKETs A through E that landed since this analysis was written add the encryption layer (`tenantToken` query param) that lets the receiving side decrypt the inbound tenant context — orthogonal to the partitioning concerns above but necessary for any real same-node multi-tenant DSP flow.

---

## 1. What is the ODRL "PIN filter"?

**ODRL** (Open Digital Rights Language) is a W3C standard for machine-readable access policies. A policy says _who_ (assigner/assignee) can do _what_ (action) on _which_ asset (target), under _what conditions_ (constraints).

The pattern the supply-chain demos use is **AssetCollection + refinement**. Instead of writing one offer per consumer, the publisher writes one offer over a _collection_ of items and adds a refinement constraint that picks out the items each consumer is allowed to see. Concretely the constraint looks like:

```text
leftOperand:  twin:jsonpath:$.PIN
operator:     eq
rightOperand: <trader's KRA PIN>
```

When the consumer pulls, two pieces of code do the work:

- `defaultPolicyArbiter.resolveRuleDecisionTargets()` ([rights-management-plugins/src/policyArbiters/defaultPolicyArbiter.ts:1443](../../../../rights-management/packages/rights-management-plugins/src/policyArbiters/defaultPolicyArbiter.ts#L1443)) walks the array and produces a per-item decision (`Granted` / `Denied`).
- `defaultPolicyEnforcementProcessor` ([rights-management-pep-service/src/.../defaultPolicyEnforcementProcessor.ts:181-199](../../../../rights-management/packages/rights-management-pep-service/src/processors/defaultPolicyEnforcementProcessor.ts#L181-L199)) drops the denied items via JSONPath before the response is sent.

In Kenya: KRA tags every consignment with the trader's PIN. The arbiter compares each consignment's `PIN` field against the trader's PIN and prunes everything that doesn't match. No per-trader code, no per-trader endpoint — one offer, one policy, automatic per-item filtering. The Mobius test does exactly the same thing on `unloadingLocation.id` (UN/LOCODE) instead of PIN.

---

## 2. Is the Federated Catalogue not "multi-tenant the same way" as multi-node?

You're right that across separate nodes the catalogue is a synced shared discovery surface. **On a single node with multiple tenants, it is not — it is tenant-private.** Different mechanism, different result.

**Why the catalogue syncs across nodes:** the synchronised storage connector deliberately _bypasses_ partition filtering when replicating between nodes. See [synchronised-storage/packages/entity-storage-connector-synchronised/src/synchronisedEntityStorageConnector.ts:306-313](../../../../synchronised-storage/packages/entity-storage-connector-synchronised/src/synchronisedEntityStorageConnector.ts#L306-L313):

> "We deliberately skip the partition key as we want to query all partitions in synchronised storage"

So node-to-node sync is a system-level operation outside any tenant context.

**Why it doesn't shared-discover across tenants on one node:** `Dataset` is a normal `@entity()` ([federated-catalogue-service/src/entities/dataset.ts:11](../../../../federated-catalogue/packages/federated-catalogue-service/src/entities/dataset.ts#L11)). The catalogue service queries it with `_datasetStorage.query()` ([federatedCatalogueService.ts:308](../../../../federated-catalogue/packages/federated-catalogue-service/src/services/federatedCatalogueService.ts#L308)). That query goes through the connector, which auto-injects a `partitionId` filter built from `contextIds[Tenant]`. KRA's catalogue entries land in KRA's partition. When Trader queries with `x-api-key=Trader`, the partition filter restricts results to Trader's partition — KRA's entries are invisible.

**The fix is small, targeted, and correct.** Configure the catalogue's entity-storage connector with `partitionContextIds: [Node]` only — i.e., partition by node, not by tenant. The catalogue becomes a node-level shared index (which is what every multi-node deployment already is). The actual _data_ stays tenant-partitioned because it lives in a different connector. Discovery is a separate layer from access; ODRL still enforces who can _retrieve_ what.

---

## 3. Is the code ready for tenant-A-to-tenant-B negotiation on the same node?

**No.** The DSP layer assumes provider and consumer are separate nodes with separate databases. On one node with two tenants it breaks at the very first step. Here is the concrete trace:

1. Trader (tenant B) calls `POST /control-plane/transfers/request` with `x-api-key=B`. Route is at [dataspaceControlPlaneRoutes.ts:108-112](../../../../dataspace/packages/dataspace-control-plane-service/src/dataspaceControlPlaneRoutes.ts#L108-L112).
2. Handler calls `requestTransfer()` → `lookupAgreement()` ([dataspaceControlPlaneService.ts:1719](../../../../dataspace/packages/dataspace-control-plane-service/src/dataspaceControlPlaneService.ts#L1719)) → PAP `getAgreement()` ([policyAdministrationPointService.ts:219-241](../../../../rights-management/packages/rights-management-pap-service/src/policyAdministrationPointService.ts#L219-L241)).
3. PAP queries `OdrlPolicy` storage, which is configured with `partitionContextIds: [Node, Tenant]` ([rightsManagementPap.ts:48-51](../../../../engine/packages/engine-types/src/components/rightsManagementPap.ts#L48-L51)). KRA stored the offer in partition `[Node, KRA]`. Trader's request runs in partition `[Node, Trader]`.
4. The query returns nothing → `NotFoundError("agreementNotFound")`. Negotiation dies before it begins.

**Even if step 3 succeeded**, there is a second problem: `TransferProcess` partitioning appears inconsistent between Control Plane and Data Plane (Control Plane registers it with `[Node]` only, Data Plane with `[Node, Tenant]`). One of the two reads it back from a different partition than it was written to. **This needs a 5-minute verification before treating it as a finding** — the agent's read of the engine wiring may not be authoritative, but if it's correct it's a latent bug regardless of multi-tenancy.

> **Update 2026-04-24:** The TransferProcess partition mismatch was verified as a real bug and **fixed in engine PR #102** (commit `b651361`, 2026-04-22). Both planes now use `[Node, Tenant]`. See the status banner at the top of this file.

**Other gaps for the same-node case:**

- DSP callbacks use `skipTenant: true` (asynchronous notifications come back without an `x-api-key`). When the callback handler tries to update state, there is no tenant context, so storage falls back to the root partition.
- DSP messages don't carry tenant identifiers — protocol-level, the recipient has no way to know which provider tenant the message is for.
- ODRL offers don't track a "provider tenant" field — they record assigner/assignee DIDs but not the partition they live in.

**What it would take to make DSP work cross-tenant on one node:**

| Change                                                                                                             | Cost                                  | Trade-off                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Catalogue connector → `partitionContextIds: [Node]` only                                                           | One-line config                       | Discovery becomes shared — **DONE (cited wrong partition; was already `[Node]`)**  |
| Same change for `OdrlPolicy` storage                                                                               | One-line config                       | All offers visible across tenants — acceptable since policies are public-by-design |
| Add `providerTenantId` / `consumerTenantId` to `TransferProcess`                                                   | Schema + migration + a few handlers   | TransferProcess can be per-tenant-pair routed                                      |
| Reconcile Control Plane vs Data Plane TransferProcess partitioning                                                 | One-line fix                          | **DONE in engine PR #102 (2026-04-22) — see Appendix A update**                    |
| Wrap provider-side handlers in `ContextIdStore.run({ Tenant: providerTenantId }, ...)` when "self" is the provider | Localised code change in 4-5 handlers | Same-node fast-path that bypasses HTTP loopback                                    |
| Carry tenant ID in DSP callback URLs / tokens so callbacks can restore context                                     | Protocol-level tweak                  | Callback handlers stop falling back to root partition                              |

There is precedent for the runtime context switch — `ContextIdStore.run()` is already used by the data plane cleanup path ([dataspaceDataPlaneService.ts:1008-1022](../../../../dataspace/packages/dataspace-data-plane-service/src/dataspaceDataPlaneService.ts#L1008-L1022)). So the pattern exists; it just hasn't been applied to the DSP request flow.

**Verdict:** the codebase is _not fundamentally hostile_ to same-node DSP, but it is _not designed for it_ either. The minimum viable change is small (catalogue + policy partitioning swap) and unblocks the discovery half. The full DSP cross-tenant flow needs the additional changes in the table above. Realistically this is a 1–3 sprint piece of work depending on how strict the isolation needs to be.

---

## 4. Is the platform ready for one-node multi-tenancy? Is this DevOps work or platform work or both?

**Both. They are solving different layers.**

**What the platform team needs to do (us):**

- Tenant context plumbing: already done. `TenantProcessor` + `ContextIdStore` + auto-partitioned entity storage ([api-tenant-processor/src/tenantProcessor.ts:75-114](../../../../api/packages/api-tenant-processor/src/tenantProcessor.ts#L75-L114)).
- Tenant provisioning: already done. `tenant-create` CLI + `POST /tenants` REST.
- Auth `tid` claim enforcement: already done ([authHeaderProcessor.ts:122](../../../../api/packages/api-auth-entity-storage-service/src/processors/authHeaderProcessor.ts#L122)).
- **Partially done:** `TWIN_TENANT_ENABLED=true` enables Tenant in the _available_ context keys but does **not** centrally toggle storage partitioning — see Appendix B. Each component initializer in `engine-types/src/components/` decides for itself via `pickKeysFromAvailable([Node, Tenant])`. Most user-facing entities (NFT, attestation, identity-profile) opt in; some (Identity DID document, DSP Control Plane TransferProcess) do not. There is no single env var to fix this — broken components must be patched individually in their initializers.
- **Not yet done:** the catalogue / policy partitioning re-scoping discussed in Q2 and Q3 if same-node sharing is a goal.
- **Not yet done:** same-node DSP support if the Kenya-style flow needs to pass through DSP rather than direct sharing.

**What DevOps needs to do (Rodrigo):**

- NGINX reverse proxy that maps subdomain → API key (per the [Jan 23 design doc](../../../../z-twin-architecture/twin-documentation/TWIN-Supply-Chain-Multitenancy-Tech_23_Jan_2026.md)).
- Vault sidecar (or DB lookup) for the API keys.
- Wildcard TLS / DNS for tenant subdomains.
- Per-tenant subdomain → API URL DNS records.
- Rate limiting / DoS protection per API key.

**Neither side blocks the other.** We can demo isolation today (with the `multiTenancyDocker` test, no NGINX needed — the test injects `x-api-key` directly in curl). NGINX is a UX/security wrapper around something the platform already does. Conversely, NGINX without the connector partitioning correctly wired produces zero isolation — DevOps work alone is meaningless.

The honest framing for the meeting: **platform-side foundations are largely there for tenant _isolation_; same-node tenant _interaction_ (DSP, shared catalogue) is platform work that hasn't started.** DevOps work is the operational packaging, not the primitive.

---

## 5. For one-node multi-tenant, do we actually need DSP, or can tenants call each other directly?

**Honest answer: for a community node with mutually-trusting tenants, you don't _need_ DSP. You can call directly. Whether you _should_ is a different question.**

### The "direct" path (no DSP)

A tenant-to-tenant API on the same node would work like this:

1. Trader calls `GET /sharing/from-tenant/KRA/consignments?pin=DIMA-PIN` with `x-api-key=Trader` and a JWT proving identity.
2. The handler authorises the request (consent, ACL, ODRL policy — whatever model you choose).
3. It wraps the data lookup in `ContextIdStore.run({ Tenant: KRA }, ...)` to switch into KRA's partition for the read.
4. ODRL still gets evaluated against KRA's offers (the PIN constraint still works exactly the same — the arbiter does not care about the transport).
5. Response is filtered and returned in Trader's response context.

This costs roughly two new endpoints and a small policy-decision wrapper. The PIN-filter mechanism is reusable verbatim.

### What you give up by skipping DSP

- **Protocol interoperability.** External nodes (UK MVP, Mobius elsewhere, future Kenya partners) can't connect with the standard DSP flow. You'd need to support both paths.
- **Audit/contract trail.** DSP produces ContractAgreement and TransferProcess records that double as audit evidence. A direct call doesn't unless you re-implement that ledgering.
- **Async + push.** DSP gives you contract negotiation, retry, suspend, terminate semantics. A direct call is request/response only.
- **Rights-management uniformity.** DSP is the channel that PEP/PAP/PNP plug into. Off-DSP traffic needs explicit policy-enforcement wiring at the new endpoint.

### What you give up by _insisting_ on DSP for same-node

- The catalogue and policy partitioning rework described in Q3.
- Same-node optimisations (HTTP loopback, callback URL gymnastics).
- Some weeks of work on a code path the DSP designers explicitly didn't anticipate.

### Recommendation

**Hybrid.** Keep DSP as the protocol for cross-node and any case where contractual semantics matter. Add a thin same-node "direct sharing" path for the community-node case where tenants are mutually trusting and the user expectation is "see what I'm allowed to see, fast." The PIN/ODRL machinery is shared across both paths, so no policy logic gets duplicated.

For the Kenya use case specifically: traders inside the community node almost certainly fall in the "direct path" bucket. KRA-to-Trader on the same Kenya node doesn't need contract negotiation; it needs filtered read access. KRA-to-Mobius (cross-border) absolutely _does_ need DSP. Designing for both is the right call.

---

## Suggested next steps

1. ~~**Fix the TransferProcess partitioning conflict** described in Appendix A.~~ **DONE 2026-04-22** in engine PR #102 (commit `b651361`). Both planes now register `[Node, Tenant]`.
2. **Audit every component initializer** in `engine/packages/engine-types/src/components/` for hardcoded partition lists and decide per component whether Tenant should apply. Outcome of Appendix B. _Status: PAP / PNAP still `[Node, Tenant]` — re-evaluate as part of TICKET-F findings._
3. **Run the [multiTenancyDocker](../multiTenancyDocker/) scaffold** to confirm isolation works end-to-end on the components that _do_ opt in. _Status: green for Phases 0–1 (engine startup + per-tenant login). Phases 2+ blocked by the pre-existing attestation-VM test scaffold issue, unrelated to platform isolation._
4. **Decide the model for Kenya specifically**: direct same-node sharing vs same-node DSP. Drives whether the next sprint is a new "internal sharing" endpoint (small) or DSP cross-tenant work (medium-large). _Status: TICKET-F (kenyaCommunityNodeDocker) is the empirical test that informs this decision._
5. **In parallel**: DevOps starts on NGINX + subdomain routing using the existing `Tenant.publicOrigin` field — independent of the platform decisions above.

---

## Appendix A — Confirmed: TransferProcess partitioning was a real bug — RESOLVED 2026-04-22

> **Resolution:** Engine PR #102 (commit `b651361`, 2026-04-22) aligned the Control Plane to use `[Node, Tenant]` matching the Data Plane. The original analysis below is preserved for the rationale; today both planes register the same partition list, the silent-no-op race no longer occurs, and `TWIN_TENANT_ENABLED=true` does not produce inconsistent behaviour for `TransferProcess`.

Both planes register the same connector name (`nameof<TransferProcess>()` → `"transfer-process"`) with **different `partitionContextIds`**:

- Control Plane ([dataspaceControlPlane.ts:45-56](../../../../engine/packages/engine-types/src/components/dataspaceControlPlane.ts#L45-L56)) — `[ContextIdKeys.Node]` only.
- Data Plane ([dataspaceDataPlane.ts:45-73](../../../../engine/packages/engine-types/src/components/dataspaceDataPlane.ts#L45-L73)) — `[ContextIdKeys.Node, ContextIdKeys.Tenant]`.

The factory helper `initialiseEntityStorageConnector` checks if the name is already registered and silently no-ops if it is:

```ts
if (!EntityStorageConnectorFactory.hasName(instanceName)) {
  EntityStorageConnectorFactory.register(instanceName, () => entityStorageConnector);
}
```

**Whichever plane initializes first wins — the second registration is dropped without warning.** With `TWIN_TENANT_ENABLED=false` both sides degenerate to `[Node]` (because `pickKeysFromAvailable` filters out the unavailable Tenant key) and accidentally agree, which is why nobody has noticed. With `TWIN_TENANT_ENABLED=true`:

| Init order          | Effective partition | Effect                                                                     |
| ------------------- | ------------------- | -------------------------------------------------------------------------- |
| Control Plane first | `[Node]` only       | Data Plane silently ignores Tenant. Multi-tenant breaks at the data layer. |
| Data Plane first    | `[Node, Tenant]`    | Control Plane queries by `[Node]` only and may pull cross-tenant rows.     |

**Fix options** in order of preference:

1. Align Control Plane to use `[Node, Tenant]` like Data Plane — the most correct one-line change.
2. Use distinct connector names per plane (`"transfer-process-cp"` / `"transfer-process-dp"`) — surgical but fragments storage.
3. Make `initialiseEntityStorageConnector` _throw_ on conflicting partition configs instead of silently no-oping. Worth doing in addition to (1) — would have caught this immediately and prevents the same shape of bug landing again anywhere in the codebase.

---

## Appendix B — Confirmed: `TWIN_TENANT_ENABLED=true` doesn't auto-wire storage partitioning

The flag does exactly two things ([engineServerEnvBuilder.ts:148-160](../../../../node/packages/node-core/src/builders/engineServerEnvBuilder.ts#L148-L160), [engineEnvBuilder.ts:584-597](../../../../node/packages/node-core/src/builders/engineEnvBuilder.ts#L584-L597)):

- Adds `Tenant` to `availableContextIdKeys`.
- Registers `TenantProcessor` (REST + Socket) and `TenantAdminComponent`.

That's it. **No storage connector configuration is touched by the env var.** Each component initializer in `engine/packages/engine-types/src/components/` decides for itself whether to partition by tenant via:

```ts
const partitionContextIds = ContextIdHelper.pickKeysFromAvailable(
  engineCore.getContextIdKeys(),
  [ContextIdKeys.Node, ContextIdKeys.Tenant] // <-- per-component opt-in
);
```

`pickKeysFromAvailable` is the bridge: it returns `[Node, Tenant]` only if Tenant is available. So a component opts into tenant partitioning by listing Tenant in its hardcoded array. The env var controls _availability_; the component code controls _use_.

Sample audit:

| Component                                                                                                                         | Hardcoded list   | Tenant-aware when flag is on?       |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------- |
| NFT ([nft.ts:49-58](../../../../engine/packages/engine-types/src/components/nft.ts#L49-L58))                                      | `[Node, Tenant]` | Yes                                 |
| Identity Profile ([identityProfile.ts:46-55](../../../../engine/packages/engine-types/src/components/identityProfile.ts#L46-L55)) | `[Node, Tenant]` | Yes                                 |
| Data Plane TransferProcess                                                                                                        | `[Node, Tenant]` | Yes (in isolation — see Appendix A) |
| Identity DID document ([identity.ts:66-71](../../../../engine/packages/engine-types/src/components/identity.ts#L66-L71))          | `[]`             | **No — never partitioned**          |
| Control Plane TransferProcess                                                                                                     | `[Node]`         | **No**                              |

**There is no `TWIN_TENANT_PARTITION_KEYS` or similar override env var.** To fix a broken component you must edit its initializer in `engine-types`. To enforce consistency platform-wide, the right intervention is either:

- Add an engine-level helper that takes "tenant-aware: yes/no" intent and produces the partition list, so individual initializers stop hardcoding the wrong shape.
- Treat any `[Node]` or `[]` partition list as a code-review smell when Tenant is in scope, and audit on every PR that touches a component initializer.

**Practical implication for the Kenya use case:** isolation will work for entities whose initializers opt in (most user-facing types). It will not work for components that hardcode `[Node]` only or `[]`. The DSP TransferProcess case is doubly broken (Appendix A bug + opted-out Control Plane). This is fixable but requires per-component patches, not a single config flip.
