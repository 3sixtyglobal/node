#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build, bootstrap, and provision the Multi-Node Docker environment
# =============================================================================
# Run from this directory: ./setup.sh
#
# Steps:
#   1. Build Docker image from local code
#   2. Start IPFS
#   3. Bootstrap Node A — Shipper/Docket (creates identity on IOTA testnet)
#   4. Bootstrap Node B — Twin UK Hub
#   5. Bootstrap Node C — Logistics Partner
#   6. Print admin passwords and next steps
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

echo -e "${BOLD}Multi-Node Docker Setup (3 nodes)${NC}"
echo -e "  Node A: Shipper/Docket (trusted, port 3010)"
echo -e "  Node B: Twin UK Hub (port 3011)"
echo -e "  Node C: Logistics Partner (port 3012)"
echo ""

# -------------------------------------------------------------------------
# Step 0: Clean up previous containers (preserves volumes unless --clean)
# -------------------------------------------------------------------------
if [ "${1:-}" = "--clean" ]; then
    echo -e "${BOLD}Step 0: Cleaning up containers AND volumes (--clean)...${NC}"
    docker compose down -v 2>/dev/null || true
    rm -f "${PASSWORD_FILE}"
    ok "Clean slate (volumes + saved passwords removed)"
    shift  # Remove --clean from args so it doesn't interfere
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

# Wait for IPFS to be ready (IPFS can take 30-60s on first start)
MAX_IPFS_ATTEMPTS=30
for i in $(seq 1 ${MAX_IPFS_ATTEMPTS}); do
    if curl -sf -X POST http://localhost:5011/api/v0/id >/dev/null 2>&1; then
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
# Step 3: Bootstrap Node A (Shipper/Docket)
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Bootstrapping Node A — Shipper/Docket (creates IOTA identity, ~60s)...${NC}"
step "This creates a DID on IOTA testnet and generates an admin password"

TMPFILE_A=$(mktemp)
TMPFILE_B=""
TMPFILE_C=""
trap "rm -f ${TMPFILE_A} ${TMPFILE_B:-} ${TMPFILE_C:-}" EXIT

# Check if Node A is already bootstrapped (engine-state.json exists in volume)
NODE_A_STATE=$(docker compose run --rm -T --no-deps twin-node-a sh -c 'cat /app/data/engine-state.json 2>/dev/null' 2>/dev/null || true)
if echo "${NODE_A_STATE}" | grep -q "nodeId"; then
    NODE_A_DID=$(echo "${NODE_A_STATE}" | sed -n 's/.*"nodeId"[^"]*"\([^"]*\)".*/\1/p')
    # Load saved password
    NODE_A_PASSWORD=$(grep '^NODE_A=' "${PASSWORD_FILE}" 2>/dev/null | cut -d= -f2- || true)
    if [ -z "${NODE_A_PASSWORD}" ]; then
        warn "Node A already bootstrapped but password not saved. You'll need to provide it manually."
    fi
    ok "Node A already bootstrapped (DID: ${NODE_A_DID}), skipping"
else
    set +e
    docker compose run --rm -T twin-node-a node src/index.js bootstrap-legacy 2>&1 | tee "${TMPFILE_A}"
    NODE_A_EXIT=$?
    set -e

    if [ ${NODE_A_EXIT} -ne 0 ]; then
        echo "  Bootstrap output:"
        cat "${TMPFILE_A}"
        fail "Node A bootstrap failed (exit code ${NODE_A_EXIT})"
    fi

    NODE_A_PASSWORD=$(grep -i "password" "${TMPFILE_A}" | grep -oE '[^ ]+$' | tail -1)
    if [ -z "${NODE_A_PASSWORD}" ]; then
        warn "Could not auto-extract Node A password. Check output:"
        tail -20 "${TMPFILE_A}"
    else
        # Save password for future runs
        touch "${PASSWORD_FILE}"
        sed -i.bak '/^NODE_A=/d' "${PASSWORD_FILE}" 2>/dev/null || true
        echo "NODE_A=${NODE_A_PASSWORD}" >> "${PASSWORD_FILE}"
        rm -f "${PASSWORD_FILE}.bak"
        ok "Node A (Shipper) bootstrapped. Admin password: ${NODE_A_PASSWORD}"
    fi
fi

# -------------------------------------------------------------------------
# Step 4: Bootstrap Node B (Twin UK Hub)
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Bootstrapping Node B — Twin UK Hub (creates IOTA identity, ~60s)...${NC}"

TMPFILE_B=$(mktemp)

NODE_B_STATE=$(docker compose run --rm -T --no-deps twin-node-b sh -c 'cat /app/data/engine-state.json 2>/dev/null' 2>/dev/null || true)
if echo "${NODE_B_STATE}" | grep -q "nodeId"; then
    NODE_B_DID=$(echo "${NODE_B_STATE}" | sed -n 's/.*"nodeId"[^"]*"\([^"]*\)".*/\1/p')
    NODE_B_PASSWORD=$(grep '^NODE_B=' "${PASSWORD_FILE}" 2>/dev/null | cut -d= -f2- || true)
    if [ -z "${NODE_B_PASSWORD}" ]; then
        warn "Node B already bootstrapped but password not saved. You'll need to provide it manually."
    fi
    ok "Node B already bootstrapped (DID: ${NODE_B_DID}), skipping"
