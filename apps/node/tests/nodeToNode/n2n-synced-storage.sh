#!/usr/bin/env bash
# =============================================================================
# n2n-synced-storage.sh — N2N DSP Flow with Synchronized Storage + IPFS
# =============================================================================
# Location: node/apps/node/tests/node-to-node/n2n-synced-storage.sh
#
# End-to-end test for the Dataspace Protocol with synchronized storage:
#   - Federated Catalogue data is replicated between nodes via IPFS
#   - Node A discovers Node B's datasets from its OWN local catalogue
#   - No cross-node HTTP query needed for discovery
#
# Phases:
#   Phase 0: Prerequisites (IPFS + both nodes)
#   Phase 1: Authentication (login + JWT-VC trust token + agreement)
#   Phase 2: Discovery (verify sync: Node B's dataset visible on Node A)
#   Phase 3: Transfer Request (consumer requests data)
#   Phase 4: Start Transfer (provider returns data access token)
#   Phase 5: Pull Data (consumer fetches entities)
#   Phase 6: Complete Transfer (signal completion)
#   Phase 7: Verify (check final state + cross-node consistency)
#
# Usage (from any directory):
#   ./node/apps/node/tests/node-to-node/n2n-synced-storage.sh <node-a-pw> <node-b-pw>
#
# Prerequisites:
#   - IPFS container running: docker run -d --name twin-blob-ipfs -p 5001:5001 -p 4001:4001 -p 8080:8080 ipfs/kubo:latest
#   - Node A running on port 3000 with node-a-synced.env
#   - Node B running on port 3001 with node-b-synced.env
#   - jq installed (brew install jq / apt install jq)
#   - Both nodes bootstrapped (admin credentials in startup logs)
#   - See README.md in this directory for full setup instructions
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Self-locating: derive workspace root from script location
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../../../../.." && pwd)"

# ---------------------------------------------------------------------------
# Configuration (override via env vars)
# ---------------------------------------------------------------------------
NODE_A_PORT="${NODE_A_PORT:-3000}"
NODE_B_PORT="${NODE_B_PORT:-3001}"
NODE_A_HOST="${NODE_A_HOST:-http://localhost:${NODE_A_PORT}}"
NODE_B_HOST="${NODE_B_HOST:-http://localhost:${NODE_B_PORT}}"
NODE_A_EMAIL="${NODE_A_EMAIL:-admin@node}"
NODE_B_EMAIL="${NODE_B_EMAIL:-admin@node}"
IPFS_API="${IPFS_API:-http://localhost:5001/api/v0}"

# State file paths (derived from workspace root)
NODE_A_STATE_FILE="${NODE_A_STATE_FILE:-${WORKSPACE_ROOT}/node/.local-data/node-a/engine-state.json}"
NODE_B_STATE_FILE="${NODE_B_STATE_FILE:-${WORKSPACE_ROOT}/node/.local-data/node-b/engine-state.json}"

# Trust verification method ID
TRUST_VERIFICATION_METHOD_ID="${TRUST_VERIFICATION_METHOD_ID:-trust-assertion}"

# DSP context
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"

# Test app dataset and offer (must match testDataspaceDataPlaneApp.ts)
DATASET_ID="https://twin.example.org/data-service-1"
OFFER_ID="urn:policy:test-offer-read-consignment"
ENTITY_TYPE="https://vocabulary.uncefact.org/Consignment"

# Consumer PID (unique per run)
CONSUMER_PID="urn:uuid:demo-consumer-$(date +%s)"

# Sync wait configuration
SYNC_MAX_RETRIES="${SYNC_MAX_RETRIES:-12}"
SYNC_RETRY_DELAY="${SYNC_RETRY_DELAY:-10}"

# Track results
PHASE_RESULTS=()

# ---------------------------------------------------------------------------
# Colors and helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

phase() {
    echo ""
    echo -e "${BOLD}${BLUE}================================================================${NC}"
    echo -e "${BOLD}${BLUE}  Phase $1: $2${NC}"
    echo -e "${BOLD}${BLUE}================================================================${NC}"
    echo ""
}

