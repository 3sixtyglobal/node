# twin-node soak / load harness

> Created: 2026-06-24
> Last updated: 2026-08-31

Drives sustained HTTP load against a fully-bootstrapped twin-node, samples the node process's
OS-level memory usage throughout the run, and fails the run when memory-growth / latency / error-rate
thresholds are breached.

> **Status:** Phases 1–5 working. The orchestrator bootstraps a file-backed node, starts it,
> waits for `GET /readyz`, drives k6 load (per-VU API-key login → JWT cookie → weighted
> multi-endpoint traffic mix) while sampling the node process's memory, prints a per-group
> summary, and exits non-zero on a k6 threshold breach or an enforced memory-growth breach.
> Still to come: the nightly CI workflow (phase 6).
>
> Memory is sampled at the OS level (private bytes via the process PID) on local runs; cloud
> runs can opt in to sampling the target node's own telemetry API instead (`SOAK_MEM_SOURCE`,
> below). The growth verdict requires **two independent signals to agree**: a whole-window
> least-squares fit over the raw samples, and a Theil-Sen (median of pairwise slopes) fit over
> every post-warm-up bucket's post-GC floor (per-bucket minimum, which strips the GC sawtooth). A
> breach is only reported when both signals independently exceed the limit; disagreement between
> them reports as informational rather than picking one arbitrarily. An earlier design restricted
> the floor fit to only the settled second half of the run, which starved it down to 8-9 points
> and made the verdict flip between -933 and +434 MB/hr on two 30-minute runs of identical code
> (issue #367) — both signals are now fitted over the whole post-warm-up window instead. It is
> only a _fatal_ verdict once the window is long enough (`SOAK_MEM_MIN_WINDOW`, default 10m) with
> ≥4 post-warm-up floor buckets; shorter runs report it as informational.
>
> A memory breach on an otherwise-clean k6 run gets one automatic extension
> (`SOAK_MEM_EXTEND_DURATION`, default 30m) before the run is failed: a large, slow-settling
> warm-up can still dominate a single window's whole-window fit even though it has genuinely
> plateaued, and running longer resolves that the same way the campaign's manual re-run protocol
> did. A second breach after the extension is reported as-is — only one extension is attempted.
> The extension applies to local runs, and to cloud runs once the telemetry-sourced verdict is
> enforced (see below).
>
> Cloud runs (`SOAK_SKIP_SERVER=true`) have no local process to sample; with
> `SOAK_MEM_SOURCE=telemetry` the harness instead samples the target node's own telemetry store
> (`process_memory_rss_bytes` via the REST API, deduped, ~60s cadence — the cloud profile enables
> this). The resulting verdict is informational until `SOAK_MEM_ENFORCE=true`, so the growth
> limit can be recalibrated against containerized-pod baselines first. Without it, cloud runs
> report no memory series at all.
>
> Note: readiness uses the server-level `/readyz` probe (unauthenticated). The `/health`
> endpoint is tenant-scoped and returns 401 without an `organization` param in multi-tenant
> mode, so it is exercised as part of the authenticated load mix, not as the probe.

## Prerequisites

- Node.js >= 20 (already required by this package).
- **k6** — required from phase 2 onward, **not** an npm dependency (it is a separate
  Go binary). Install one of:
  - Windows: `winget install k6` or `choco install k6`
  - macOS: `brew install k6`
  - Linux / CI: the official `grafana/setup-k6-action`, or see <https://grafana.com/docs/k6/latest/set-up/install-k6/>

  The orchestrator fails fast with a clear message if k6 is needed but not on `PATH`.

## Run

```bash
# from the repo, target this app:
npm --workspace apps/node run test:soak
```

Phase 1 prints progress and exits 0 once the node is healthy. Server stdout/stderr is
captured to `apps/node/soak/.out/server.log`; file storage lives under
`apps/node/soak/.out/data` (both gitignored, recreated per run).

## Configuration (env vars)

All knobs are `SOAK_*` for the harness; the node still uses `TWIN_*`. Defaults shown.

| Var                                        | Default                           | Meaning                                                                     |
| ------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------- |
| `SOAK_PORT`                                | `3210`                            | Port the spawned node binds to                                              |
| `SOAK_PROFILE`                             | `file-local`                      | Selects `config/soak.<profile>.env`                                         |
| `SOAK_TENANT_MODE`                         | `multi`                           | `multi` or `single`                                                         |
| `SOAK_BOOT_TIMEOUT`                        | `120s`                            | Max wait for `/readyz` 200                                                  |
| `SOAK_SKIP_BOOTSTRAP`                      | `false`                           | Reuse existing state instead of bootstrapping                               |
| `SOAK_BASE_URL`                            | `http://localhost:${SOAK_PORT}`   | Target (to drive an external node)                                          |
| `SOAK_STRICT_ENV`                          | `error`                           | Node env validation mode (`error`/`warn`/`ignore`)                          |
| `SOAK_TENANT_ID` / `SOAK_TENANT_API_KEY`   | fixed test values                 | Multi-tenant identity                                                       |
| `SOAK_ADMIN_EMAIL` / `SOAK_ADMIN_PASSWORD` | `admin@node` / `Admin@Node12345!` | Admin login                                                                 |
| `SOAK_SKIP_LOAD`                           | `false`                           | Readiness only — skip the k6 load phase                                     |
| `SOAK_DURATION`                            | `5m`                              | k6 run length (e.g. `30s`, `2m`, `30m`)                                     |
| `SOAK_VUS`                                 | `5`                               | Virtual users                                                               |
| `SOAK_P95_MS` / `SOAK_P99_MS`              | `500` / `1500`                    | Latency ceilings (k6 thresholds)                                            |
| `SOAK_ERROR_RATE`                          | `0.01`                            | Max failed-request rate (1%)                                                |
| `SOAK_K6_BIN`                              | _(auto)_                          | Override k6 binary path (else PATH, then default Windows install)           |
| `SOAK_SAMPLE_INTERVAL`                     | `10s`                             | Memory sampling cadence                                                     |
| `SOAK_MEM_GROWTH_MB_PER_HR`                | `150`                             | Max growth slope; both signals must exceed it to breach (past min window)   |
| `SOAK_WARMUP_DISCARD`                      | `2m`                              | Initial window excluded from the growth slope (warm-up)                     |
| `SOAK_MEM_MIN_WINDOW`                      | `10m`                             | Settled-window length below which memory growth is informational, not fatal |
| `SOAK_MEM_EXTEND_DURATION`                 | `30m`                             | One automatic extension on a memory breach (local, or enforced telemetry)   |
| `SOAK_MEM_SOURCE`                          | `process`                         | `telemetry` samples the target node's own telemetry store (cloud runs)      |
| `SOAK_MEM_ENFORCE`                         | `false`                           | Enforce the telemetry-sourced verdict (else breaches report, not fail)      |
| `SOAK_WRITE_RATIO`                         | `0.3`                             | Fraction of blob/aig iterations that create new resources (vs. read)        |

A k6 threshold breach **or** an enforced memory-growth breach makes the run exit non-zero.
Outputs: `soak/.out/summary.json` (k6) and `soak/.out/report.json` (combined: config, k6
verdict, memory series + verdict, per-group metrics).

## Scenario — covered API areas (phase 5 + feat-249 round 2)

Each iteration picks one group by weighted random. All groups share the same per-VU JWT session.
A `setup()` preflight probes every group's read endpoint (GET probes) or seeds initial data (POST
probes for notarization and fedcat) before VUs start, and fails fast with the area name on any
unexpected response. The dataspace liveness probe hits `GET /.well-known/dspace-version`
(unauthenticated, server-level endpoint).

