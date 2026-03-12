#!/usr/bin/env bash
# =============================================================================
# provision-storage.sh — Create an IOTA StorageItem for synchronized storage
# =============================================================================
# Run from this directory AFTER setup.sh has completed (both nodes bootstrapped).
#
# Usage:
#   ./provision-storage.sh '<node-a-password>' '<node-b-password>'
#
# What it does:
#   1. Extracts wallet mnemonics from both container volumes
#   2. Derives IOTA addresses from mnemonics (inside containers)
#   3. Starts Node A temporarily
#   4. Logs in and creates a StorageItem via REST API (with both addresses)
#   5. Updates both env files with the new StorageItem ID
#   6. Stops Node A
#
# After this script, run:
#   docker compose up -d twin-node-a twin-node-b
#   ./n2n-docker-test.sh '<pw-a>' '<pw-b>'
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

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
if [ $# -lt 2 ]; then
    echo -e "${BOLD}Usage:${NC} ./provision-storage.sh '<node-a-password>' '<node-b-password>'"
    echo ""
    echo "  Passwords are printed by setup.sh after bootstrapping."
    exit 1
fi

NODE_A_PASSWORD="$1"
NODE_B_PASSWORD="$2"

echo -e "${BOLD}Provision IOTA StorageItem${NC}"
echo ""

# -------------------------------------------------------------------------
# Step 1: Extract mnemonics from container volumes
# -------------------------------------------------------------------------
echo -e "${BOLD}Step 1: Extracting wallet mnemonics...${NC}"

# Start containers briefly to access volumes (if not running)
docker compose up -d twin-node-a twin-node-b >/dev/null 2>&1
sleep 3

MNEMONIC_A=$(docker compose exec -T twin-node-a node -e "
const fs = require('fs');
const store = JSON.parse(fs.readFileSync('/app/data/vault-secret/store.json', 'utf8'));
const entry = store.find(e => e.id.endsWith('/mnemonic'));
if (!entry) { process.exit(1); }
process.stdout.write(entry.data);
" 2>/dev/null) || fail "Could not extract Node A mnemonic. Has bootstrap-legacy been run?"

MNEMONIC_B=$(docker compose exec -T twin-node-b node -e "
const fs = require('fs');
const store = JSON.parse(fs.readFileSync('/app/data/vault-secret/store.json', 'utf8'));
const entry = store.find(e => e.id.endsWith('/mnemonic'));
if (!entry) { process.exit(1); }
process.stdout.write(entry.data);
" 2>/dev/null) || fail "Could not extract Node B mnemonic. Has bootstrap-legacy been run?"

ok "Node A mnemonic extracted (${#MNEMONIC_A} chars)"
ok "Node B mnemonic extracted (${#MNEMONIC_B} chars)"

# -------------------------------------------------------------------------
# Step 2: Derive IOTA addresses
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Deriving IOTA wallet addresses...${NC}"

ADDR_A=$(docker compose exec -T twin-node-a node --input-type=module -e "
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
const kp = Ed25519Keypair.deriveKeypair('${MNEMONIC_A}', \"m/44'/4218'/0'/0'/0'\");
process.stdout.write(kp.getPublicKey().toIotaAddress());
" 2>/dev/null) || fail "Could not derive Node A address"

ADDR_B=$(docker compose exec -T twin-node-b node --input-type=module -e "
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
const kp = Ed25519Keypair.deriveKeypair('${MNEMONIC_B}', \"m/44'/4218'/0'/0'/0'\");
process.stdout.write(kp.getPublicKey().toIotaAddress());
" 2>/dev/null) || fail "Could not derive Node B address"

ok "Node A address: ${ADDR_A}"
ok "Node B address: ${ADDR_B}"

# -------------------------------------------------------------------------
# Step 3: Wait for Node A to be ready
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Waiting for Node A to be ready...${NC}"

MAX_HEALTH_ATTEMPTS=30
for i in $(seq 1 ${MAX_HEALTH_ATTEMPTS}); do
    if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
        ok "Node A is ready"
        break
    fi
    if [ "$i" -eq ${MAX_HEALTH_ATTEMPTS} ]; then
        fail "Node A failed to become healthy after ${MAX_HEALTH_ATTEMPTS} attempts"
    fi
    step "Waiting for Node A... (attempt $i/${MAX_HEALTH_ATTEMPTS})"
    sleep 2
done

# -------------------------------------------------------------------------
# Step 4: Login to Node A
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Logging in to Node A...${NC}"

LOGIN_RESPONSE=$(curl -si -X POST http://localhost:3000/authentication/login \
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

CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/verifiable \
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

ENV_A="${SCRIPT_DIR}/env/node-a-docker.env"
ENV_B="${SCRIPT_DIR}/env/node-b-docker.env"

# Replace the TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID line
sed -i.bak "s|^TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=.*|TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=\"${STORAGE_ID}\"|" "${ENV_A}"
sed -i.bak "s|^TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=.*|TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=\"${STORAGE_ID}\"|" "${ENV_B}"

# Clean up backup files
rm -f "${ENV_A}.bak" "${ENV_B}.bak"

ok "Updated ${ENV_A##*/}"
ok "Updated ${ENV_B##*/}"

# -------------------------------------------------------------------------
# Step 7: Stop nodes (so they pick up new env on next start)
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 7: Stopping nodes...${NC}"

docker compose stop twin-node-a twin-node-b >/dev/null 2>&1
ok "Nodes stopped"

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
echo -e "  1. ${YELLOW}Start both nodes:${NC}"
echo -e "     docker compose up -d twin-node-a twin-node-b"
echo ""
echo -e "  2. ${YELLOW}Run the test:${NC}"
echo -e "     ./n2n-docker-test.sh '${NODE_A_PASSWORD}' '${NODE_B_PASSWORD}'"
echo ""
echo -e "  3. ${YELLOW}Tear down when done:${NC}"
echo -e "     docker compose down -v"
echo ""