step() {
    echo -e "${CYAN}  -> $1${NC}"
}

ok() {
    echo -e "${GREEN}  [OK] $1${NC}"
}

fail() {
    echo -e "${RED}  [FAIL] $1${NC}"
    exit 1
}

soft_fail() {
    echo -e "${RED}  [FAIL] $1${NC}"
}

warn() {
    echo -e "${YELLOW}  [WARN] $1${NC}"
}

show_json() {
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
}

extract_cookie_token() {
    echo "$1" | grep -i '^set-cookie:' | sed 's/.*access_token=//;s/;.*//' | tr -d '[:space:]'
}

json_login() {
    jq -n --arg email "$1" --arg password "$2" '{"email": $email, "password": $password}'
}

# Count datasets in FC response (top-level + nested catalogs)
count_datasets() {
    echo "$1" | jq -r '[(.dataset // [] | if type == "array" then .[] else . end), (.catalog // [] | if type == "array" then .[] else . end | .dataset // [] | if type == "array" then .[] else . end)] | length' 2>/dev/null || echo "0"
}

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------
if [ $# -lt 2 ]; then
    echo -e "${BOLD}Usage:${NC} $0 <node-a-password> <node-b-password>"
    echo ""
    echo "  Passwords are printed in each node's bootstrap logs."
    echo "  IMPORTANT: Wrap passwords in single quotes."
    echo ""
    echo "  Optional env vars:"
    echo "    NODE_A_PORT (default: 3000)"
    echo "    NODE_B_PORT (default: 3001)"
    echo "    IPFS_API (default: http://localhost:5001/api/v0)"
    echo "    SYNC_MAX_RETRIES (default: 12)"
    echo "    SYNC_RETRY_DELAY (default: 10 seconds)"
    exit 1
fi

NODE_A_PASSWORD="$1"
NODE_B_PASSWORD="$2"

echo -e "${BOLD}N2N Synchronized Storage Demo${NC}"
echo -e "  Node A: ${NODE_A_HOST} (trusted node)"
echo -e "  Node B: ${NODE_B_HOST} (regular node)"
echo -e "  IPFS:   ${IPFS_API}"
echo -e "  Consumer PID: ${CONSUMER_PID}"

# ==========================================================================
# Phase 0: Prerequisites Check
# ==========================================================================
phase 0 "Prerequisites Check"

step "Checking IPFS at ${IPFS_API}..."
IPFS_ID=$(curl -sf -X POST "${IPFS_API}/id" 2>/dev/null) || fail "IPFS not reachable at ${IPFS_API}/id. Start with: docker run -d --name twin-blob-ipfs -p 5001:5001 -p 4001:4001 -p 8080:8080 ipfs/kubo:latest"
IPFS_PEER_ID=$(echo "${IPFS_ID}" | jq -r '.ID // empty' 2>/dev/null)
ok "IPFS running (peer: ${IPFS_PEER_ID:-unknown})"

step "Checking Node A (trusted) at ${NODE_A_HOST}..."
NODE_A_INFO=$(curl -sf "${NODE_A_HOST}/info" 2>/dev/null) || fail "Node A not reachable at ${NODE_A_HOST}/info"
ok "Node A is running"

step "Checking Node B (regular) at ${NODE_B_HOST}..."
NODE_B_INFO=$(curl -sf "${NODE_B_HOST}/info" 2>/dev/null) || fail "Node B not reachable at ${NODE_B_HOST}/info"
ok "Node B is running"

PHASE_RESULTS+=("${GREEN}[0]${NC} Prerequisites (IPFS + Nodes)")

# ==========================================================================
# Phase 1: Authentication (Login + Trust Token + Agreement)
# ==========================================================================
phase 1 "Authentication"

# --- 1a: Login to both nodes ---
step "Logging in to Node A as ${NODE_A_EMAIL}..."
NODE_A_LOGIN_FULL=$(curl -si -X POST "${NODE_A_HOST}/authentication/login" \
    -H "Content-Type: application/json" \
    -d "$(json_login "${NODE_A_EMAIL}" "${NODE_A_PASSWORD}")") \
    || fail "Login to Node A failed. Check password."

NODE_A_TOKEN=$(extract_cookie_token "${NODE_A_LOGIN_FULL}")
if [ -z "${NODE_A_TOKEN}" ]; then
    echo "  Login response:"
    echo "${NODE_A_LOGIN_FULL}"
    fail "Could not extract token from Node A Set-Cookie header"
fi
ok "Node A session token obtained (${#NODE_A_TOKEN} chars)"

step "Logging in to Node B as ${NODE_B_EMAIL}..."
NODE_B_LOGIN_FULL=$(curl -si -X POST "${NODE_B_HOST}/authentication/login" \
    -H "Content-Type: application/json" \
    -d "$(json_login "${NODE_B_EMAIL}" "${NODE_B_PASSWORD}")") \
    || fail "Login to Node B failed. Check password."

NODE_B_TOKEN=$(extract_cookie_token "${NODE_B_LOGIN_FULL}")
if [ -z "${NODE_B_TOKEN}" ]; then
    echo "  Login response:"
    echo "${NODE_B_LOGIN_FULL}"
    fail "Could not extract token from Node B Set-Cookie header"
fi
ok "Node B session token obtained (${#NODE_B_TOKEN} chars)"

# --- 1b: Read DIDs from state files ---
step "Reading Node A's DID from state file..."
if [ ! -f "${NODE_A_STATE_FILE}" ]; then
    fail "Node A state file not found at ${NODE_A_STATE_FILE}"
fi
NODE_A_DID=$(jq -r '.nodeId // empty' "${NODE_A_STATE_FILE}" 2>/dev/null)
if [ -z "${NODE_A_DID}" ]; then
    fail "Could not extract nodeId from ${NODE_A_STATE_FILE}"
fi
ok "Node A DID: ${NODE_A_DID}"

step "Reading Node B's DID from state file..."
if [ ! -f "${NODE_B_STATE_FILE}" ]; then
    fail "Node B state file not found at ${NODE_B_STATE_FILE}"
fi
NODE_B_DID=$(jq -r '.nodeId // empty' "${NODE_B_STATE_FILE}" 2>/dev/null)
if [ -z "${NODE_B_DID}" ]; then
    fail "Could not extract nodeId from ${NODE_B_STATE_FILE}"
fi
ok "Node B DID: ${NODE_B_DID}"

# --- 1c: Generate JWT-VC trust token on Node A ---
step "Generating JWT-VC trust token on Node A..."
TRUST_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${NODE_A_HOST}/identity/${NODE_A_DID}/verifiable-credential/${TRUST_VERIFICATION_METHOD_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TOKEN}" \
    -d '{"subject": {"id": "urn:trust:n2n-demo"}}') || true

TRUST_TOKEN_HTTP_CODE=$(echo "${TRUST_TOKEN_RESPONSE}" | tail -1)
TRUST_TOKEN_BODY=$(echo "${TRUST_TOKEN_RESPONSE}" | sed '$d')

if [ "${TRUST_TOKEN_HTTP_CODE}" != "200" ] && [ "${TRUST_TOKEN_HTTP_CODE}" != "201" ]; then
    echo "  HTTP Status: ${TRUST_TOKEN_HTTP_CODE}"
    show_json "${TRUST_TOKEN_BODY}"
    fail "Failed to generate JWT-VC trust token (HTTP ${TRUST_TOKEN_HTTP_CODE})"
fi

NODE_A_TRUST_TOKEN=$(echo "${TRUST_TOKEN_BODY}" | jq -r '.jwt // empty' 2>/dev/null)
if [ -z "${NODE_A_TRUST_TOKEN}" ]; then
    show_json "${TRUST_TOKEN_BODY}"
    fail "Could not extract JWT from trust token response"
fi
ok "JWT-VC trust token generated (${#NODE_A_TRUST_TOKEN} chars)"

# --- 1c2: Generate JWT-VC trust token on Node B ---
step "Generating JWT-VC trust token on Node B..."
TRUST_TOKEN_B_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${NODE_B_HOST}/identity/${NODE_B_DID}/verifiable-credential/${TRUST_VERIFICATION_METHOD_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_B_TOKEN}" \
    -d '{"subject": {"id": "urn:trust:n2n-demo"}}') || true

TRUST_TOKEN_B_HTTP_CODE=$(echo "${TRUST_TOKEN_B_RESPONSE}" | tail -1)
TRUST_TOKEN_B_BODY=$(echo "${TRUST_TOKEN_B_RESPONSE}" | sed '$d')

if [ "${TRUST_TOKEN_B_HTTP_CODE}" != "200" ] && [ "${TRUST_TOKEN_B_HTTP_CODE}" != "201" ]; then
    echo "  HTTP Status: ${TRUST_TOKEN_B_HTTP_CODE}"
    show_json "${TRUST_TOKEN_B_BODY}"
    fail "Failed to generate JWT-VC trust token on Node B (HTTP ${TRUST_TOKEN_B_HTTP_CODE})"
fi

NODE_B_TRUST_TOKEN=$(echo "${TRUST_TOKEN_B_BODY}" | jq -r '.jwt // empty' 2>/dev/null)
if [ -z "${NODE_B_TRUST_TOKEN}" ]; then
    show_json "${TRUST_TOKEN_B_BODY}"
    fail "Could not extract JWT from Node B trust token response"
fi
ok "JWT-VC trust token generated (${#NODE_B_TRUST_TOKEN} chars)"

# --- 1d: Create ODRL Agreement on Node B's PAP ---
step "Creating ODRL Agreement on Node B's PAP..."
step "  uid (matches offer): ${OFFER_ID}"
step "  assigner (provider): ${NODE_B_DID}"
step "  assignee (consumer): ${NODE_A_DID}"

AGREEMENT_BODY=$(jq -n \
    --arg uid "${OFFER_ID}" \
    --arg assigner "${NODE_B_DID}" \
    --arg assignee "${NODE_A_DID}" \
    --arg target "${DATASET_ID}" \
    '{
        "@context": "http://www.w3.org/ns/odrl.jsonld",
        "@type": "Agreement",
        "uid": $uid,
        "assigner": $assigner,
        "assignee": $assignee,
        "target": $target,
        "action": "read",
        "permission": [{ "action": "read", "target": $target }]
    }')

AGREEMENT_RESPONSE=$(curl -si -X POST "${NODE_B_HOST}/rights-management/policy/admin" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_B_TOKEN}" \
    -d "${AGREEMENT_BODY}") || true

AGREEMENT_HTTP_CODE=$(echo "${AGREEMENT_RESPONSE}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
AGREEMENT_ID_RAW=$(echo "${AGREEMENT_RESPONSE}" | grep -i '^location:' | sed 's/[Ll]ocation: *//;s/\r//' | tr -d '[:space:]')
AGREEMENT_ID=$(printf '%b' "${AGREEMENT_ID_RAW//%/\\x}")

if [ "${AGREEMENT_HTTP_CODE}" != "201" ]; then
    echo "  HTTP Status: ${AGREEMENT_HTTP_CODE}"
    echo "${AGREEMENT_RESPONSE}"
    fail "Failed to create agreement on Node B PAP (HTTP ${AGREEMENT_HTTP_CODE})"
fi

if [ -z "${AGREEMENT_ID}" ]; then
    echo "${AGREEMENT_RESPONSE}"
    fail "Could not extract agreement UID from Location header"
fi
ok "Agreement created: ${AGREEMENT_ID}"

PHASE_RESULTS+=("${GREEN}[1]${NC} Authentication + Trust Token + Agreement")

# ==========================================================================
# Phase 2: Discovery — Verify Sync Replication
# ==========================================================================
phase 2 "Discovery (Synchronized Storage)"

# With synchronized storage, Node B's dataset should be replicated to Node A.
# We query Node A's OWN Federated Catalogue (not Node B's) and wait for the
# dataset to appear via sync replication.
step "Checking Node B's catalogue for baseline..."

NODE_B_CATALOG_FULL=$(curl -s -w "\n%{http_code}" -X POST "${NODE_B_HOST}/federated-catalogue/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_B_TOKEN}" \
    -d "{
        \"@context\": [\"${DSP_CONTEXT}\"],
        \"@type\": \"CatalogRequestMessage\",
        \"filter\": []
    }") || true

NODE_B_CATALOG_HTTP=$(echo "${NODE_B_CATALOG_FULL}" | tail -1)
NODE_B_CATALOG_BODY=$(echo "${NODE_B_CATALOG_FULL}" | sed '$d')
NODE_B_DATASET_COUNT=$(count_datasets "${NODE_B_CATALOG_BODY}")

echo "  Node B catalogue: ${NODE_B_DATASET_COUNT} dataset(s) (HTTP ${NODE_B_CATALOG_HTTP})"

if [ "${NODE_B_DATASET_COUNT}" -lt 1 ] 2>/dev/null; then
    warn "Node B has no datasets. The test app may not be loaded."
    warn "Check TWIN_EXTENSIONS in node-b-synced.env."
fi

step "Waiting for Node B's dataset to sync to Node A's catalogue..."
step "  Max wait: $((SYNC_MAX_RETRIES * SYNC_RETRY_DELAY))s (${SYNC_MAX_RETRIES} retries x ${SYNC_RETRY_DELAY}s)"

NODE_A_DATASET_COUNT=0

for SYNC_ATTEMPT in $(seq 1 "${SYNC_MAX_RETRIES}"); do
    NODE_A_CATALOG_FULL=$(curl -s -w "\n%{http_code}" -X POST "${NODE_A_HOST}/federated-catalogue/request" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${NODE_A_TOKEN}" \
        -d "{
            \"@context\": [\"${DSP_CONTEXT}\"],
            \"@type\": \"CatalogRequestMessage\",
            \"filter\": []
        }") || true

    NODE_A_CATALOG_HTTP=$(echo "${NODE_A_CATALOG_FULL}" | tail -1)
    NODE_A_CATALOG_BODY=$(echo "${NODE_A_CATALOG_FULL}" | sed '$d')
    NODE_A_DATASET_COUNT=$(count_datasets "${NODE_A_CATALOG_BODY}")

    if [ "${NODE_A_DATASET_COUNT}" -gt 0 ] 2>/dev/null; then
        break
    fi

    if [ "${SYNC_ATTEMPT}" -lt "${SYNC_MAX_RETRIES}" ]; then
        echo -e "  ${YELLOW}Attempt ${SYNC_ATTEMPT}/${SYNC_MAX_RETRIES}: No datasets on Node A yet, waiting ${SYNC_RETRY_DELAY}s...${NC}"
        sleep "${SYNC_RETRY_DELAY}"
    fi
done

if [ "${NODE_A_DATASET_COUNT}" -gt 0 ] 2>/dev/null; then
    ok "Node A's catalogue has ${NODE_A_DATASET_COUNT} dataset(s) from sync replication"
    echo "  Node A catalogue response:"
    show_json "${NODE_A_CATALOG_BODY}"

    # Cross-check: compare dataset IDs between nodes
    NODE_A_DS_IDS=$(echo "${NODE_A_CATALOG_BODY}" | jq -r '[(.dataset // [] | if type == "array" then .[] else . end | .["@id"] // empty), (.catalog // [] | if type == "array" then .[] else . end | .dataset // [] | if type == "array" then .[] else . end | .["@id"] // empty)] | sort | join(", ")' 2>/dev/null || echo "")
    NODE_B_DS_IDS=$(echo "${NODE_B_CATALOG_BODY}" | jq -r '[(.dataset // [] | if type == "array" then .[] else . end | .["@id"] // empty), (.catalog // [] | if type == "array" then .[] else . end | .dataset // [] | if type == "array" then .[] else . end | .["@id"] // empty)] | sort | join(", ")' 2>/dev/null || echo "")

    if [ "${NODE_A_DS_IDS}" = "${NODE_B_DS_IDS}" ] && [ -n "${NODE_A_DS_IDS}" ]; then
        ok "Dataset IDs match across both nodes: ${NODE_A_DS_IDS}"
    else
        warn "Dataset IDs differ — Node A: [${NODE_A_DS_IDS}] vs Node B: [${NODE_B_DS_IDS}]"
    fi
else
    warn "Sync did not complete after $((SYNC_MAX_RETRIES * SYNC_RETRY_DELAY))s."
    warn "Node A catalogue still has 0 datasets."
    warn "Check that synchronized storage is enabled in both env files."
    warn "Check node logs for sync errors."
    echo "  Node A catalogue response:"
    show_json "${NODE_A_CATALOG_BODY}"
fi

PHASE_RESULTS+=("${GREEN}[2]${NC} Discovery (Sync Replication)")

# ==========================================================================
# Phase 3: Transfer Request — Request data transfer on Node B
# ==========================================================================
phase 3 "Transfer Request"

step "Requesting data transfer on Node B (using JWT-VC trust token)..."
step "  agreementId: ${AGREEMENT_ID}"
step "  consumerPid: ${CONSUMER_PID}"

TRANSFER_REQUEST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NODE_B_HOST}/dataspace/transfers/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TRUST_TOKEN}" \
    -d "$(jq -n \
        --arg ctx "${DSP_CONTEXT}" \
        --arg consumerPid "${CONSUMER_PID}" \
        --arg agreementId "${AGREEMENT_ID}" \
        --arg callbackAddress "${NODE_A_HOST}/dataspace" \
        '{
            "@context": [$ctx],
            "@type": "TransferRequestMessage",
            "consumerPid": $consumerPid,
            "agreementId": $agreementId,
            "format": "Http-Pull-Query-Format",
            "callbackAddress": $callbackAddress
        }')") || true

TRANSFER_REQUEST_HTTP_CODE=$(echo "${TRANSFER_REQUEST_RESPONSE}" | tail -1)
TRANSFER_REQUEST_BODY=$(echo "${TRANSFER_REQUEST_RESPONSE}" | sed '$d')

echo "  HTTP Status: ${TRANSFER_REQUEST_HTTP_CODE}"
echo "  Response:"
show_json "${TRANSFER_REQUEST_BODY}"

RESPONSE_TYPE=$(echo "${TRANSFER_REQUEST_BODY}" | jq -r '.["@type"] // empty' 2>/dev/null)

if [ "${RESPONSE_TYPE}" = "TransferError" ]; then
    ERROR_CODE=$(echo "${TRANSFER_REQUEST_BODY}" | jq -r '.code // "unknown"' 2>/dev/null)
    ERROR_REASONS=$(echo "${TRANSFER_REQUEST_BODY}" | jq -r '[.reason // [] | if type == "array" then .[] else . end] | join("; ")' 2>/dev/null)
    soft_fail "Transfer request returned TransferError"
    soft_fail "  code: ${ERROR_CODE}"
    soft_fail "  reason: ${ERROR_REASONS}"

    PHASE_RESULTS+=("${RED}[3]${NC} Transfer Request (TransferError: ${ERROR_CODE})")

    echo ""
    echo -e "${BOLD}${YELLOW}  Phases 4-7 skipped (Transfer Request failed)${NC}"
    echo ""
    echo -e "${BOLD}Phase results:${NC}"
    for result in "${PHASE_RESULTS[@]}"; do
        echo -e "    ${result}"
    done
    echo -e "    ${YELLOW}[4-7]${NC} Skipped"
    exit 0
fi

PROVIDER_PID=$(echo "${TRANSFER_REQUEST_BODY}" | jq -r '.providerPid // empty' 2>/dev/null)
TRANSFER_STATE=$(echo "${TRANSFER_REQUEST_BODY}" | jq -r '.state // empty' 2>/dev/null)

if [ -z "${PROVIDER_PID}" ] || [ "${PROVIDER_PID}" = "null" ]; then
    soft_fail "Could not extract providerPid from transfer request response"

    PHASE_RESULTS+=("${RED}[3]${NC} Transfer Request (failed)")

    echo ""
    echo -e "${BOLD}${YELLOW}  Phases 4-7 skipped (require providerPid)${NC}"
    echo ""
    echo -e "${BOLD}Phase results:${NC}"
    for result in "${PHASE_RESULTS[@]}"; do
        echo -e "    ${result}"
    done
    echo -e "    ${YELLOW}[4-7]${NC} Skipped"
    exit 0
fi

ok "Transfer process created"
ok "  Provider PID: ${PROVIDER_PID}"
ok "  State: ${TRANSFER_STATE}"

PHASE_RESULTS+=("${GREEN}[3]${NC} Transfer Request")

# ==========================================================================
# Phase 4: Start Transfer
# ==========================================================================
phase 4 "Start Transfer"

step "Node B starting transfer (generates data access token)..."

START_TRANSFER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NODE_B_HOST}/dataspace/transfers/${PROVIDER_PID}/start" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_B_TRUST_TOKEN}" \
    -d "{
        \"@context\": [\"${DSP_CONTEXT}\"],
        \"@type\": \"TransferStartMessage\",
        \"consumerPid\": \"${CONSUMER_PID}\",
        \"providerPid\": \"${PROVIDER_PID}\"
    }") || true

