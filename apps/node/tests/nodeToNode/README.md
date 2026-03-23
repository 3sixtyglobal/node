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

The sync service writes to a pre-existing on-chain `StorageItem`. Each developer (or clean restart) needs their own because the `StorageItem` allowlist contains specific wallet addresses derived from the bootstrap mnemonic.

**a) Derive node IOTA addresses:**

Mnemonics are in `node/.local-data/node-{a,b}/vault-secret/store.json`.

```bash
cd node
node -e "
const { Ed25519Keypair } = require('@iota/iota-sdk/keypairs/ed25519');
const kp = Ed25519Keypair.deriveKeypair('<MNEMONIC_FROM_STORE_JSON>', \"m/44'/4218'/0'/0'/0'\");
console.log(kp.getPublicKey().toIotaAddress());
"
cd ..
```

Run this for both Node A and Node B mnemonics.

**b) Start Node A temporarily:**

```bash
cd node/apps/node
node --env-file=.env.node-a src/index.js
```

Wait for `API listening on http://0.0.0.0:3000`.

**c) Create StorageItem via REST API:**

```bash
# Login
TOKEN=$(curl -si -X POST http://localhost:3000/authentication/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@node","password":"<NODE_A_PASSWORD>"}' \
  | grep -i 'set-cookie:' | sed 's/.*access_token=//;s/;.*//' | tr -d '[:space:]')

# Create StorageItem with both node addresses in allowlist
curl -s -X POST http://localhost:3000/verifiable/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "data": "eyJ2ZXJzaW9uIjoiMSIsInN5bmNQb2ludGVycyI6e319",
    "allowList": ["<NODE_A_IOTA_ADDR>", "<NODE_B_IOTA_ADDR>"],
    "maxAllowListSize": 100
  }' | jq '.id'
```

This returns an ID like `verifiable:iota:<packageId>:<objectId>`.

The `data` value is base64 of `{"version":"1","syncPointers":{}}` — the empty initial state the sync service expects.

**d) Stop Node A**, then update **both** env files (`.env.node-a` and `.env.node-b`):

```bash
TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID="verifiable:iota:<packageId>:<objectId>"
```

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

### Expected output

All 8 phases should pass:

| Phase | Description                                                  |
| ----- | ------------------------------------------------------------ |
| 0     | Prerequisites (IPFS + both nodes reachable)                  |
| 1     | Authentication (login + JWT-VC trust token + ODRL agreement) |
| 2     | Discovery (Node B's dataset syncs to Node A's catalogue)     |
| 3     | Transfer Request (consumer requests data)                    |
| 4     | Start Transfer (provider returns data access token)          |
| 5     | Pull Data (consumer fetches entities)                        |
| 6     | Complete Transfer (signal completion)                        |
| 7     | Verify (final state + IPFS health)                           |

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
| `iotaVerifiableStorageConnector.updateFailed` with `TypeMismatch` | Stale `verifiableStorageKeys.json` — create a new StorageItem via Step 7                         |
| `objectHelper.failedBytesToJSON`                                  | StorageItem was seeded with invalid data — recreate with the base64 value from Step 7c           |
| `notInAllowList` (abort 401)                                      | Node wallet address not in StorageItem allowlist — recreate with both addresses from Step 7a     |
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
