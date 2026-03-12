# N2N Synchronized Storage Test

End-to-end test for the Dataspace Protocol with synchronized storage. Two TWIN nodes exchange data via the DSP flow while their Federated Catalogues stay in sync via IPFS and IOTA verifiable storage. Node A discovers Node B's datasets from its **own local catalogue** — no cross-node HTTP catalogue query needed.

## Architecture

```mermaid
Node A (port 3000)                          Node B (port 3001)
  Trusted node                                Regular node
  Writes sync pointers to IOTA                Points to Node A as trusted
       |                                           |
       +----------- IPFS (Docker) ----------------+
       |        Blob transport for sync data       |
       |                                           |
       +------ IOTA Testnet (Verifiable Storage) --+
                Sync pointer storage
```

## Prerequisites

- **Node.js** >= 20.0.0
- **Docker** (for IPFS container)
- **jq** (`brew install jq` on macOS, `apt install jq` on Linux)
- **IOTA testnet** reachable: `curl https://api.testnet.iota.cafe/health`
- **All modules built**: `npm run submodule:dist-no-test` from workspace root
- **Three terminal windows** (Node A, Node B, test runner)

## Quick Start

```bash
# 1. Setup (symlinks, env files, IPFS) — see detailed steps below
# 2. Bootstrap both nodes (creates identities on IOTA testnet)
# 3. Provision StorageItem (with Node A running)
./node/apps/node/tests/node-to-node/provision-storage.sh '<pw-a>'
# 4. Restart both nodes with updated env files
# 5. Run the test
./node/apps/node/tests/node-to-node/n2n-synced-storage.sh '<pw-a>' '<pw-b>'
```

## Scripts

| Script                 | Purpose                                                     | When to run             |
| ---------------------- | ----------------------------------------------------------- | ----------------------- |
| `provision-storage.sh` | Derive addresses, create IOTA StorageItem, update env files | Once per bootstrap      |
| `n2n-synced-storage.sh`| Run the full DSP + PNP test flow                            | After nodes are running |

## Setup

All commands run from the **workspace root** unless stated otherwise.

### 1. Install the test app extension

```bash
cd node && npm install @twin.org/dataspace-test-app@next && cd ..
```

### 2. Symlink local packages

```bash
cd node
npm run local-link "@twin.org/dataspace*"
npm run local-link "@twin.org/federated-catalogue*"
npm run local-link "@twin.org/rights-management*"
npm run local-link "@twin.org/standards-dataspace-protocol"
npm run local-link "@twin.org/node-core"
npm run local-link "@twin.org/synchronised-storage*"
npm run local-link "@twin.org/verifiable-storage*"
cd ..

cd data-space-connector
npm run local-link "@twin.org/standards-dataspace-protocol"
cd ..
```

Verify symlinks:

```bash
ls -la node/node_modules/@twin.org/dataspace-models
# Should show a symlink -> ../../../data-space-connector/packages/dataspace-models
```

### 3. Copy env files

```bash
cp node/apps/node/tests/node-to-node/env/node-a-synced.env node/apps/node/.env.node-a
cp node/apps/node/tests/node-to-node/env/node-b-synced.env node/apps/node/.env.node-b
```

### 4. Handle the default .env

If `node/apps/node/.env` exists, it will overwrite `--env-file` values at startup (dotenv `Object.assign`s over `process.env`). Rename it:

```bash
[ -f node/apps/node/.env ] && mv node/apps/node/.env node/apps/node/.env.default-backup
```

Restore when done: `mv node/apps/node/.env.default-backup node/apps/node/.env`

### 5. Start IPFS

```bash
docker run -d --name twin-blob-ipfs -p 4001:4001 -p 5001:5001 -p 8080:8080 ipfs/kubo:latest
```

Verify: `curl -s -X POST http://localhost:5001/api/v0/id | jq '.ID'`

### 6. Bootstrap both nodes

Each node creates an identity on the IOTA testnet (~60 seconds per node).

**Terminal 1:**

```bash
cd node/apps/node
node --env-file=.env.node-a src/index.js bootstrap-legacy
```

**Terminal 2:**

```bash
cd node/apps/node
node --env-file=.env.node-b src/index.js bootstrap-legacy
```

**Save the admin passwords** printed by each bootstrap — you need them to run the tests.

### 7. Provision IOTA StorageItem

Start Node A temporarily, then run the provisioning script:

**Terminal 1:**

```bash
cd node/apps/node
node --env-file=.env.node-a src/index.js
# Wait for: API listening on http://0.0.0.0:3000
```

**Terminal 3 (test runner):**

```bash
./node/apps/node/tests/node-to-node/provision-storage.sh '<node-a-password>'
```

The script:

1. Reads wallet mnemonics from `node/.local-data/node-{a,b}/vault-secret/store.json`
2. Derives IOTA addresses using the SDK
3. Creates a StorageItem on-chain with both addresses in the allowlist
4. Updates `.env.node-a` and `.env.node-b` with the new StorageItem ID

After provisioning, stop Node A (Ctrl+C).

**When is re-provisioning needed?** Only when node mnemonics change — i.e., after
cleaning `node/.local-data/` and re-running bootstrap. If you restart nodes without
wiping data, the existing StorageItem remains valid.

### 8. Start both nodes

**Terminal 1** (start Node A first — Node B needs it for the sync encryption key):