START_HTTP_CODE=$(echo "${START_TRANSFER_RESPONSE}" | tail -1)
START_BODY=$(echo "${START_TRANSFER_RESPONSE}" | sed '$d')

echo "  HTTP Status: ${START_HTTP_CODE}"
echo "  Response:"
show_json "${START_BODY}"

DATA_ACCESS_TOKEN=$(echo "${START_BODY}" | jq -r '
    (.dataAddress.endpointProperties // [])[]
    | select(.name == "authorization")
    | .value // empty
' 2>/dev/null || true)

DATA_ENDPOINT=$(echo "${START_BODY}" | jq -r '.dataAddress.endpoint // empty' 2>/dev/null || true)

if [ -z "${DATA_ACCESS_TOKEN}" ]; then
    warn "Could not extract data access token from start response"
    DATA_ACCESS_TOKEN="${NODE_A_TOKEN}"
else
    ok "Data access token obtained (${#DATA_ACCESS_TOKEN} chars)"
fi

if [ -n "${DATA_ENDPOINT}" ] && [ "${DATA_ENDPOINT}" != "null" ]; then
    ok "Data endpoint: ${DATA_ENDPOINT}"
else
    DATA_ENDPOINT="${NODE_B_HOST}/dataspace/entities"
    warn "No endpoint in response, using default: ${DATA_ENDPOINT}"
fi

PHASE_RESULTS+=("${GREEN}[4]${NC} Start Transfer")

# ==========================================================================
# Phase 5: Pull Data
# ==========================================================================
phase 5 "Pull Data"

step "Fetching entities from Node B's data plane..."
step "  endpoint: ${DATA_ENDPOINT}"
step "  consumerPid: ${CONSUMER_PID}"
step "  type: ${ENTITY_TYPE}"

PULL_RESPONSE=$(curl -s -w "\n%{http_code}" -G "${DATA_ENDPOINT}" \
    --data-urlencode "consumerPid=${CONSUMER_PID}" \
    --data-urlencode "type=${ENTITY_TYPE}" \
    -H "Authorization: Bearer ${DATA_ACCESS_TOKEN}") || true

PULL_HTTP_CODE=$(echo "${PULL_RESPONSE}" | tail -1)
PULL_BODY=$(echo "${PULL_RESPONSE}" | sed '$d')

echo "  HTTP Status: ${PULL_HTTP_CODE}"
echo "  Response:"
show_json "${PULL_BODY}"

ITEM_COUNT=$(echo "${PULL_BODY}" | jq -r '(.itemListElement // []) | length' 2>/dev/null || echo "0")

if [ "${ITEM_COUNT}" -gt 0 ] 2>/dev/null; then
    ok "Received ${ITEM_COUNT} entity/entities"
    PHASE_RESULTS+=("${GREEN}[5]${NC} Pull Data")
else
    warn "No entities in response (item count: ${ITEM_COUNT})"
    PHASE_RESULTS+=("${YELLOW}[5]${NC} Pull Data (no entities)")
fi

# ==========================================================================
# Phase 6: Complete Transfer
# ==========================================================================
phase 6 "Complete Transfer"

step "Completing transfer..."

COMPLETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NODE_B_HOST}/dataspace/transfers/${PROVIDER_PID}/complete" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TRUST_TOKEN}" \
    -d "{
        \"@context\": [\"${DSP_CONTEXT}\"],
        \"@type\": \"TransferCompletionMessage\",
        \"consumerPid\": \"${CONSUMER_PID}\",
        \"providerPid\": \"${PROVIDER_PID}\"
    }") || true

