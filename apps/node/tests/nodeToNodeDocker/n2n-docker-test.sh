#!/usr/bin/env bash
# =============================================================================
# n2n-docker-test.sh — N2N DSP Flow with Dockerized Nodes
# =============================================================================
# Location: node/apps/node/tests/nodeToNodeDocker/n2n-docker-test.sh
#
# Same test flow as the local n2n-synced-storage.sh but adapted for Docker:
#   - DIDs read from Docker volumes via docker exec
#   - Callback addresses use container service names (container-to-container)
#   - Data endpoint URLs translated from internal to host-accessible
#
# Phases:
#   Phase 0: Prerequisites (IPFS + both node containers)
#   Phase 1: Authentication (login + JWT-VC trust token + ODRL offer)
#   Phase 1.5: Contract Negotiation (PNP — REQUESTED → AGREED via pass-through)
#   Phase 2: Discovery (verify sync: Node B's dataset visible on Node A)
#   Phase 3: Transfer Request (consumer requests data)
#   Phase 4: Start Transfer (provider returns data access token)
#   Phase 5: Pull Data (consumer fetches entities)
#   Phase 6: Complete Transfer (signal completion)
#   Phase 7: Verify (check final state + cross-node consistency)
#
# Usage:
#   ./n2n-docker-test.sh <node-a-password> <node-b-password>
#
# Prerequisites:
#   - docker compose up (IPFS + both nodes running)
#   - Both nodes bootstrapped via setup.sh
#   - jq installed
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via env vars)
# ---------------------------------------------------------------------------
NODE_A_PORT="${NODE_A_PORT:-3000}"
NODE_B_PORT="${NODE_B_PORT:-3001}"
# Host-accessible URLs (via Docker port forwarding)
NODE_A_HOST="${NODE_A_HOST:-http://localhost:${NODE_A_PORT}}"
NODE_B_HOST="${NODE_B_HOST:-http://localhost:${NODE_B_PORT}}"
NODE_A_EMAIL="${NODE_A_EMAIL:-admin@node}"
NODE_B_EMAIL="${NODE_B_EMAIL:-admin@node}"
IPFS_API="${IPFS_API:-http://localhost:5001/api/v0}"

# Docker container names (must match docker-compose.yml)
NODE_A_CONTAINER="${NODE_A_CONTAINER:-twin-node-a}"
NODE_B_CONTAINER="${NODE_B_CONTAINER:-twin-node-b}"

# Container-internal service names (for container-to-container communication)
NODE_A_INTERNAL="http://twin-node-a:${NODE_A_PORT}"
NODE_B_INTERNAL="http://twin-node-b:${NODE_B_PORT}"

# Trust verification method ID
TRUST_VERIFICATION_METHOD_ID="${TRUST_VERIFICATION_METHOD_ID:-trust-assertion}"

# DSP context
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"

# Test app dataset and offer (must match testDataspaceDataPlaneApp.ts)
DATASET_ID="https://twin.example.org/data-service-1"
OFFER_ID="urn:policy:test-offer-read-consignment"
ENTITY_TYPE="https://vocabulary.uncefact.org/Consignment"

# Consumer PID (unique per run)
CONSUMER_PID="urn:uuid:docker-demo-$(date +%s)"

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

