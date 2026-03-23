#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build, bootstrap, and provision the Docker N2N environment
# =============================================================================
# Run from this directory: ./setup.sh
#
# Steps:
#   1. Build Docker image from local code
#   2. Start IPFS
#   3. Bootstrap Node A (creates identity on IOTA testnet)
#   4. Bootstrap Node B
#   5. Print admin passwords and next steps
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

echo -e "${BOLD}N2N Docker Setup${NC}"
echo ""

# -------------------------------------------------------------------------
# Step 0: Clean up any previous containers (ensures fresh port bindings)
# -------------------------------------------------------------------------
echo -e "${BOLD}Step 0: Cleaning up previous containers and volumes...${NC}"
docker compose down -v 2>/dev/null || true
ok "Clean slate"

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
    if curl -sf -X POST http://localhost:5001/api/v0/id >/dev/null 2>&1; then
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
# Step 3: Bootstrap Node A
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Bootstrapping Node A (creates IOTA identity, ~60s)...${NC}"
step "This creates a DID on IOTA testnet and generates an admin password"

TMPFILE_A=$(mktemp)
trap "rm -f ${TMPFILE_A} ${TMPFILE_B:-}" EXIT

set +e
docker compose run --rm -T twin-node-a node src/index.js bootstrap-legacy > "${TMPFILE_A}" 2>&1
NODE_A_EXIT=$?
set -e

if [ ${NODE_A_EXIT} -ne 0 ]; then
    echo "  Bootstrap output:"
    cat "${TMPFILE_A}"
    fail "Node A bootstrap failed (exit code ${NODE_A_EXIT})"
fi

# Extract admin password from output
NODE_A_PASSWORD=$(grep -i "password" "${TMPFILE_A}" | grep -oE '[^ ]+$' | tail -1)
if [ -z "${NODE_A_PASSWORD}" ]; then
    warn "Could not auto-extract Node A password. Check output:"
    tail -20 "${TMPFILE_A}"
else
    ok "Node A bootstrapped. Admin password: ${NODE_A_PASSWORD}"
fi

# -------------------------------------------------------------------------
# Step 4: Bootstrap Node B
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Bootstrapping Node B (creates IOTA identity, ~60s)...${NC}"

TMPFILE_B=$(mktemp)

set +e
docker compose run --rm -T twin-node-b node src/index.js bootstrap-legacy > "${TMPFILE_B}" 2>&1
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
    ok "Node B bootstrapped. Admin password: ${NODE_B_PASSWORD}"
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Setup Complete${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  Node A password: ${NODE_A_PASSWORD:-<check logs above>}"
echo -e "  Node B password: ${NODE_B_PASSWORD:-<check logs above>}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${YELLOW}Provision a StorageItem on IOTA testnet${NC}"
echo -e "     The sync service needs a pre-existing on-chain StorageItem."
echo -e "     See the README.md in this directory for instructions."
echo -e "     Then update TWIN_SYNCHRONISED_STORAGE_VERIFIABLE_STORAGE_KEY_ID"
echo -e "     in both env/node-a-docker.env and env/node-b-docker.env."
echo ""
echo -e "  2. ${YELLOW}Start both nodes:${NC}"
echo -e "     docker compose up -d twin-node-a twin-node-b"
echo ""
echo -e "  3. ${YELLOW}Wait for both nodes to be ready, then run the test:${NC}"
echo -e "     ./n2n-docker-test.sh '${NODE_A_PASSWORD:-<pw-a>}' '${NODE_B_PASSWORD:-<pw-b>}'"
echo ""
echo -e "  4. ${YELLOW}Tear down:${NC}"
echo -e "     docker compose down -v"
echo ""
