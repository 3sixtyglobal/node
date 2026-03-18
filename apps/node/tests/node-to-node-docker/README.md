# N2N Docker Test — Synchronized Storage Demo

Run two TWIN nodes in separate Docker containers with synchronized storage over IPFS,
then execute the full DSP (Dataspace Protocol) flow from the host machine — including
PNP (Policy Negotiation Point) contract negotiation.

## Architecture

```text
Host machine
├── docker compose up  →  twin-network (bridge)
│   ├── twin-blob-ipfs-docker  (ipfs/kubo:latest)   :5001, :4001, :8080
│   ├── twin-node-a            (local build)         :3000
│   └── twin-node-b            (local build)         :3001
│
└── ./n2n-docker-test.sh  (runs from host, hits localhost:3000/3001)
```

- **Container-to-container**: Services resolve each other by Docker service name
  (`twin-node-a`, `twin-node-b`, `twin-blob-ipfs-docker`)
- **Host-to-container**: Port-forwarded via `localhost:3000`, `localhost:3001`
- **IOTA testnet**: External HTTPS, same endpoints as local setup

## Prerequisites

- Docker and docker compose (v2)
- All workspace modules built: `npm run submodule:dist-no-test` from workspace root
- `jq` installed (`brew install jq` / `apt install jq`)
- IOTA testnet reachable

## Quick Start

```bash
cd node/apps/node/tests/node-to-node-docker

# 1. Build image, start IPFS, bootstrap both nodes (~3 min)
./setup.sh
#    → saves admin passwords — copy them

# 2. Provision StorageItem on IOTA testnet (~30s)
./provision-storage.sh '<pw-a>' '<pw-b>'
#    → creates on-chain StorageItem, updates env files automatically

# 3. Start both nodes
docker compose up -d twin-node-a twin-node-b

# 4. Run the DSP flow test
./n2n-docker-test.sh '<pw-a>' '<pw-b>'

# 5. Tear down
docker compose down      # keeps data — no re-provision needed on next start
docker compose down -v   # wipes everything — must re-run setup + provision
```

## Scripts

| Script                 | Purpose                                                              | When to run                   |
| ---------------------- | -------------------------------------------------------------------- | ----------------------------- |
| `setup.sh`             | Build Docker image, start IPFS, bootstrap both nodes                 | Once per clean start          |
| `provision-storage.sh` | Create IOTA StorageItem with node wallet addresses, update env files | Once per new set of mnemonics |
| `n2n-docker-test.sh`   | Run the full DSP + PNP test flow                                     | After nodes are running       |

## StorageItem Provisioning

`provision-storage.sh` automates the full provisioning process:

1. Extracts wallet mnemonics from container volumes
2. Derives IOTA addresses using the SDK (inside containers)
3. Starts Node A, logs in, creates a StorageItem via `POST /verifiable`
4. Updates both env files with the new StorageItem ID
5. Stops nodes (so they pick up the new env on next start)

**When is re-provisioning needed?** Only when node mnemonics change — i.e., after
`docker compose down -v` (which wipes volumes) followed by a fresh `setup.sh`.
If you use `docker compose down` (without `-v`), the volumes persist and the
existing StorageItem remains valid.