```bash
cd node/apps/node
node --env-file=.env.node-a src/index.js
```

Wait for: `API listening on http://0.0.0.0:3000`

**Terminal 2:**

```bash
cd node/apps/node
node --env-file=.env.node-b src/index.js
```

Wait for: `API listening on http://0.0.0.0:3001`

## Running the Bash Script

From any directory:

```bash
./node/apps/node/tests/node-to-node/n2n-synced-storage.sh '<node-a-password>' '<node-b-password>'
```

Wrap passwords in single quotes to prevent shell expansion of special characters.

## Test Phases

| Phase | Description                                                       |
| ----- | ----------------------------------------------------------------- |
| 0     | Prerequisites (IPFS + both nodes reachable)                       |
| 1     | Authentication (login + JWT-VC trust tokens + ODRL offer on PAP)  |
| 1.5   | Contract Negotiation (PNP — see below)                            |
| 2     | Discovery (Node B's dataset syncs to Node A's catalogue via IPFS) |
| 3     | Transfer Request (consumer requests data from provider)           |
| 4     | Start Transfer (provider returns data access token)               |
| 5     | Pull Data (consumer fetches entities)                             |
| 6     | Complete Transfer (signal completion)                             |
| 7     | Verify (final state + IPFS health)                                |

### Phase 1.5: PNP Contract Negotiation

Instead of seeding an ODRL Agreement directly on the PAP, the test runs the full
PNP negotiation flow:

1. An ODRL **Offer** (not Agreement) is seeded on Node B's PAP
2. Node A sends a `ContractRequestMessage` to Node B's PNP endpoint
3. Node B's pass-through policy negotiator auto-accepts and callbacks to Node A
4. The negotiation progresses through: REQUESTED → OFFERED → ACCEPTED → AGREED
5. The resulting agreement ID is used for the subsequent transfer phases

**Consumer-side state injection:** Since `sendRequestToProvider` is an internal-only method
(no REST endpoint), the script injects a consumer-side negotiation entry on Node A via the
PNAP admin PUT endpoint (`/rights-management/negotiations/admin/:policyId`). This simulates
what the `DataspaceControlPlaneService.negotiateAgreement()` does internally.

## Configuration Reference

| Variable           | Default                        |
| ------------------ | ------------------------------ |
| `NODE_A_PORT`      | `3000`                         |
| `NODE_B_PORT`      | `3001`                         |
| `NODE_A_HOST`      | `http://localhost:3000`        |
| `NODE_B_HOST`      | `http://localhost:3001`        |
| `NODE_A_EMAIL`     | `admin@node`                   |
| `NODE_B_EMAIL`     | `admin@node`                   |
| `IPFS_API`         | `http://localhost:5001/api/v0` |
| `SYNC_MAX_RETRIES` | `12`                           |
| `SYNC_RETRY_DELAY` | `10` (seconds)                 |

## Troubleshooting

| Problem                                                           | Fix                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| IPFS not reachable                                                | `docker start twin-blob-ipfs` or re-create the container                                         |
| `Failed to load extension`                                        | Run `cd node && npm install @twin.org/dataspace-test-app@next`                                   |
| `nodeIdentityNotSet`                                              | Run `bootstrap-legacy` first                                                                     |
| Identity connector shows `entity-storage`                         | A default `node/apps/node/.env` is overriding your env file — rename it (Step 4)                 |
| Login failed                                                      | Use the password from bootstrap output, not a custom one                                         |
| Catalogue empty on Node B                                         | Ensure symlinks are in place (Step 2)                                                            |
| Dataset never syncs to Node A                                     | Check `TWIN_SYNCHRONISED_STORAGE_ENABLED=true` in both env files                                 |
| `Maximum call stack size exceeded` at bootstrap                   | Do NOT set `TWIN_ENTITY_STORAGE_CONNECTOR_DEFAULT="synchronised"` — it causes infinite recursion |
| `verifiableStorageKeyNotFound`                                    | Set `TWIN_VERIFIABLE_STORAGE_CONNECTOR=iota` in both env files                                   |
| `iotaVerifiableStorageConnector.updateFailed` with `TypeMismatch` | Stale `verifiableStorageKeys.json` — run `provision-storage.sh` to create a new StorageItem      |
| `objectHelper.failedBytesToJSON`                                  | StorageItem was seeded with invalid data — re-run `provision-storage.sh`                         |
| `notInAllowList` (abort 401)                                      | Node wallet address not in StorageItem allowlist — re-run `provision-storage.sh`                 |
| Node B can't get encryption key                                   | Start Node A first; check `TWIN_SYNCHRONISED_STORAGE_TRUSTED_URL` in Node B's env                |
| `entityStorageVaultConnector.keyNotFound` for encryption key      | Vault key DID-scoping mismatch — see `bootstrapLegacy.ts` workaround in the codebase             |
| Faucet funding timeout                                            | IOTA testnet may be slow — wait and retry bootstrap                                              |
| `updateFailed` with `Invalid command argument` after flow         | Allowlist wipe bug — symlink local: `npm run local-link "@twin.org/verifiable-storage*"`         |

## Clean Restart

Wipe all node state and start fresh (from workspace root):

```bash
rm -rf node/.local-data/node-a node/.local-data/node-b
```

Directories are auto-created on first write. After cleaning, re-run bootstrap (Step 6) and provision a new StorageItem (Step 7) since the new mnemonics will produce different IOTA addresses.
