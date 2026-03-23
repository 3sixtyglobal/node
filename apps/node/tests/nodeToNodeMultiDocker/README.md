# Multi-Node Docker Test (3-Node Supply Chain)

Simulates a 3-node supply chain scenario with Dockerized TWIN nodes communicating via the Dataspace Protocol (DSP).

## Scenario

```text
Node A (Shipper/Docket)    — publishes consignment data, trusted node
Node B (Twin UK Hub)       — central hub, publishes own data
Node C (Logistics Partner) — consumes from both A and B
```

### Data Flows Tested

| Flow | Consumer | Provider | Scenario                                    |
| ---- | -------- | -------- | ------------------------------------------- |
| 1    | Node A   | Node B   | Shipper consumes hub data from Twin UK      |
| 2    | Node C   | Node B   | Logistics consumes hub data from Twin UK    |
| 3    | Node C   | Node A   | Logistics consumes consignment from Shipper |

### Sync Topology (Star)

```text
        Node A (Trusted)
       /        \
  Node B         Node C
```

Both B and C sync from Node A via `TWIN_SYNCHRONISED_STORAGE_TRUSTED_URL`.

## Port Mapping

| Service | Internal Port | Host Port | Container Name    |
| ------- | ------------- | --------- | ----------------- |
| IPFS    | 5001          | 5011      | twin-multi-ipfs   |
| Node A  | 3000          | 3010      | twin-multi-node-a |
| Node B  | 3001          | 3011      | twin-multi-node-b |
| Node C  | 3002          | 3012      | twin-multi-node-c |

Host ports are offset from the 2-node setup (3000→3010) to allow both setups to coexist.

## Prerequisites

- Docker and docker compose installed
- All workspace modules built: `npm run submodule:dist-no-test` from workspace root
- IOTA testnet reachable
- `jq` installed

### Cross-Submodule Dependencies

The Docker image copies packages from multiple submodules at build time (see `Dockerfile`). These must be built before running `docker compose build`:

| Submodule              | Packages used                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node`                 | `node-core`, `apps/node`                                                                                                                               |
| `data-space-connector` | `dataspace-control-plane-service`, `dataspace-models`, **`dataspace-test-app`**                                                                        |
| `rights-management`    | `rights-management-rest-client`, `rights-management-pnp-service`, `rights-management-plugins`, `rights-management-service`, `rights-management-models` |
| `standards`            | `standards-dataspace-protocol`                                                                                                                         |
| `federated-catalogue`  | `federated-catalogue-service`, `federated-catalogue-models`                                                                                            |
| `verifiable-storage`   | `verifiable-storage-connector-iota`                                                                                                                    |
| `auditable-item-graph` | `auditable-item-graph-models`, `auditable-item-graph-rest-client`, `auditable-item-graph-service`                                                      |
| `framework`            | `entity`                                                                                                                                               |
| `data`                 | `data-core`                                                                                                                                            |
| `api`                  | `api-core`                                                                                                                                             |

> **Note:** `@twin.org/dataspace-test-app` is loaded dynamically by the engine at runtime via `local-link` or Dockerfile `COPY`. It is **not** a dependency in `node/package.json` — do not add it.

## Quick Start

```bash
# 1. Bootstrap all 3 nodes (creates DIDs on IOTA testnet, ~5 min)
#    Passwords are saved to .node-passwords for subsequent runs.
./setup.sh

# 2. Provision IOTA StorageItem (adds all 3 addresses to allowList)
./provision-storage.sh '<pw-a>' '<pw-b>' '<pw-c>'

# 3. Start all nodes
docker compose up -d twin-node-a twin-node-b twin-node-c

# 4. Wait for health, then run the full test
./multi-n2n-docker-test.sh '<pw-a>' '<pw-b>' '<pw-c>'

# 5. Tear down
docker compose down -v
```

### Passwords

`setup.sh` generates random admin passwords during bootstrap and saves them to `.node-passwords` (git-ignored). On subsequent runs, it skips already-bootstrapped nodes and loads saved passwords. Use `./setup.sh --clean` to wipe all volumes, containers, and saved passwords for a fresh start.

## Test Phases

| Phase | Description                                                              |
| ----- | ------------------------------------------------------------------------ |
| 0     | Prerequisites: IPFS + 3 node health checks                               |
| 1     | Authentication: login, DID extraction, JWT-VC trust tokens (all 3 nodes) |
| 2     | Seed ODRL Offers into Node A and Node B PAPs                             |
| 3     | Discovery: verify each node has its own catalogue dataset                |
| 4     | Flow 1: A<-B full DSP transfer (negotiate + request + pull + complete)   |
| 5     | Flow 2: C<-B full DSP transfer                                           |
| 6     | Flow 3: C<-A full DSP transfer                                           |
| 7     | Final verification: health, IPFS, catalogue consistency                  |

## Troubleshooting

### `notInAllowList` error

Run `provision-storage.sh` again after `docker compose down -v` — volumes are deleted, new addresses need a fresh StorageItem.

### Sync not working

- Check `TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID` is set in all 3 env files (done by `provision-storage.sh`)
- Check Node A is the trusted node (no `TWIN_SYNCHRONISED_STORAGE_TRUSTED_URL`)
- Increase wait time: `SYNC_MAX_RETRIES=30 ./multi-n2n-docker-test.sh ...`

### Port conflicts

This setup uses ports 3010-3012 and 5011 (not 3000-3002 and 5001). If you have the 2-node setup running, they won't conflict.

### Negotiation stuck

Check container logs: `docker compose logs twin-node-b | tail -50`. The pass-through negotiator should auto-accept within ~100ms. Common cause: consumer negotiation entry not pre-created (race condition).

### Bootstrap slow or failing

Each node creates a DID on IOTA testnet (~60s each). If the faucet is rate-limited, bootstrap may take longer. Check `docker compose logs` for errors.

### Clean restart

`./setup.sh --clean` removes all volumes, containers, and `.node-passwords`. Use this when containers have stale data or identities are corrupted. You'll need to re-run `provision-storage.sh` after a clean restart since new mnemonics generate new IOTA addresses.

## Differences from 2-Node Setup

| Aspect           | 2-Node (`nodeToNodeDocker/`) | 3-Node (this directory)       |
| ---------------- | ---------------------------- | ----------------------------- |
| Nodes            | 2 (A, B)                     | 3 (A, B, C)                   |
| Host ports       | 3000, 3001, 5001             | 3010, 3011, 3012, 5011        |
| Container prefix | `twin-`                      | `twin-multi-`                 |
| Network          | `twin-network`               | `twin-multi-network`          |
| Test script      | Monolithic (833 lines)       | Modular with helper functions |
| Data flows       | 1 (A<-B)                     | 3 (A<-B, C<-B, C<-A)          |
| StorageItem      | 2 addresses                  | 3 addresses                   |