| Group          | Weight | Endpoints exercised                                                                  |
| -------------- | ------ | ------------------------------------------------------------------------------------ |
| `logging`      | 15%    | `POST /logging` (write); every 20th iter `GET /logging?limit=20`                     |
| `blob`         | 12%    | `SOAK_WRITE_RATIO` chance → `POST /blob`; else `GET /blob/:id` + `/content`          |
| `aig`          | 12%    | write-ratio → `POST /aig`; else `GET /aig/:id`; occasional list `GET /aig?limit=20`  |
| `ais`          | 12%    | create stream once per VU; then `POST /ais/:id/entries` + `GET /ais/:id/entries`     |
| `identity`     | 12%    | `GET /identity/:org` (resolve) + `GET /identity/profile/` (own)                      |
| `telemetry`    | 8%     | `GET /telemetry/metric?limit=20`                                                     |
| `auth`         | 7%     | `GET /authentication/admin/users/:email`                                             |
| `notarization` | 8%     | write-ratio → `POST /notarization`; else `GET /notarization/:id`                     |
| `fedcat`       | 7%     | write-ratio → `POST /catalog/datasets`; else trust-token `POST .../request`          |
| `dataspace`    | 7%     | write-ratio → `POST /dataspace/app-datasets`; else `GET /dataspace/app-datasets/:id` |

Weights sum to 1.0. Traffic is read-heavy (~65% reads) with continuous writes from logging and ais,
and `SOAK_WRITE_RATIO`-governed writes for blob, aig, notarization, fedcat, and dataspace. This
keeps storage-growth and memory-leak signals live for the full run.

