# twin-node soak / load harness

> Created: 2026-06-24
> Last updated: 2026-06-24

Drives sustained HTTP load against a fully-bootstrapped twin-node, samples the node process's
OS-level memory usage throughout the run, and fails the run when memory-growth / latency / error-rate
thresholds are breached.

> **Status:** Phases 1–4 working. The orchestrator bootstraps a file-backed node, starts it,
> waits for `GET /readyz`, drives k6 load (per-VU API-key login → JWT cookie → org-scoped
> authenticated read) while sampling the node process's memory, prints a summary, and exits
> non-zero on a k6 threshold breach or an enforced memory-growth breach. Still to come: the
> weighted traffic mix (phase 5) and the nightly CI workflow (phase 6).
>
> Memory is sampled at the OS level (private bytes via the process PID), not via the node's
> telemetry API — in a standalone node that API returns only the startup value (see the plan
> §8.2). The growth verdict is the **tail-floor slope**: the post-GC floor (per-bucket minimum)
> fitted over the settled second half of the run — this strips both GC sawtooth and the warm-up
> ramp, so it reads "settling" vs "leaking" honestly (a raw slope over-reported 856 MB/hr on a
> node that was actually flat; tail-floor read 100). It is only a _fatal_ verdict once the window
> is long enough (`SOAK_MEM_MIN_WINDOW`, default 10m) with ≥4 tail buckets; shorter runs report
> it as informational.
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
| `SOAK_DURATION`                            | `2m`                              | k6 run length (e.g. `30s`, `2m`, `30m`)                                     |
| `SOAK_VUS`                                 | `5`                               | Virtual users                                                               |
| `SOAK_P95_MS` / `SOAK_P99_MS`              | `500` / `1500`                    | Latency ceilings (k6 thresholds)                                            |
| `SOAK_ERROR_RATE`                          | `0.01`                            | Max failed-request rate (1%)                                                |
| `SOAK_K6_BIN`                              | _(auto)_                          | Override k6 binary path (else PATH, then default Windows install)           |
| `SOAK_SAMPLE_INTERVAL`                     | `10s`                             | Memory sampling cadence                                                     |
| `SOAK_MEM_GROWTH_MB_PER_HR`                | `150`                             | Max tail-floor memory-growth slope (enforced only past the min window)      |
| `SOAK_WARMUP_DISCARD`                      | `30s`                             | Initial window excluded from the growth slope (warm-up)                     |
| `SOAK_MEM_MIN_WINDOW`                      | `10m`                             | Settled-window length below which memory growth is informational, not fatal |

A k6 threshold breach **or** an enforced memory-growth breach makes the run exit non-zero.
Outputs: `soak/.out/summary.json` (k6) and `soak/.out/report.json` (combined: config, k6
verdict, memory series + verdict).

## Profiles

- **`file-local`** (default) — self-contained, file-backed entity storage. The standard
  local/CI profile.
- **`iota-testnet`** (planned) — IOTA identity/NFT/wallet; nightly/pre-release only.

Env-var names in the profiles are validated by the node's strict validation (#243) — a
typo fails the run at startup rather than silently falling back to defaults. Keep names
exact, or set `SOAK_STRICT_ENV=warn` while iterating.

## Layout

```text
soak/
  run-soak.mjs            # orchestrator (this phase: bootstrap → start → /readyz → teardown)
  config/
    soak.file-local.env   # default profile
  .out/                   # gitignored: server.log, file-storage data
```