else
    set +e
    docker compose run --rm -T twin-node-b node src/index.js bootstrap-legacy 2>&1 | tee "${TMPFILE_B}"
    NODE_B_EXIT=$?
    set -e

    if [ ${NODE_B_EXIT} -ne 0 ]; then
        echo "  Bootstrap output:"
        cat "${TMPFILE_B}"
        fail "Node B bootstrap failed (exit code ${NODE_B_EXIT})"
    fi

    NODE_B_PASSWORD=$(grep -i "password" "${TMPFILE_B}" | grep -oE '[^ ]+$' | tail -1)
    if [ -z "${NODE_B_PASSWORD}" ]; then
        warn "Could not auto-extract Node B password. Check output:"
        tail -20 "${TMPFILE_B}"
    else
        touch "${PASSWORD_FILE}"
        sed -i.bak '/^NODE_B=/d' "${PASSWORD_FILE}" 2>/dev/null || true
        echo "NODE_B=${NODE_B_PASSWORD}" >> "${PASSWORD_FILE}"
        rm -f "${PASSWORD_FILE}.bak"
        ok "Node B (Twin UK) bootstrapped. Admin password: ${NODE_B_PASSWORD}"
    fi
fi

# -------------------------------------------------------------------------
# Step 5: Bootstrap Node C (Logistics Partner)
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5: Bootstrapping Node C — Logistics Partner (creates IOTA identity, ~60s)...${NC}"

TMPFILE_C=$(mktemp)

NODE_C_STATE=$(docker compose run --rm -T --no-deps twin-node-c sh -c 'cat /app/data/engine-state.json 2>/dev/null' 2>/dev/null || true)
if echo "${NODE_C_STATE}" | grep -q "nodeId"; then
    NODE_C_DID=$(echo "${NODE_C_STATE}" | sed -n 's/.*"nodeId"[^"]*"\([^"]*\)".*/\1/p')
    NODE_C_PASSWORD=$(grep '^NODE_C=' "${PASSWORD_FILE}" 2>/dev/null | cut -d= -f2- || true)
    if [ -z "${NODE_C_PASSWORD}" ]; then
        warn "Node C already bootstrapped but password not saved. You'll need to provide it manually."
    fi
    ok "Node C already bootstrapped (DID: ${NODE_C_DID}), skipping"
else
    set +e
    docker compose run --rm -T twin-node-c node src/index.js bootstrap-legacy 2>&1 | tee "${TMPFILE_C}"
    NODE_C_EXIT=$?
    set -e

    if [ ${NODE_C_EXIT} -ne 0 ]; then
        echo "  Bootstrap output:"
        cat "${TMPFILE_C}"
        fail "Node C bootstrap failed (exit code ${NODE_C_EXIT})"
    fi

    NODE_C_PASSWORD=$(grep -i "password" "${TMPFILE_C}" | grep -oE '[^ ]+$' | tail -1)
    if [ -z "${NODE_C_PASSWORD}" ]; then
        warn "Could not auto-extract Node C password. Check output:"
        tail -20 "${TMPFILE_C}"
    else
        touch "${PASSWORD_FILE}"
        sed -i.bak '/^NODE_C=/d' "${PASSWORD_FILE}" 2>/dev/null || true
        echo "NODE_C=${NODE_C_PASSWORD}" >> "${PASSWORD_FILE}"
        rm -f "${PASSWORD_FILE}.bak"
        ok "Node C (Logistics) bootstrapped. Admin password: ${NODE_C_PASSWORD}"
    fi
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Multi-Node Setup Complete (3 nodes)${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  Node A (Shipper)    password: ${NODE_A_PASSWORD:-<check logs above>}"
echo -e "  Node B (Twin UK)    password: ${NODE_B_PASSWORD:-<check logs above>}"
echo -e "  Node C (Logistics)  password: ${NODE_C_PASSWORD:-<check logs above>}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${YELLOW}Provision a StorageItem on IOTA testnet${NC}"
echo -e "     ./provision-storage.sh '${NODE_A_PASSWORD:-<pw-a>}' '${NODE_B_PASSWORD:-<pw-b>}' '${NODE_C_PASSWORD:-<pw-c>}'"
echo ""
echo -e "  2. ${YELLOW}Start all nodes:${NC}"
echo -e "     docker compose up -d twin-node-a twin-node-b twin-node-c"
echo ""
echo -e "  3. ${YELLOW}Wait for nodes to be ready, then run the test:${NC}"
echo -e "     ./multi-n2n-docker-test.sh '${NODE_A_PASSWORD:-<pw-a>}' '${NODE_B_PASSWORD:-<pw-b>}' '${NODE_C_PASSWORD:-<pw-c>}'"
echo ""
echo -e "  4. ${YELLOW}Tear down:${NC}"
echo -e "     docker compose down -v"
echo ""