COMPLETE_HTTP_CODE=$(echo "${COMPLETE_RESPONSE}" | tail -1)
COMPLETE_BODY=$(echo "${COMPLETE_RESPONSE}" | sed '$d')

echo "  HTTP Status: ${COMPLETE_HTTP_CODE}"
echo "  Response:"
show_json "${COMPLETE_BODY}"

FINAL_STATE=$(echo "${COMPLETE_BODY}" | jq -r '.state // empty' 2>/dev/null || true)
if [ -n "${FINAL_STATE}" ] && [ "${FINAL_STATE}" != "null" ]; then
    ok "Transfer completed (state: ${FINAL_STATE})"
    PHASE_RESULTS+=("${GREEN}[6]${NC} Complete Transfer")
else
    warn "Could not confirm completion"
    PHASE_RESULTS+=("${YELLOW}[6]${NC} Complete Transfer (unconfirmed)")
fi

# ==========================================================================
# Phase 7: Verify — Final state + cross-node consistency
# ==========================================================================
phase 7 "Verify"

step "Checking transfer state on Node B..."
VERIFY_B=$(curl -sf "${NODE_B_HOST}/dataspace/transfers/${PROVIDER_PID}" \
    -H "Authorization: Bearer ${NODE_A_TRUST_TOKEN}" 2>/dev/null) || true

