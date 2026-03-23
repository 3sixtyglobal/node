#!/usr/bin/env bash
# =============================================================================
# provision-storage.sh — Create an IOTA StorageItem for synchronized storage
# =============================================================================
# Run AFTER both nodes have been bootstrapped (Step 6 in README).
# Node A must be running on port 3000.
#
# Usage:
#   ./provision-storage.sh '<node-a-password>'
#
# What it does:
#   1. Reads wallet mnemonics from local data directories
#   2. Derives IOTA addresses from mnemonics
#   3. Logs in to Node A and creates a StorageItem via REST API
#   4. Updates both env files with the new StorageItem ID
#
# After this script, restart both nodes to pick up the new env values.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../../../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "${BLUE}  -> $1${NC}"; }
ok()   { echo -e "${GREEN}  [OK] $1${NC}"; }
fail() { echo -e "${RED}  [FAIL] $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}  [WARN] $1${NC}"; }

# -------------------------------------------------------------------------
# Arguments
# -------------------------------------------------------------------------
if [ $# -lt 1 ]; then
    echo -e "${BOLD}Usage:${NC} ./provision-storage.sh '<node-a-password>'"
    echo ""
    echo "  Node A must be running on port 3000."
    echo "  Password is printed during bootstrap-legacy."
    exit 1
fi

NODE_A_PASSWORD="$1"
NODE_A_HOST="${NODE_A_HOST:-http://localhost:3000}"

echo -e "${BOLD}Provision IOTA StorageItem (Local)${NC}"
echo ""

# -------------------------------------------------------------------------
# Step 1: Read mnemonics from local vault stores
# -------------------------------------------------------------------------
echo -e "${BOLD}Step 1: Reading wallet mnemonics...${NC}"

VAULT_A="${WORKSPACE_ROOT}/node/.local-data/node-a/vault-secret/store.json"
VAULT_B="${WORKSPACE_ROOT}/node/.local-data/node-b/vault-secret/store.json"

if [ ! -f "${VAULT_A}" ]; then
    fail "Node A vault not found at ${VAULT_A}. Run bootstrap-legacy first."
fi
if [ ! -f "${VAULT_B}" ]; then
    fail "Node B vault not found at ${VAULT_B}. Run bootstrap-legacy first."
fi

MNEMONIC_A=$(node -e "
const store = JSON.parse(require('fs').readFileSync('${VAULT_A}', 'utf8'));
const entry = store.find(e => e.id.endsWith('/mnemonic'));
if (!entry) { process.exit(1); }
process.stdout.write(entry.data);
" 2>/dev/null) || fail "Could not extract Node A mnemonic from ${VAULT_A}"

MNEMONIC_B=$(node -e "
const store = JSON.parse(require('fs').readFileSync('${VAULT_B}', 'utf8'));
const entry = store.find(e => e.id.endsWith('/mnemonic'));
if (!entry) { process.exit(1); }
process.stdout.write(entry.data);
" 2>/dev/null) || fail "Could not extract Node B mnemonic from ${VAULT_B}"

ok "Node A mnemonic extracted (${#MNEMONIC_A} chars)"
ok "Node B mnemonic extracted (${#MNEMONIC_B} chars)"

# -------------------------------------------------------------------------
# Step 2: Derive IOTA addresses
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Deriving IOTA wallet addresses...${NC}"

# Use the IOTA SDK from node/node_modules (ESM import)
ADDR_A=$(cd "${WORKSPACE_ROOT}/node" && node --input-type=module -e "
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
const kp = Ed25519Keypair.deriveKeypair('${MNEMONIC_A}', \"m/44'/4218'/0'/0'/0'\");
process.stdout.write(kp.getPublicKey().toIotaAddress());
" 2>/dev/null) || fail "Could not derive Node A address. Is @iota/iota-sdk installed in node/node_modules?"

ADDR_B=$(cd "${WORKSPACE_ROOT}/node" && node --input-type=module -e "
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
const kp = Ed25519Keypair.deriveKeypair('${MNEMONIC_B}', \"m/44'/4218'/0'/0'/0'\");
process.stdout.write(kp.getPublicKey().toIotaAddress());
" 2>/dev/null) || fail "Could not derive Node B address. Is @iota/iota-sdk installed in node/node_modules?"

ok "Node A address: ${ADDR_A}"
ok "Node B address: ${ADDR_B}"

# -------------------------------------------------------------------------
# Step 3: Check Node A is reachable
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Checking Node A...${NC}"

curl -sf "${NODE_A_HOST}/health" >/dev/null 2>&1 || fail "Node A not reachable at ${NODE_A_HOST}/health. Start it first."
ok "Node A is reachable"

# -------------------------------------------------------------------------
# Step 4: Login to Node A
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Logging in to Node A...${NC}"

LOGIN_RESPONSE=$(curl -si -X POST "${NODE_A_HOST}/authentication/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"admin@node\",\"password\":\"${NODE_A_PASSWORD}\"}" 2>/dev/null)

TOKEN=$(echo "${LOGIN_RESPONSE}" | grep -i 'set-cookie:' | sed 's/.*access_token=//;s/;.*//' | tr -d '[:space:]')

if [ -z "${TOKEN}" ]; then
    echo "${LOGIN_RESPONSE}"
    fail "Could not extract session token. Check the password."
fi

ok "Session token obtained (${#TOKEN} chars)"

# -------------------------------------------------------------------------
# Step 5: Create StorageItem
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5: Creating StorageItem on IOTA testnet...${NC}"
step "Allow list: [${ADDR_A}, ${ADDR_B}]"
step "Initial data: empty sync pointer store (base64)"

# Base64 of {"version":"1","syncPointers":{}}
INITIAL_DATA="eyJ2ZXJzaW9uIjoiMSIsInN5bmNQb2ludGVycyI6e319"

CREATE_RESPONSE=$(curl -s -X POST "${NODE_A_HOST}/verifiable" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{
        \"data\": \"${INITIAL_DATA}\",
        \"allowList\": [\"${ADDR_A}\", \"${ADDR_B}\"],
        \"maxAllowListSize\": 100
    }" 2>/dev/null)

STORAGE_ID=$(echo "${CREATE_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -z "${STORAGE_ID}" ]; then
    echo "  Response: ${CREATE_RESPONSE}"
    fail "Could not create StorageItem. Check the response above."
fi

ok "StorageItem created: ${STORAGE_ID}"

# -------------------------------------------------------------------------
# Step 6: Update env files
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 6: Updating env files...${NC}"

ENV_A="${WORKSPACE_ROOT}/node/apps/node/.env.node-a"
ENV_B="${WORKSPACE_ROOT}/node/apps/node/.env.node-b"

if [ ! -f "${ENV_A}" ]; then
    warn "${ENV_A} not found — skipping. Update manually."
else
    sed -i.bak "s|^TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=.*|TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=\"${STORAGE_ID}\"|" "${ENV_A}"
    rm -f "${ENV_A}.bak"
    ok "Updated .env.node-a"
fi

if [ ! -f "${ENV_B}" ]; then
    warn "${ENV_B} not found — skipping. Update manually."
else
    sed -i.bak "s|^TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=.*|TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=\"${STORAGE_ID}\"|" "${ENV_B}"
    rm -f "${ENV_B}.bak"
    ok "Updated .env.node-b"
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  StorageItem Provisioned${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  StorageItem ID: ${STORAGE_ID}"
echo -e "  Node A address: ${ADDR_A}"
echo -e "  Node B address: ${ADDR_B}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${YELLOW}Stop Node A${NC} (Ctrl+C)"
echo -e "  2. ${YELLOW}Restart both nodes${NC} with the updated env files"
echo -e "  3. ${YELLOW}Run the test:${NC}"
echo -e "     ./node/apps/node/tests/node-to-node/n2n-synced-storage.sh '<pw-a>' '<pw-b>'"
echo ""
