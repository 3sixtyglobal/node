# Mobius Supply Chain Docker Test (4-Node)

Simulates the Mobius freight forwarder supply chain scenario with 4 Dockerized TWIN nodes communicating via the Dataspace Protocol (DSP), with per-item ODRL filtering based on UN/LOCODE.

## Scenario

```text
Mobius (Freight Forwarder)            — Publisher, publishes consignment data
Ashford Port Health (Border Agency)   — Consumer (UN/LOCODE: GBDVR, GBFOL)
Suffolk Coastal Port Health           — Consumer (UN/LOCODE: GBFXT, GBHWR)
MCP (Port Community System)           — Consumer (all locations)
```

### Data Flows Tested

| Flow | Consumer | Provider | Filtering                          |
| ---- | -------- | -------- | ---------------------------------- |
| 1    | Ashford  | Mobius   | Sees only `unece:LOCODE#GBDVR`     |
| 2    | Suffolk  | Mobius   | Sees only `unece:LOCODE#GBFXT`     |
| 3    | MCP      | Mobius   | Sees all consignments (no filter)  |

### Per-Item ODRL Filtering

Each consumer has a dedicated ODRL offer with `AssetCollection` refinement constraints on `unloadingLocation.id`. The `DefaultPolicyArbiter` evaluates these per array element, and the `DefaultPolicyEnforcementProcessor` filters denied items from the response.

## Port Mapping

| Service | Internal Port | Host Port | Container Name    |
| ------- | ------------- | --------- | ----------------- |
| IPFS    | 5001          | 5021      | twin-mobius-ipfs  |
| Mobius   | 3000          | 3020      | twin-mobius-node  |
| Ashford  | 3001          | 3021      | twin-ashford-node |
| Suffolk  | 3002          | 3022      | twin-suffolk-node |
| MCP      | 3003          | 3023      | twin-mcp-node     |

## Prerequisites

- Docker and docker compose (v2)
- All workspace submodules built: `npm run submodule:dist-no-test` from workspace root
- IOTA testnet reachable
- `jq` installed

### Cross-Submodule Dependencies

The Docker image copies packages from multiple submodules at build time (see `Dockerfile`). These must be built **before** running `docker compose build`:

| Submodule | Packages used |
| --------- | ------------- |
| `node` | `node-core`, `apps/node` |
| `data-space-connector` | `dataspace-control-plane-service`, `dataspace-data-plane-service`, `dataspace-models`, **`dataspace-test-app`** |
| `rights-management` | `rights-management-*` (models, service, plugins, pap, pep, pnp, rest-client) |
| `standards` | `standards-dataspace-protocol`, `standards-w3c-odrl` |
| `synchronised-storage` | `synchronised-storage-models` |
| `federated-catalogue` | `federated-catalogue-service`, `federated-catalogue-models` |
| `verifiable-storage` | `verifiable-storage-connector-iota` |
| `auditable-item-graph` | `auditable-item-graph-models`, `auditable-item-graph-rest-client`, `auditable-item-graph-service` |
| `framework` | `entity` |
| `data` | `data-core` |
| `api` | `api-core` |

> **Note:** `@twin.org/dataspace-test-app` is **not** a dependency in `node/package.json`. It is loaded dynamically by the engine at runtime and reaches `node_modules` via `npm run local-link` (local dev) or `COPY` in the Dockerfile (Docker). Do not add it as a package.json dependency.

If you only changed a specific submodule, you can rebuild just that one:

```bash
cd <submodule> && npm run dist
```

## Quick Start

```bash
cd node/apps/node/tests/mobius-supply-chain-docker

# 1. Bootstrap all 4 nodes (creates DIDs on IOTA testnet, ~8 min)
#    Passwords are saved to .node-passwords for subsequent runs.
./setup.sh

# 2. Provision IOTA StorageItem (adds all 4 addresses to allowList)
./provision-storage.sh '<pw-mobius>' '<pw-ashford>' '<pw-suffolk>' '<pw-mcp>'

# 3. Start all nodes
docker compose up -d

# 4. Wait for health, then run the full test
./mobius-test.sh '<pw-mobius>' '<pw-ashford>' '<pw-suffolk>' '<pw-mcp>'

# 5. Tear down
docker compose down -v
```

### Passwords

`setup.sh` generates random admin passwords during bootstrap and saves them to `.node-passwords` (git-ignored). On subsequent runs, it skips already-bootstrapped nodes and loads saved passwords. Use `./setup.sh --clean` to wipe all volumes, containers, and saved passwords for a fresh start.

## Test Phases

| Phase | Description |
| ----- | ----------- |
| 0     | Prerequisites: IPFS + 4 node health checks |
| 1     | Authentication: login, DID extraction, JWT-VC trust tokens (all 4 nodes) |
| 2     | Seed 3 per-consumer ODRL offers on Mobius (AssetCollection refinements) |
| 3     | Discovery: verify federated catalogue has datasets |
| 4     | Contract Negotiation: Ashford <-> Mobius |
| 5     | Contract Negotiation: Suffolk <-> Mobius |
| 6     | Contract Negotiation: MCP <-> Mobius |
| 7     | Data Transfer: Ashford pulls from Mobius |
| 8     | Data Transfer: Suffolk pulls from Mobius |
| 9     | Data Transfer: MCP pulls from Mobius |
| 10    | Location filtering verification (per-consumer LOCODE check) |
| 11    | Final verification: health, IPFS, catalogue consistency |

## Troubleshooting

### `notInAllowList` error

Run `provision-storage.sh` again after `docker compose down -v` — volumes are deleted, new addresses need a fresh StorageItem.

### Negotiation stuck

Check container logs: `docker compose logs twin-mobius-node | tail -50`. The `default` policy arbiter evaluates ODRL constraints; ensure the offers were seeded correctly in Phase 2.

### Bootstrap slow or failing

Each node creates a DID on IOTA testnet (~60s each, 4 nodes total). If the faucet is rate-limited, bootstrap may take longer. Check `docker compose logs` for errors.

### Build fails with missing exports

The Dockerfile overrides specific `@twin.org/*` packages with locally built versions. If a package was renamed or its exports changed upstream, rebuild the affected submodule (`npm run dist`) and re-run `docker compose build`.

### Clean restart

```bash
./setup.sh --clean   # wipes volumes, containers, .node-passwords
./setup.sh           # re-bootstrap
./provision-storage.sh '<pw-mobius>' '<pw-ashford>' '<pw-suffolk>' '<pw-mcp>'
docker compose up -d
```