# Translate container-internal URL to host-accessible URL
# e.g., http://twin-node-b:3001/dataspace/entities -> http://localhost:3001/dataspace/entities
translate_endpoint() {
    local url="$1"
    url=$(echo "${url}" | sed "s|http://twin-node-a:${NODE_A_PORT}|http://localhost:${NODE_A_PORT}|g")
    url=$(echo "${url}" | sed "s|http://twin-node-b:${NODE_B_PORT}|http://localhost:${NODE_B_PORT}|g")
    echo "${url}"
}

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------
if [ $# -lt 2 ]; then
    echo -e "${BOLD}Usage:${NC} $0 <node-a-password> <node-b-password>"
    echo ""
    echo "  Passwords are printed during setup.sh bootstrap."
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

echo -e "${BOLD}N2N Docker Test${NC}"
echo -e "  Node A: ${NODE_A_HOST} (trusted node, container: ${NODE_A_CONTAINER})"
echo -e "  Node B: ${NODE_B_HOST} (regular node, container: ${NODE_B_CONTAINER})"
echo -e "  IPFS:   ${IPFS_API}"
echo -e "  Consumer PID: ${CONSUMER_PID}"
echo -e "  Internal Node A: ${NODE_A_INTERNAL} (for container-to-container)"

# ==========================================================================
# Phase 0: Prerequisites Check
# ==========================================================================
phase 0 "Prerequisites Check"

step "Checking IPFS at ${IPFS_API}..."
IPFS_ID=$(curl -sf -X POST "${IPFS_API}/id" 2>/dev/null) || fail "IPFS not reachable at ${IPFS_API}/id. Is the IPFS container running?"
IPFS_PEER_ID=$(echo "${IPFS_ID}" | jq -r '.ID // empty' 2>/dev/null)
ok "IPFS running (peer: ${IPFS_PEER_ID:-unknown})"

step "Checking Node A container (${NODE_A_CONTAINER})..."
docker inspect "${NODE_A_CONTAINER}" >/dev/null 2>&1 || fail "Container ${NODE_A_CONTAINER} not found. Run: docker compose up -d"
NODE_A_INFO=$(curl -sf "${NODE_A_HOST}/info" 2>/dev/null) || fail "Node A not reachable at ${NODE_A_HOST}/info"
ok "Node A is running"

step "Checking Node B container (${NODE_B_CONTAINER})..."
docker inspect "${NODE_B_CONTAINER}" >/dev/null 2>&1 || fail "Container ${NODE_B_CONTAINER} not found. Run: docker compose up -d"
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

# --- 1b: Read DIDs from Docker volumes via docker exec ---
step "Reading Node A's DID from container volume..."
NODE_A_DID=$(docker exec "${NODE_A_CONTAINER}" cat /app/data/engine-state.json 2>/dev/null | jq -r '.nodeId // empty' 2>/dev/null)
if [ -z "${NODE_A_DID}" ]; then
    fail "Could not read Node A DID. Is the container bootstrapped? Run setup.sh first."
fi
ok "Node A DID: ${NODE_A_DID}"

step "Reading Node B's DID from container volume..."
NODE_B_DID=$(docker exec "${NODE_B_CONTAINER}" cat /app/data/engine-state.json 2>/dev/null | jq -r '.nodeId // empty' 2>/dev/null)
if [ -z "${NODE_B_DID}" ]; then
    fail "Could not read Node B DID. Is the container bootstrapped? Run setup.sh first."
fi
ok "Node B DID: ${NODE_B_DID}"

# --- 1c: Generate JWT-VC trust token on Node A ---
step "Generating JWT-VC trust token on Node A..."
TRUST_TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${NODE_A_HOST}/identity/${NODE_A_DID}/verifiable-credential/${TRUST_VERIFICATION_METHOD_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TOKEN}" \
    -d '{"subject": {"id": "urn:trust:n2n-docker-demo"}}') || true

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
    -d '{"subject": {"id": "urn:trust:n2n-docker-demo"}}') || true

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

# --- 1d: Seed ODRL Offer into Node B's PAP (required for PNP negotiation) ---
step "Seeding ODRL Offer into Node B's PAP..."
step "  uid: ${OFFER_ID}"
step "  assigner (provider): ${NODE_B_DID}"

OFFER_BODY=$(jq -n \
    --arg uid "${OFFER_ID}" \
    --arg assigner "${NODE_B_DID}" \
    --arg target "${DATASET_ID}" \
    '{
        "@context": "http://www.w3.org/ns/odrl.jsonld",
        "@type": "Offer",
        "uid": $uid,
        "assigner": $assigner,
        "target": $target,
        "action": "read",
        "permission": [{ "action": "read", "target": $target }]
    }')

OFFER_RESPONSE=$(curl -si -X POST "${NODE_B_HOST}/rights-management/policy/admin" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_B_TOKEN}" \
    -d "${OFFER_BODY}") || true

