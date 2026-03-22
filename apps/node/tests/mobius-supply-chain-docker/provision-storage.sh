#!/usr/bin/env bash
# =============================================================================
# provision-storage.sh — Create an IOTA StorageItem for 4-node synchronized storage
# =============================================================================
# Run from this directory AFTER setup.sh has completed (all 4 nodes bootstrapped).
#
# Usage:
#   ./provision-storage.sh '<mobius-pw>' '<ashford-pw>' '<suffolk-pw>' '<mcp-pw>'
#
# What it does:
#   1. Extracts wallet mnemonics from all 4 container volumes
#   2. Derives IOTA addresses from mnemonics (inside containers)
#   3. Starts Mobius temporarily
#   4. Logs in and creates a StorageItem via REST API (with all 4 addresses)
#   5. Updates all 4 env files with the new StorageItem ID
#   6. Stops all nodes
#
# After this script, run:
#   docker compose up -d twin-mobius twin-ashford twin-suffolk twin-mcp
#   ./mobius-test.sh '<mobius-pw>' '<ashford-pw>' '<suffolk-pw>' '<mcp-pw>'
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
if [ $# -lt 4 ]; then
    echo -e "${BOLD}Usage:${NC} ./provision-storage.sh '<mobius-pw>' '<ashford-pw>' '<suffolk-pw>' '<mcp-pw>'"
    echo ""
    echo "  Passwords are printed by setup.sh after bootstrapping."
    exit 1
fi

MOBIUS_PASSWORD="$1"
ASHFORD_PASSWORD="$2"
SUFFOLK_PASSWORD="$3"
MCP_PASSWORD="$4"

echo -e "${BOLD}Provision IOTA StorageItem (4 nodes)${NC}"
echo ""

# -------------------------------------------------------------------------
# Step 1: Extract mnemonics from container volumes
# -------------------------------------------------------------------------
echo -e "${BOLD}Step 1: Extracting wallet mnemonics...${NC}"

docker compose up -d twin-mobius twin-ashford twin-suffolk twin-mcp >/dev/null 2>&1
sleep 3

extract_mnemonic() {
    local service="$1" label="$2"
    local mnemonic
    mnemonic=$(docker compose exec -T "${service}" node -e "
const fs = require('fs');
const store = JSON.parse(fs.readFileSync('/app/data/vault-secret/store.json', 'utf8'));
const entry = store.find(e => e.id.endsWith('/mnemonic'));
if (!entry) { process.exit(1); }
process.stdout.write(entry.data);
" 2>/dev/null) || fail "Could not extract ${label} mnemonic. Has bootstrap-legacy been run?"
    ok "${label} mnemonic extracted (${#mnemonic} chars)" >&2
    echo "${mnemonic}"
}

MNEMONIC_MOBIUS=$(extract_mnemonic "twin-mobius" "Mobius")
MNEMONIC_ASHFORD=$(extract_mnemonic "twin-ashford" "Ashford")
MNEMONIC_SUFFOLK=$(extract_mnemonic "twin-suffolk" "Suffolk")
MNEMONIC_MCP=$(extract_mnemonic "twin-mcp" "MCP")

# -------------------------------------------------------------------------
# Step 2: Derive IOTA addresses
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Deriving IOTA wallet addresses...${NC}"

derive_address() {
    local service="$1" mnemonic="$2" label="$3"
    local addr
    addr=$(docker compose exec -T "${service}" node --input-type=module -e "
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
const kp = Ed25519Keypair.deriveKeypair('${mnemonic}', \"m/44'/4218'/0'/0'/0'\");
process.stdout.write(kp.getPublicKey().toIotaAddress());
" 2>/dev/null) || fail "Could not derive ${label} address"
    ok "${label} address: ${addr}" >&2
    echo "${addr}"
}

ADDR_MOBIUS=$(derive_address "twin-mobius" "${MNEMONIC_MOBIUS}" "Mobius")
ADDR_ASHFORD=$(derive_address "twin-ashford" "${MNEMONIC_ASHFORD}" "Ashford")
ADDR_SUFFOLK=$(derive_address "twin-suffolk" "${MNEMONIC_SUFFOLK}" "Suffolk")
ADDR_MCP=$(derive_address "twin-mcp" "${MNEMONIC_MCP}" "MCP")

# -------------------------------------------------------------------------
# Step 3: Wait for Mobius to be ready
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Waiting for Mobius to be ready...${NC}"

MAX_HEALTH_ATTEMPTS=30
for i in $(seq 1 ${MAX_HEALTH_ATTEMPTS}); do
    if curl -sf http://localhost:3020/health >/dev/null 2>&1; then
        ok "Mobius is ready"
        break
    fi
    if [ "$i" -eq ${MAX_HEALTH_ATTEMPTS} ]; then
        fail "Mobius failed to become healthy after ${MAX_HEALTH_ATTEMPTS} attempts"
    fi
    step "Waiting for Mobius... (attempt $i/${MAX_HEALTH_ATTEMPTS})"
    sleep 2
done

# -------------------------------------------------------------------------
# Step 4: Login to Mobius
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Logging in to Mobius...${NC}"

LOGIN_RESPONSE=$(curl -si -X POST http://localhost:3020/authentication/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"admin@node\",\"password\":\"${MOBIUS_PASSWORD}\"}" 2>/dev/null)

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
step "Allow list: [Mobius, Ashford, Suffolk, MCP]"
step "Initial data: empty sync pointer store (base64)"

# Base64 of {"version":"1","syncPointers":{}}
INITIAL_DATA="eyJ2ZXJzaW9uIjoiMSIsInN5bmNQb2ludGVycyI6e319"

CREATE_RESPONSE=$(curl -s -X POST http://localhost:3020/verifiable \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{
        \"data\": \"${INITIAL_DATA}\",
        \"allowList\": [\"${ADDR_MOBIUS}\", \"${ADDR_ASHFORD}\", \"${ADDR_SUFFOLK}\", \"${ADDR_MCP}\"],
        \"maxAllowListSize\": 100
    }" 2>/dev/null)

STORAGE_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.id // ""')

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

ENV_MOBIUS="${SCRIPT_DIR}/env/mobius-docker.env"
ENV_ASHFORD="${SCRIPT_DIR}/env/ashford-docker.env"
ENV_SUFFOLK="${SCRIPT_DIR}/env/suffolk-docker.env"
ENV_MCP="${SCRIPT_DIR}/env/mcp-docker.env"

for envfile in "${ENV_MOBIUS}" "${ENV_ASHFORD}" "${ENV_SUFFOLK}" "${ENV_MCP}"; do
    sed -i.bak "s|^TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=.*|TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID=\"${STORAGE_ID}\"|" "${envfile}"
    rm -f "${envfile}.bak"
    ok "Updated ${envfile##*/}"
done

# -------------------------------------------------------------------------
# Step 7: Stop nodes (so they pick up new env on next start)
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 7: Stopping nodes...${NC}"

docker compose stop twin-mobius twin-ashford twin-suffolk twin-mcp >/dev/null 2>&1
ok "Nodes stopped"

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  StorageItem Provisioned (4 nodes)${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  StorageItem ID: ${STORAGE_ID}"
echo -e "  Mobius (Freight Forwarder) address: ${ADDR_MOBIUS}"
echo -e "  Ashford (Port Health)     address: ${ADDR_ASHFORD}"
echo -e "  Suffolk (Coastal PH)      address: ${ADDR_SUFFOLK}"
echo -e "  MCP (Port Community)      address: ${ADDR_MCP}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${YELLOW}Start all nodes:${NC}"
echo -e "     docker compose up -d twin-mobius twin-ashford twin-suffolk twin-mcp"
echo ""
echo -e "  2. ${YELLOW}Run the test:${NC}"
echo -e "     ./mobius-test.sh '${MOBIUS_PASSWORD}' '${ASHFORD_PASSWORD}' '${SUFFOLK_PASSWORD}' '${MCP_PASSWORD}'"
echo ""
echo -e "  3. ${YELLOW}Tear down when done:${NC}"
echo -e "     docker compose down -v"
echo ""