The `fedcat` group exercises trust-token generation + refresh: every catalog query call calls
`ensureTrustToken()`, which issues `POST /identity/:org/verifiable-credential/trust-assertion`
when the cached token is absent or within 60s of expiry. With `TWIN_TRUST_JWT_TTL=3600` set in
both profiles, each VU's trust token is refreshed approximately once per hour.

Per-group metrics (`grp_<name>_duration`, `grp_<name>_reqs`, `grp_<name>_errors`) are declared
as custom k6 metrics and appear in `report.json` under `k6.groups`. Global thresholds
(`http_req_duration` p95/p99, `http_req_failed`) are the enforced gate; per-group metrics are
visibility only.

**Local run length note:** continuous blob/aig creates grow storage quickly (intentional — it
surfaces the file-local latency degradation). For local smoke testing, shorter runs (5–10m) keep
storage manageable. Reserve 60m runs for mysql-local or CI.

## Profiles

- **`file-local`** (default) — file-backed entity storage + file-backed blob storage. Latency
  degrades over time under write load (expected and detectable by the harness). Enables all 10
  groups including notarization, federated-catalogue, and dataspace (which auto-enables rights
  management, trust, and background tasks).
- **`mysql-local`** — MySQL-backed, requires the Docker container from the profile header comment.
  Latency stays flat; ~9× higher throughput than file-local. Same 10-group coverage as file-local.
  Thresholds are calibrated from the observed baseline — recalibrate after a 60-min run when new
  groups are added.
- **`iota-testnet`** (planned) — IOTA identity/NFT/wallet; nightly/pre-release only.

Env-var names in the profiles are validated by the node's strict validation (#243) — a
typo fails the run at startup rather than silently falling back to defaults. Keep names
exact, or set `SOAK_STRICT_ENV=warn` while iterating.

## Layout

```text
soak/
  run-soak.mjs             # orchestrator: bootstrap → start → /readyz → k6 load → teardown
  memory-verdict.mjs       # pure memory-growth verdict estimator (unit tested directly)
  generate-report.mjs      # CLI: renders one run's report.json into the published dashboard
  report-renderer.mjs      # pure HTML rendering functions used by generate-report.mjs
  scenarios/
    twin-soak.js          # k6 scenario: 10 weighted groups, per-group metrics, setup() preflight
  config/
    soak.file-local.env   # default profile (file-backed)
    soak.mysql-local.env  # MySQL-backed profile
    soak.cloud.env        # targets an externally-deployed node (e.g. kitsune staging)
  web/                    # dashboard site shell (index.html/style.css/images) — see below
  .out/                   # gitignored: server.log, file-storage data, summary.json, report.json
```

## Published dashboard

Every soak run that produces a `report.json` gets published to **<https://soaktest.twindev.org/>**
by the `soak.yaml` workflow, immediately after the run finishes (success or failure — a failed
run's page is exactly the one people want to read).

**How it works**: `generate-report.mjs` renders the run's `report.json`/`summary.json` into a
self-contained HTML page (no external scripts/stylesheets — it must render offline), and updates
the site's `runs.json` manifest + `index.html` history listing. The rendered site accumulates on a
dedicated **`soak-reports`** branch in this repo — an orphan branch, unrelated to `next`/`main`,
that holds nothing but the deployed site (see its own `README.md` on that branch). The workflow
checks it out, refreshes the static assets from this repo's `web/` directory, adds the new run, commits
as "TWIN GitHub Bot" (same signed-commit pattern as `twin-schema`'s `update-schemas.yaml`), pushes,
and deploys the branch's contents to Vercel.

**To regenerate a page locally** (e.g. to preview a shell change before it publishes):

```bash
node soak/generate-report.mjs \
  --report soak/.out/report.json \
  --summary soak/.out/summary.json \
  --site /tmp/site-preview \
  --run-id local-preview
# open /tmp/site-preview/index.html in a browser
```

**Editing the site shell**: `web/` on `next` is the source of truth for `index.html`, `style.css`,
and the images — never edit them directly on the `soak-reports` branch, they get overwritten by the
next publish. A shell change reaches the live site on the very next run.

**Charts**: the memory panel draws an inline SVG chart (RSS over time, warm-up window shaded,
floor-start/floor-end/peak marked) whenever `report.series` has at least 3 points — no external
charting library, so the page stays self-contained/offline-renderable. Local runs and telemetry-
sourced cloud runs (`SOAK_MEM_SOURCE=telemetry`) both populate it; a run with no series (the
default cloud stub) falls back to text explaining why. A second, display-only CPU panel
(`system_cpu_usage_percent`, no growth verdict — CPU has no leak-like failure mode) renders the
same way whenever `report.cpuSeries` is present; today only `SOAK_MEM_SOURCE=telemetry` runs
populate it. Every run page also links out to Grafana with the run's time range
(`config.startedIso`/`finishedIso` in `report.json`) for full-fidelity drill-down.
