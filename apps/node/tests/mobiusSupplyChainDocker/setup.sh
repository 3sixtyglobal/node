#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build, bootstrap, and provision the Mobius Supply Chain Docker env
# =============================================================================
# Run from this directory: ./setup.sh
#
# Steps:
#   1. Build Docker image from local code
#   2. Start IPFS
#   3. Bootstrap Mobius — Freight Forwarder (creates identity on IOTA testnet)
#   4. Bootstrap Ashford — Port Health (Border Agency)
#   5. Bootstrap Suffolk — Coastal Port Health (Border Agency)
#   6. Bootstrap MCP — Port Community System (Location Operator)
#   7. Print admin passwords and next steps
#
# Prerequisites:
#   - Docker and docker compose installed
#   - All workspace modules built (npm run submodule:dist-no-test from workspace root)
#   - IOTA testnet reachable
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

PASSWORD_FILE="${SCRIPT_DIR}/.node-passwords"

# -------------------------------------------------------------------------
# Pre-funded test mnemonics (lifted from Kenya scaffold pattern)
# These public mnemonics already carry testnet balances, so bootstrap-legacy
# can skip the faucet entirely. To force faucet flow, override each one with
# an empty string: TWIN_MOBIUS_*_MNEMONIC="" ./setup.sh
# Each of the 4 nodes needs a distinct mnemonic so wallets don't collide.
# -------------------------------------------------------------------------
TWIN_MOBIUS_NODE_MNEMONIC="${TWIN_MOBIUS_NODE_MNEMONIC-undo boss jewel dog announce mistake cry brass stock debris arrest patrol recipe annual clown honey icon twist modify quarter warm lock anchor cigar}"
TWIN_MOBIUS_ASHFORD_MNEMONIC="${TWIN_MOBIUS_ASHFORD_MNEMONIC-hunt supply sun write waste imitate device bless heavy solve install basic bar assault invite globe umbrella fury drum diet inform under element banner}"
TWIN_MOBIUS_SUFFOLK_MNEMONIC="${TWIN_MOBIUS_SUFFOLK_MNEMONIC-school left lawn urban oxygen cram unveil alpha space puzzle humble leisure fatigue high width auto deputy beach various style mammal kid cube liar}"
TWIN_MOBIUS_MCP_MNEMONIC="${TWIN_MOBIUS_MCP_MNEMONIC-clog peasant gallery mouse tobacco lawn giraffe fuel cousin record burst enlist fiber fantasy indoor clog divorce music canoe reopen gorilla mutual fan loan}"

echo -e "${BOLD}Mobius Supply Chain Docker Setup (4 nodes)${NC}"
echo -e "  Mobius (Freight Forwarder):          port 3020 (trusted)"
echo -e "  Ashford Port Health (Border Agency): port 3021"
echo -e "  Suffolk Coastal Port Health:         port 3022"
echo -e "  MCP (Port Community System):         port 3023"
echo ""

# -------------------------------------------------------------------------
# Step 0: Clean up previous containers (preserves volumes unless --clean)
# -------------------------------------------------------------------------
if [ "${1:-}" = "--clean" ]; then
    echo -e "${BOLD}Step 0: Cleaning up containers AND volumes (--clean)...${NC}"
    docker compose down -v 2>/dev/null || true
    rm -f "${PASSWORD_FILE}"
    ok "Clean slate (volumes + saved passwords removed)"
    shift
else
    echo -e "${BOLD}Step 0: Stopping previous containers (volumes preserved)...${NC}"
    docker compose down 2>/dev/null || true
    ok "Containers stopped (volumes preserved)"
fi

# -------------------------------------------------------------------------
# Step 1: Build Docker image
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 1: Building Docker image...${NC}"
step "Build context: workspace root (5 levels up)"
step "This may take a while on first build (~700MB node_modules)"

docker compose build || fail "Docker build failed"
ok "Docker image built successfully"

# -------------------------------------------------------------------------
# Step 2: Start IPFS
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Starting IPFS...${NC}"

docker compose up -d twin-blob-ipfs
sleep 5

MAX_IPFS_ATTEMPTS=30
for i in $(seq 1 ${MAX_IPFS_ATTEMPTS}); do
    if curl -sf -X POST http://localhost:5021/api/v0/id >/dev/null 2>&1; then
        ok "IPFS is ready"
        break
    fi
    if [ "$i" -eq ${MAX_IPFS_ATTEMPTS} ]; then
        docker compose logs twin-blob-ipfs 2>&1 | tail -10
        fail "IPFS failed to start after ${MAX_IPFS_ATTEMPTS} attempts. Check logs above."
    fi
    step "Waiting for IPFS... (attempt $i/${MAX_IPFS_ATTEMPTS})"
    sleep 2
done