OFFER_HTTP_CODE=$(echo "${OFFER_RESPONSE}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')

if [ "${OFFER_HTTP_CODE}" != "201" ]; then
    echo "  HTTP Status: ${OFFER_HTTP_CODE}"
    echo "${OFFER_RESPONSE}"
    fail "Failed to seed offer into Node B PAP (HTTP ${OFFER_HTTP_CODE})"
fi
ok "Offer seeded into Node B PAP: ${OFFER_ID}"

PHASE_RESULTS+=("${GREEN}[1]${NC} Authentication + Trust Token + Offer Seeded")

# ==========================================================================
# Phase 1.5: Contract Negotiation (PNP)
# ==========================================================================
phase "1.5" "Contract Negotiation (PNP)"

# Simulates what sendRequestToProvider does internally:
#   1. Create consumer-side negotiation entry on Node A FIRST (via PNAP admin endpoint)
#   2. Send ContractRequestMessage to Provider (Node B)
#   3. Node B's pass-through negotiator auto-accepts and callbacks to Node A
#   4. Poll for negotiation to reach AGREED/FINALIZED state
#
# IMPORTANT: The consumer entry MUST be created BEFORE the ContractRequestMessage is sent.
# Node B's pass-through negotiator uses setTimeout(100ms) to fire the callback to Node A.
# If the consumer entry doesn't exist when the callback arrives, offerFromProvider returns
# NotFoundError and Node B transitions to TERMINATED.
#
# The callback URL uses container service names (container-to-container).
# handlerId is omitted so offerFromProvider auto-accepts without a PolicyRequester.
NEGOTIATION_CONSUMER_PID="urn:contract-negotiation:consumer-$(date +%s)"
PNP_CALLBACK="${NODE_A_INTERNAL}"

# --- Pre-inject consumer-side negotiation entry on Node A ---
# This simulates what sendRequestToProvider creates internally.
# Without this, Node A has no local record and the provider callback fails with 404.
# We inject it BEFORE sending the request to Node B to avoid a race condition.
# correlationId is empty initially — offerFromProvider only looks up by consumerPid (id).
step "Pre-injecting consumer-side negotiation entry on Node A (via PNAP admin)..."
CONSUMER_NEGOTIATION_BODY=$(jq -n \
    --arg id "${NEGOTIATION_CONSUMER_PID}" \
    --arg dateCreated "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
    --arg organizationIdentity "${NODE_A_DID}" \
    '{
        "id": $id,
        "correlationId": "",
        "dateCreated": $dateCreated,
        "state": "REQUESTED",
        "organizationIdentity": $organizationIdentity
    }')

PNAP_SET_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
    "${NODE_A_HOST}/rights-management/negotiations/admin/${NEGOTIATION_CONSUMER_PID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TOKEN}" \
    -d "${CONSUMER_NEGOTIATION_BODY}") || true

PNAP_SET_HTTP=$(echo "${PNAP_SET_RESPONSE}" | tail -1)

if [ "${PNAP_SET_HTTP}" = "204" ] || [ "${PNAP_SET_HTTP}" = "200" ]; then
    ok "Consumer negotiation entry pre-created on Node A"
else
    PNAP_SET_BODY=$(echo "${PNAP_SET_RESPONSE}" | sed '$d')
    soft_fail "Failed to create consumer negotiation entry (HTTP ${PNAP_SET_HTTP})"
    echo "  Response:"
    show_json "${PNAP_SET_BODY}"
fi

step "Consumer (Node A) requesting negotiation from Provider (Node B)..."
step "  consumerPid: ${NEGOTIATION_CONSUMER_PID}"
step "  offer: ${OFFER_ID}"
step "  callbackAddress: ${PNP_CALLBACK} (container-to-container)"

NEGOTIATE_REQUEST=$(jq -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${NEGOTIATION_CONSUMER_PID}" \
    --arg offerId "${OFFER_ID}" \
    --arg assigner "${NODE_B_DID}" \
    --arg target "${DATASET_ID}" \
    --arg callback "${PNP_CALLBACK}" \
    '{
        "@context": [$ctx],
        "@type": "ContractRequestMessage",
        "consumerPid": $consumerPid,
        "offer": {
            "@type": "Offer",
            "@id": $offerId,
            "assigner": $assigner,
            "target": $target,
            "action": "read",
            "permission": [{ "action": "read", "target": $target }]
        },
        "callbackAddress": $callback
    }')

NEGOTIATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NODE_B_HOST}/rights-management/negotiations/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TRUST_TOKEN}" \
    -d "${NEGOTIATE_REQUEST}") || true

NEGOTIATE_HTTP_CODE=$(echo "${NEGOTIATE_RESPONSE}" | tail -1)
NEGOTIATE_BODY=$(echo "${NEGOTIATE_RESPONSE}" | sed '$d')

echo "  HTTP Status: ${NEGOTIATE_HTTP_CODE}"
echo "  Response:"
show_json "${NEGOTIATE_BODY}"

if [ "${NEGOTIATE_HTTP_CODE}" != "200" ] && [ "${NEGOTIATE_HTTP_CODE}" != "201" ]; then
    fail "Contract negotiation request failed (HTTP ${NEGOTIATE_HTTP_CODE})"
else
    PROVIDER_NEGOTIATION_PID=$(echo "${NEGOTIATE_BODY}" | jq -r '.providerPid // empty' 2>/dev/null)
    NEGOTIATION_STATE=$(echo "${NEGOTIATE_BODY}" | jq -r '.state // empty' 2>/dev/null)

    if [ -z "${PROVIDER_NEGOTIATION_PID}" ]; then
        fail "Could not extract providerPid from negotiation response"
    fi

    ok "Negotiation initiated on Provider (Node B)"
    ok "  Provider PID: ${PROVIDER_NEGOTIATION_PID}"
    ok "  Consumer PID: ${NEGOTIATION_CONSUMER_PID}"
    ok "  Initial state: ${NEGOTIATION_STATE}"

    # Poll for negotiation to complete (pass-through should be fast)
    step "Waiting for negotiation to complete (pass-through auto-accepts)..."
    NEGOTIATION_MAX_RETRIES=15
    NEGOTIATION_RETRY_DELAY=2
    FINAL_NEGOTIATION_STATE=""

    for NEGO_ATTEMPT in $(seq 1 "${NEGOTIATION_MAX_RETRIES}"); do
        NEGO_STATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
            "${NODE_B_HOST}/rights-management/negotiations/${PROVIDER_NEGOTIATION_PID}" \
            -H "Authorization: Bearer ${NODE_A_TRUST_TOKEN}") || true

        NEGO_STATE_HTTP=$(echo "${NEGO_STATE_RESPONSE}" | tail -1)
        NEGO_STATE_BODY=$(echo "${NEGO_STATE_RESPONSE}" | sed '$d')
        FINAL_NEGOTIATION_STATE=$(echo "${NEGO_STATE_BODY}" | jq -r '.state // empty' 2>/dev/null)

        echo -e "  ${CYAN}Attempt ${NEGO_ATTEMPT}/${NEGOTIATION_MAX_RETRIES}: state=${FINAL_NEGOTIATION_STATE}${NC}"

        # Wait for FINALIZED (not just AGREED) because the agreement is only
        # stored in the PAP during the AGREED→FINALIZED transition
        if [ "${FINAL_NEGOTIATION_STATE}" = "FINALIZED" ] || [ "${FINAL_NEGOTIATION_STATE}" = "VERIFIED" ]; then
            break
        fi

        if [ "${NEGO_ATTEMPT}" -lt "${NEGOTIATION_MAX_RETRIES}" ]; then
            sleep "${NEGOTIATION_RETRY_DELAY}"
        fi
    done

    if [ "${FINAL_NEGOTIATION_STATE}" = "FINALIZED" ] || [ "${FINAL_NEGOTIATION_STATE}" = "VERIFIED" ]; then
        ok "Negotiation completed (state: ${FINAL_NEGOTIATION_STATE})"
        echo "  Final negotiation state:"
        show_json "${NEGO_STATE_BODY}"

        # The agreement ID should be the offer ID (pass-through clones the offer as agreement)
        AGREEMENT_ID="${OFFER_ID}"
        ok "Agreement ID: ${AGREEMENT_ID}"
        PHASE_RESULTS+=("${GREEN}[1.5]${NC} Contract Negotiation (${FINAL_NEGOTIATION_STATE})")
    else
        warn "Negotiation did not complete after $((NEGOTIATION_MAX_RETRIES * NEGOTIATION_RETRY_DELAY))s."
        warn "Final state: ${FINAL_NEGOTIATION_STATE}"
        echo "  Last response:"
        show_json "${NEGO_STATE_BODY}"

        # Check Node A's consumer-side state for debugging
        step "Checking consumer-side negotiation state on Node A..."
        CONSUMER_STATE_RESPONSE=$(curl -s \
            "${NODE_A_HOST}/rights-management/negotiations/admin/${NEGOTIATION_CONSUMER_PID}" \
            -H "Authorization: Bearer ${NODE_A_TOKEN}") || true
        echo "  Node A consumer negotiation:"
        show_json "${CONSUMER_STATE_RESPONSE}"

        fail "Negotiation did not reach FINALIZED state (stuck at: ${FINAL_NEGOTIATION_STATE})"
    fi