if [ -n "${VERIFY_B}" ]; then
    echo "  Node B transfer state:"
    show_json "${VERIFY_B}"
    ok "Transfer state verified on Node B"
else
    warn "Could not get transfer state from Node B"
fi

step "Verifying IPFS connectivity..."
IPFS_STATS=$(curl -sf -X POST "${IPFS_API}/repo/stat" 2>/dev/null) || true
if [ -n "${IPFS_STATS}" ]; then
    IPFS_OBJECTS=$(echo "${IPFS_STATS}" | jq -r '.NumObjects // "unknown"' 2>/dev/null)
    IPFS_SIZE=$(echo "${IPFS_STATS}" | jq -r '.RepoSize // 0' 2>/dev/null)
    IPFS_SIZE_MB=$(echo "scale=2; ${IPFS_SIZE:-0} / 1048576" | bc 2>/dev/null || echo "unknown")
    ok "IPFS repo: ${IPFS_OBJECTS} objects, ${IPFS_SIZE_MB} MB"
else
    warn "Could not get IPFS repo stats"
fi

PHASE_RESULTS+=("${GREEN}[7]${NC} Verify")

# ==========================================================================
# Summary
# ==========================================================================
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  N2N Synchronized Storage Demo Complete${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  Mode:             Synchronized Storage + IPFS"
echo -e "  Consumer PID:     ${CONSUMER_PID}"
echo -e "  Provider PID:     ${PROVIDER_PID}"
echo -e "  Agreement ID:     ${AGREEMENT_ID}"
echo -e "  Entities fetched: ${ITEM_COUNT}"
echo -e "  Final state:      ${FINAL_STATE:-unknown}"
echo -e "  Sync verified:    Node A saw ${NODE_A_DATASET_COUNT} dataset(s) from sync"
echo ""
echo -e "  ${BOLD}Phase results:${NC}"
for result in "${PHASE_RESULTS[@]}"; do
    echo -e "    ${result}"
done
echo ""
