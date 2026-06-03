# Kenya Community — Multi-Publisher Use Case (publish-and-aggregate)

A single-node, multi-tenant scaffold that demonstrates the **real Kenya shape**:
several authorities each publish _their own_ consignment data, and a consumer
discovers all of them, negotiates + pulls from each, and **aggregates the
slices locally**. This is the DSP-native publish-and-aggregate model — nobody
writes into anyone else's record.

> Sibling of `kenyaCommunityNodeDocker` (the base 2-tenant scaffold). This folder
> is self-contained: its own container (`twin-kenya-usecase-node`), host port
> **3041**, volume, and network. The original is untouched.

## Tenants (single node)

| Tenant       | Role      | Slice it publishes                                             |
| ------------ | --------- | -------------------------------------------------------------- |
| **KRA**      | publisher | customs / tax declaration (`urn:ucr:KE-KRA-2026-CUSTOMS-0001`) |
| **KPA**      | publisher | port / vessel (`urn:ucr:KE-KPA-2026-PORT-0002`)                |
| **KENTRADE** | publisher | trade permit (`urn:ucr:KE-KENTRADE-2026-PERMIT-0003`)          |
| **AFA**      | publisher | phytosanitary / commodity (`urn:ucr:KE-AFA-2026-PHYTO-0004`)   |
| **Trader**   | consumer  | discovers all four, negotiates + pulls each, aggregates        |

## How the distinct slices work

The dataspace-test-app serves a 4-consignment superset, configured via
`TWIN_TEST_APP_CONSIGNMENTS="@json:consignments.json"` (see `consignments.json`,
copied into the image at `/app/`). Each authority registers its own DSP dataset
(all mapping to test-app `app1`) and an ODRL offer in its own PAP, published in
its own tenant context so the catalogue attributes the dataset to that tenant
and bakes the tenant token into its distribution URL (TICKET-G).

When the consumer pulls authority X's dataset, it scopes the request with
`?id=<X's consignment>`; the test app filters its array by that `id` and returns
X's distinct slice. So four authorities ⇒ four distinct slices aggregated by the
consumer. (No platform/test-app code change — this is the
`@json:`-config + `?id=`-scoping path verified against current `next`.)

## Run

```bash
./setup.sh --clean                 # build image, bootstrap node, create 5 tenants (~minutes, IOTA testnet)
docker compose up -d               # start the node on host port 3041
./provision-storage.sh             # seed 4 publisher datasets + offers, mint consumer token
./kenya-usecase-test.sh            # discover → negotiate + pull each → aggregate
docker compose down -v             # tear down
```

For a live demo, run the interactive variant instead of `kenya-usecase-test.sh` —
it pauses for Enter before each phase so the audience can follow along:

```bash
./kenya-usecase-test-step.sh       # press Enter between phases
./kenya-usecase-test-step.sh --auto  # straight through (dry-run, no pauses)
```

Same test logic as `kenya-usecase-test.sh`; only the per-phase pause differs.

## Phases (`kenya-usecase-test.sh`)

0. Health (tenant-gated) + per-tenant logins
1. Trader discovers all four publisher datasets in the shared `[Node]` catalogue
2. The four datasets carry four **distinct** publisher attributions
3. Per authority: negotiate → FINALIZED → transfer → pull its slice (scoped by `?id=`)
4. Aggregation: all four **distinct** consignment slices were pulled
5. Push setup REJECTS missing tenant token (multi-tenant gate, KRA proof)
6. Push setup ACCEPTS endpoint with baked consumer tenant token (KRA proof)
7. Negative-path isolation (cross-tenant credential mix is rejected)

Push is exercised once against KRA — symmetric for the other three publishers,
covered for a single tenant pair in the base `kenyaCommunityNodeDocker` scaffold.
S4 boot-republish and the full 5-layer isolation matrix remain **not** re-tested
here — they're covered by the base scaffold.

## Out of scope

- **Cross-tenant document _writes_** (one authority adding a document to another's
  consignment via an agreement-gated inbox) — a separate, ticketed feature,
  deliberately not part of this scaffold. This scaffold is strictly the
  publish-and-aggregate (read) model.
- Production-shape connector app — still uses `dataspace-test-app`.
- Per-item ODRL enforcement — the arbiter is `pass-through` here; the demo proves
  aggregation, not enforcement (per-item filtering is the Mobius scaffold's
  mechanism).