fi

# ==========================================================================
# Phase 2: Discovery — Verify Sync Replication
# ==========================================================================
phase 2 "Discovery (Synchronized Storage)"

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
    warn "Check TWIN_EXTENSIONS in node-b-docker.env."
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
    warn "Check node logs: docker compose logs twin-node-a twin-node-b"
    echo "  Node A catalogue response:"
    show_json "${NODE_A_CATALOG_BODY}"
fi

PHASE_RESULTS+=("${GREEN}[2]${NC} Discovery (Sync Replication)")

# ==========================================================================
# Phase 3: Transfer Request — Request data transfer on Node B
# ==========================================================================
phase 3 "Transfer Request"

# IMPORTANT: callbackAddress uses container service name (container-to-container)
# The provider (Node B) will call back to the consumer (Node A) using this address.
# Since both containers are on the same Docker network, they resolve each other by service name.
CALLBACK_ADDRESS="${NODE_A_INTERNAL}/dataspace"

step "Requesting data transfer on Node B (using JWT-VC trust token)..."
step "  agreementId: ${AGREEMENT_ID}"
step "  consumerPid: ${CONSUMER_PID}"
step "  callbackAddress: ${CALLBACK_ADDRESS} (container-to-container)"

TRANSFER_REQUEST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NODE_B_HOST}/dataspace/transfers/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NODE_A_TRUST_TOKEN}" \
    -d "$(jq -n \
        --arg ctx "${DSP_CONTEXT}" \
        --arg consumerPid "${CONSUMER_PID}" \
        --arg agreementId "${AGREEMENT_ID}" \
        --arg callbackAddress "${CALLBACK_ADDRESS}" \
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

DATA_ENDPOINT_RAW=$(echo "${START_BODY}" | jq -r '.dataAddress.endpoint // empty' 2>/dev/null || true)

if [ -z "${DATA_ACCESS_TOKEN}" ]; then
    warn "Could not extract data access token from start response"
    DATA_ACCESS_TOKEN="${NODE_A_TOKEN}"
else
    ok "Data access token obtained (${#DATA_ACCESS_TOKEN} chars)"
fi

# Translate data endpoint from container-internal URL to host-accessible URL
if [ -n "${DATA_ENDPOINT_RAW}" ] && [ "${DATA_ENDPOINT_RAW}" != "null" ]; then
    DATA_ENDPOINT=$(translate_endpoint "${DATA_ENDPOINT_RAW}")
    ok "Data endpoint (raw): ${DATA_ENDPOINT_RAW}"
    if [ "${DATA_ENDPOINT}" != "${DATA_ENDPOINT_RAW}" ]; then
        ok "Data endpoint (translated): ${DATA_ENDPOINT}"
    fi
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

step "Checking Docker container health..."
for CONTAINER in "${NODE_A_CONTAINER}" "${NODE_B_CONTAINER}"; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER}" 2>/dev/null || echo "unknown")
    STATUS=$(docker inspect --format='{{.State.Status}}' "${CONTAINER}" 2>/dev/null || echo "unknown")
    ok "Container ${CONTAINER}: status=${STATUS}, health=${HEALTH}"
done

PHASE_RESULTS+=("${GREEN}[7]${NC} Verify")

# ==========================================================================
# Summary
# ==========================================================================
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  N2N Docker Test Complete${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  Mode:             Docker Containers + Synchronized Storage + IPFS"
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
echo -e "  ${BOLD}Tear down:${NC} docker compose down -v"
echo ""