# -------------------------------------------------------------------------
# Helper: Bootstrap a node
# -------------------------------------------------------------------------
bootstrap_node() {
    local node_label="$1"
    local service_name="$2"
    local password_key="$3"
    local mnemonic="${4:-}"
    local tmpfile

    tmpfile=$(mktemp)
    trap "rm -f ${tmpfile}" RETURN

    local node_state
    node_state=$(docker compose run --rm -T --no-deps "${service_name}" sh -c 'cat /app/data/engine-state.json 2>/dev/null' 2>/dev/null || true)

    if echo "${node_state}" | grep -q "nodeId"; then
        local node_did
        node_did=$(echo "${node_state}" | sed -n 's/.*"nodeId"[^"]*"\([^"]*\)".*/\1/p')
        local saved_pw
        saved_pw=$(grep "^${password_key}=" "${PASSWORD_FILE}" 2>/dev/null | cut -d= -f2- || true)
        if [ -z "${saved_pw}" ]; then
            warn "${node_label} already bootstrapped but password not saved. You'll need to provide it manually."
        fi
        ok "${node_label} already bootstrapped (DID: ${node_did}), skipping"
        eval "NODE_${password_key}_PASSWORD=\${saved_pw:-}"
        return 0
    fi

    set +e
    if [ -n "${mnemonic}" ]; then
        step "Using pre-funded mnemonic for ${node_label} (skips faucet)"
        docker compose run --rm -T \
            -e TWIN_NODE_MNEMONIC="${mnemonic}" \
            -e TWIN_ORGANIZATION_MNEMONIC="${mnemonic}" \
            -e TWIN_ADMIN_USER_MNEMONIC="${mnemonic}" \
            "${service_name}" node src/index.js bootstrap-legacy 2>&1 | tee "${tmpfile}"
    else
        step "No pre-funded mnemonic for ${node_label} — minting fresh DID via faucet"
        docker compose run --rm -T "${service_name}" node src/index.js bootstrap-legacy 2>&1 | tee "${tmpfile}"
    fi
    local exit_code=$?
    set -e

    if [ ${exit_code} -ne 0 ]; then
        echo "  Bootstrap output:"
        cat "${tmpfile}"
        fail "${node_label} bootstrap failed (exit code ${exit_code})"
    fi

    local password
    password=$(grep -i "password" "${tmpfile}" | grep -oE '[^ ]+$' | tail -1)
    if [ -z "${password}" ]; then
        warn "Could not auto-extract ${node_label} password. Check output:"
        tail -20 "${tmpfile}"
    else
        touch "${PASSWORD_FILE}"
        sed -i.bak "/^${password_key}=/d" "${PASSWORD_FILE}" 2>/dev/null || true
        echo "${password_key}=${password}" >> "${PASSWORD_FILE}"
        rm -f "${PASSWORD_FILE}.bak"
        ok "${node_label} bootstrapped. Admin password: ${password}"
    fi

    eval "NODE_${password_key}_PASSWORD=\${password:-}"
}

# -------------------------------------------------------------------------
# Steps 3-6: Bootstrap all 4 nodes
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Bootstrapping Mobius — Freight Forwarder (creates IOTA identity, ~60s)...${NC}"
step "This creates a DID on IOTA testnet and generates an admin password"
bootstrap_node "Mobius" "twin-mobius" "MOBIUS" "${TWIN_MOBIUS_NODE_MNEMONIC}"

echo ""
echo -e "${BOLD}Step 4: Bootstrapping Ashford — Port Health (creates IOTA identity, ~60s)...${NC}"
bootstrap_node "Ashford" "twin-ashford" "ASHFORD" "${TWIN_MOBIUS_ASHFORD_MNEMONIC}"

echo ""
echo -e "${BOLD}Step 5: Bootstrapping Suffolk — Coastal Port Health (creates IOTA identity, ~60s)...${NC}"
bootstrap_node "Suffolk" "twin-suffolk" "SUFFOLK" "${TWIN_MOBIUS_SUFFOLK_MNEMONIC}"

echo ""
echo -e "${BOLD}Step 6: Bootstrapping MCP — Port Community System (creates IOTA identity, ~60s)...${NC}"
bootstrap_node "MCP" "twin-mcp" "MCP" "${TWIN_MOBIUS_MCP_MNEMONIC}"

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Mobius Supply Chain Setup Complete (4 nodes)${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  Mobius (Freight Forwarder) password: ${NODE_MOBIUS_PASSWORD:-<check logs above>}"
echo -e "  Ashford (Port Health)     password: ${NODE_ASHFORD_PASSWORD:-<check logs above>}"
echo -e "  Suffolk (Coastal PH)      password: ${NODE_SUFFOLK_PASSWORD:-<check logs above>}"
echo -e "  MCP (Port Community)      password: ${NODE_MCP_PASSWORD:-<check logs above>}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${YELLOW}Provision a StorageItem on IOTA testnet${NC}"
echo -e "     ./provision-storage.sh '${NODE_MOBIUS_PASSWORD:-<pw>}' '${NODE_ASHFORD_PASSWORD:-<pw>}' '${NODE_SUFFOLK_PASSWORD:-<pw>}' '${NODE_MCP_PASSWORD:-<pw>}'"
echo ""
echo -e "  2. ${YELLOW}Start all nodes:${NC}"
echo -e "     docker compose up -d twin-mobius twin-ashford twin-suffolk twin-mcp"
echo ""
echo -e "  3. ${YELLOW}Wait for nodes to be ready, then run the test:${NC}"
echo -e "     ./mobius-test.sh '${NODE_MOBIUS_PASSWORD:-<pw>}' '${NODE_ASHFORD_PASSWORD:-<pw>}' '${NODE_SUFFOLK_PASSWORD:-<pw>}' '${NODE_MCP_PASSWORD:-<pw>}'"
echo ""
echo -e "  4. ${YELLOW}Tear down:${NC}"
echo -e "     docker compose down -v"
echo ""
