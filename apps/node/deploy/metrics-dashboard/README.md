# Twin Node — Metrics Dashboard

A local Prometheus + Grafana stack that visualises all 14 metrics exposed by the twin-node when configured with the OpenTelemetry connector.

The dashboard has three rows:

- **Host metrics** (`system_*`) — CPU, memory, system uptime
- **Process metrics** (`process_*`) — RSS, heap, Node.js process uptime
- **App demo metrics** (`app_*`) — event loop lag, app info labels, startup counter

> **Two metric layers visible on this dashboard:**
>
> - **Library metrics** (`system_*`, `process_*`) are built into `@twin.org/node-core`.
> - **App demo metrics** (`app_*`) live in [`apps/node/src/metrics/`](../src/metrics/). Wired in [`apps/node/src/index.js`](../src/index.js). **Copy that folder when adding metrics to your own twin-based app — see [`AppMetricsExample.md`](../src/metrics/AppMetricsExample.md).**

---

## Prerequisites

- Docker with Compose V2 (`docker compose version`)
- The twin-node binary running locally with OpenTelemetry + Prometheus enabled (step 1 below)

---

## Setup

### 1. Configure and start the twin-node

In `apps/node/.env`, set:

```bash
TWIN_TELEMETRY_CONNECTOR="open-telemetry"
TWIN_OPEN_TELEMETRY_READER="prometheus"
TWIN_OPEN_TELEMETRY_PROMETHEUS_PORT="9464"

TWIN_TELEMETRY_METRICS_COLLECTOR_INTERVAL_SECONDS="15"
TWIN_TELEMETRY_SYSTEM_METRICS_MAX_HISTORY="1440"

TWIN_APP_METRICS_ENABLED="true"
```

Then start the node from `apps/node/`:

```bash
node src/index.js
```

Verify metrics are being scraped:

```bash
curl -s http://localhost:9464/metrics | grep "^system_"
```

### 2. Start Prometheus and Grafana

From this directory (`metrics-dashboard/`):

```bash
docker compose up -d
```

This starts:

- **Prometheus** at `http://localhost:9090` — scrapes `:9464` every 15 s
- **Grafana** at `http://localhost:4000` — login `admin` / `admin`

> **Port note:** Grafana is mapped to port **4000** (not 3000) to avoid conflicting with the twin-node REST server on `:3000`.

### 3. Open the dashboard

Navigate to `http://localhost:4000` and log in with `admin` / `admin`.

The **Twin Node** dashboard is pre-provisioned and appears immediately under **Dashboards**. No manual import needed.

---

## Stopping

```bash
docker compose down
```

Add `-v` to also remove the Grafana persistent volume (resets the login state):

```bash
docker compose down -v
```

---

## Troubleshooting

### Prometheus shows "No data" for all metrics

Check that the twin-node is running and `:9464` is reachable from Docker:

```bash
curl -s http://localhost:9464/metrics | head -5
```

On Linux, confirm `host.docker.internal` resolves — the `extra_hosts` entry in `docker-compose.yml` handles this automatically.

### `app_*` metrics are missing

Ensure `TWIN_APP_METRICS_ENABLED="true"` is set in `.env` before starting the node.

### Grafana login fails

The default credentials are `admin` / `admin`. Grafana will prompt you to change the password on first login — you can skip it.