**Manual provisioning:** If you prefer to provision manually, see the
[local quickstart](../../../../../z-node-to-node/workshop/n2n-quickstart.md#3b-provision-iota-storageitem-new-developers--after-clean-restart)
for step-by-step instructions using curl or the IOTA CLI.

## Test Phases

| Phase | Description                                                       |
| ----- | ----------------------------------------------------------------- |
| 0     | Prerequisites (IPFS + both node containers reachable)             |
| 1     | Authentication (login + JWT-VC trust tokens + ODRL offer on PAP)  |
| 1.5   | Contract Negotiation (PNP — see below)                            |
| 2     | Discovery (Node B's dataset syncs to Node A's catalogue via IPFS) |
| 3     | Transfer Request (consumer requests data from provider)           |
| 4     | Start Transfer (provider returns data access token)               |
| 5     | Pull Data (consumer fetches entities)                             |
| 6     | Complete Transfer (signal completion)                             |
| 7     | Verify (final state + IPFS health)                                |

### Phase 1.5: PNP Contract Negotiation

Unlike the local test which seeds an ODRL Agreement directly on the PAP, the Docker test
runs the full PNP negotiation flow:

1. An ODRL **Offer** (not Agreement) is seeded on Node B's PAP
2. Node A sends a `ContractRequestMessage` to Node B's PNP endpoint
3. Node B's pass-through policy negotiator auto-accepts and callbacks to Node A
4. The negotiation progresses through: REQUESTED → OFFERED → ACCEPTED → AGREED
5. The resulting agreement ID is used for the subsequent transfer phases

**Consumer-side state injection:** Since `sendRequestToProvider` is an internal-only method
(no REST endpoint), the script injects a consumer-side negotiation entry on Node A via the
PNAP admin PUT endpoint (`/rights-management/negotiations/admin/:policyId`). This simulates
what the `DataspaceControlPlaneService.negotiateAgreement()` does internally.

**Callback routing:** PNP callbacks between nodes use container service names
(`http://twin-node-a:3000`, `http://twin-node-b:3001`) — these resolve via Docker's
internal DNS on the bridge network.

## URL Mapping

| Purpose      | Inside containers                          | From host                      |
| ------------ | ------------------------------------------ | ------------------------------ |
| Node A       | `http://twin-node-a:3000`                  | `http://localhost:3000`        |
| Node B       | `http://twin-node-b:3001`                  | `http://localhost:3001`        |
| IPFS API     | `http://twin-blob-ipfs-docker:5001/api/v0` | `http://localhost:5001/api/v0` |
| DSP callback | `http://twin-node-a:3000/dataspace`        | N/A (container-to-container)   |
| PNP callback | `http://twin-node-a:3000`                  | N/A (container-to-container)   |

## Key Differences from Local Setup

| Aspect         | Local (`node-to-node/`)           | Docker (`node-to-node-docker/`)           |
| -------------- | --------------------------------- | ----------------------------------------- |
| Node processes | Direct `node src/index.js`        | Docker containers                         |
| Data directory | `node/.local-data/node-a/`        | Docker volumes (`node-a-data`)            |
| IPFS address   | `http://localhost:5001`           | `http://twin-blob-ipfs-docker:5001`       |
| DID state file | Local filesystem                  | `docker exec` to read from volume         |
| DSP callbacks  | `http://localhost:3000/dataspace` | `http://twin-node-a:3000/dataspace`       |
| Data endpoint  | Used as-is                        | Translated from service name to localhost |
| PUBLIC_ORIGIN  | `http://localhost:3000`           | `http://twin-node-a:3000`                 |

## Troubleshooting

**Build fails**: Ensure all workspace modules are built (`npm run submodule:dist-no-test`).
The Docker image copies `node/node_modules/` which must contain all compiled packages.

**Nodes fail to start**: Check container logs:

```bash
docker compose logs twin-node-a
docker compose logs twin-node-b
```

**Bootstrap fails**: IOTA testnet may be slow or unreachable. Check network connectivity
and retry. Each bootstrap creates a DID on-chain (~60s).

**Sync not working**: Verify `TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID` is set
in both env files and that the StorageItem exists on-chain with valid data.

**Port conflicts**: If ports 3000, 3001, or 5001 are in use, stop conflicting services
or change port mappings in `docker-compose.yml`.

**`notInAllowList` / abort code 401**: The StorageItem on IOTA doesn't include your
nodes' wallet addresses. Run `./provision-storage.sh '<pw-a>' '<pw-b>'` to create a
new one. This happens after `docker compose down -v` + fresh bootstrap.

**Clean restart**:

```bash
docker compose down -v                       # wipe volumes
./setup.sh                                   # re-bootstrap
./provision-storage.sh '<pw-a>' '<pw-b>'     # re-provision StorageItem
docker compose up -d twin-node-a twin-node-b # start nodes
```
