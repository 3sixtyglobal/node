#!/usr/bin/env bash
# =============================================================================
# mobius-test.sh — 4-Node Mobius Supply Chain DSP Flow Test
# =============================================================================
# Location: node/apps/node/tests/mobiusSupplyChainDocker/
#
# Simulates the Mobius freight forwarder supply chain scenario:
#   Mobius (Freight Forwarder)            — Publisher, publishes consignment data
#   Ashford Port Health (Border Agency)   — Consumer (UN/LOCODE: GBDVR, GBFOL)
#   Suffolk Coastal Port Health           — Consumer (UN/LOCODE: GBFXT, GBHWR)
#   MCP (Port Community System)           — Consumer (all locations)
#
# Phases:
#   Phase 0: Prerequisites (IPFS + 4 node containers)
#   Phase 1: Authentication (login + DIDs + trust tokens for all 4 nodes)
#   Phase 2: Seed ODRL Offer on Mobius (publisher)
#   Phase 3: Discovery (verify federated catalogue has datasets)
#   Phase 4: Contract Negotiation — Ashford negotiates with Mobius
#   Phase 5: Contract Negotiation — Suffolk negotiates with Mobius
#   Phase 6: Contract Negotiation — MCP negotiates with Mobius
#   Phase 7: Data Transfer — Ashford pulls from Mobius
#   Phase 8: Data Transfer — Suffolk pulls from Mobius
#   Phase 9: Data Transfer — MCP pulls from Mobius
#   Phase 10: Location filtering verification (per-consumer LOCODE check)
#   Phase 11: Final verification
#
# Usage:
#   ./mobius-test.sh <mobius-pw> <ashford-pw> <suffolk-pw> <mcp-pw>
#
# Prerequisites:
#   - docker compose up (IPFS + all 4 nodes running)
#   - All nodes bootstrapped via setup.sh
#   - StorageItem provisioned via provision-storage.sh
#   - jq installed
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MOBIUS_PORT="${MOBIUS_PORT:-3000}"
ASHFORD_PORT="${ASHFORD_PORT:-3001}"
SUFFOLK_PORT="${SUFFOLK_PORT:-3002}"
MCP_PORT="${MCP_PORT:-3003}"

# Host-accessible URLs (via Docker port forwarding)
MOBIUS_HOST="${MOBIUS_HOST:-http://localhost:3020}"
ASHFORD_HOST="${ASHFORD_HOST:-http://localhost:3021}"
SUFFOLK_HOST="${SUFFOLK_HOST:-http://localhost:3022}"
MCP_HOST="${MCP_HOST:-http://localhost:3023}"

MOBIUS_EMAIL="${MOBIUS_EMAIL:-admin@node}"
ASHFORD_EMAIL="${ASHFORD_EMAIL:-admin@node}"
SUFFOLK_EMAIL="${SUFFOLK_EMAIL:-admin@node}"
MCP_EMAIL="${MCP_EMAIL:-admin@node}"

IPFS_API="${IPFS_API:-http://localhost:5021/api/v0}"

# Docker container names (must match docker-compose.yml)
MOBIUS_CONTAINER="twin-mobius-node"
ASHFORD_CONTAINER="twin-ashford-node"
SUFFOLK_CONTAINER="twin-suffolk-node"
MCP_CONTAINER="twin-mcp-node"

# Container-internal service names (for container-to-container communication)
MOBIUS_INTERNAL="http://twin-mobius:${MOBIUS_PORT}"
ASHFORD_INTERNAL="http://twin-ashford:${ASHFORD_PORT}"
SUFFOLK_INTERNAL="http://twin-suffolk:${SUFFOLK_PORT}"
MCP_INTERNAL="http://twin-mcp:${MCP_PORT}"

# Trust verification method ID
TRUST_VERIFICATION_METHOD_ID="${TRUST_VERIFICATION_METHOD_ID:-trust-assertion}"

# DSP context
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"

# Test app dataset and offers (must match testDataspaceDataPlaneApp.ts)
DATASET_ID="https://twin.example.org/data-service-1"
ENTITY_TYPE="https://vocabulary.uncefact.org/Consignment"

# Per-consumer offer IDs for location-based filtering
ASHFORD_OFFER_ID="urn:policy:mobius-consignment-offer-ashford"
SUFFOLK_OFFER_ID="urn:policy:mobius-consignment-offer-suffolk"
MCP_OFFER_ID="urn:policy:mobius-consignment-offer-mcp"

# Sync wait configuration
SYNC_MAX_RETRIES="${SYNC_MAX_RETRIES:-20}"
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

step()      { echo -e "${CYAN}  -> $1${NC}"; }
ok()        { echo -e "${GREEN}  [OK] $1${NC}"; }
fail()      { echo -e "${RED}  [FAIL] $1${NC}"; exit 1; }
soft_fail() { echo -e "${RED}  [FAIL] $1${NC}"; }
warn()      { echo -e "${YELLOW}  [WARN] $1${NC}"; }
show_json() { echo "$1" | jq '.' 2>/dev/null || echo "$1"; }

# ---------------------------------------------------------------------------
# Reusable Helper Functions
# ---------------------------------------------------------------------------

# Login to a node and return session token via RESULT_TOKEN
login_node() {
    local host="$1" email="$2" password="$3"
    local response token

    response=$(curl -si -X POST "${host}/authentication/login" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg e "$email" --arg p "$password" '{"email":$e,"password":$p}')") \
        || fail "Login to ${host} failed"

    token=$(echo "${response}" | grep -i '^set-cookie:' | sed 's/.*access_token=//;s/;.*//' | tr -d '[:space:]')
    if [ -z "${token}" ]; then
        echo "${response}"
        fail "Could not extract token from ${host} Set-Cookie header"
    fi

    RESULT_TOKEN="${token}"
}

# Read DID from a container's engine-state.json
read_did() {
    local container="$1"
    local did

    did=$(docker exec "${container}" cat /app/data/engine-state.json 2>/dev/null | jq -r '.nodeId // empty' 2>/dev/null)
    if [ -z "${did}" ]; then
        fail "Could not read DID from ${container}. Is it bootstrapped?"
    fi

    RESULT_DID="${did}"
}

# Generate JWT-VC trust token on a node
generate_trust() {
    local host="$1" did="$2" session_token="$3"
    local response http_code body jwt

    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${host}/identity/${did}/verifiable-credential/${TRUST_VERIFICATION_METHOD_ID}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${session_token}" \
        -d '{"subject": {"id": "urn:trust:mobius-supply-chain"}}') || true

    http_code=$(echo "${response}" | tail -1)
    body=$(echo "${response}" | sed '$d')

    if [ "${http_code}" != "200" ] && [ "${http_code}" != "201" ]; then
        show_json "${body}"
        fail "Failed to generate trust token on ${host} (HTTP ${http_code})"
    fi

    jwt=$(echo "${body}" | jq -r '.jwt // empty' 2>/dev/null)
    if [ -z "${jwt}" ]; then
        show_json "${body}"
        fail "Could not extract JWT from trust token response on ${host}"
    fi

    RESULT_TRUST_TOKEN="${jwt}"
}

# Build an ODRL Offer JSON for seeding / negotiation
# Usage: build_offer_json <offer_id> <assigner> <target> [collection_source] [refinement_field] [refinement_value]
#   Without refinement: simple offer (sees all data)
#   With refinement: AssetCollection offer (per-item filtering via source + refinement)
build_offer_json() {
    local offer_id="$1" assigner="$2" target="$3"
    local collection_source="${4:-}" refinement_field="${5:-}" refinement_value="${6:-}"

    if [ -n "${refinement_field}" ]; then
        # Canonical typed form per rights-management PR #133 (legacy "twin:jsonpath:..." removed).
        # source is the literal "twin:jsonPath" type marker; the JSONPath expression lives in the
        # sibling "twin:jsonPathExpression" property. Same shape for the refinement leftOperand.
        jq -n \
            --arg uid "${offer_id}" \
            --arg assigner "${assigner}" \
            --arg target "${target}" \
            --arg source_expr "${collection_source}" \
            --arg field_expr "${refinement_field}" \
            --arg value "${refinement_value}" \
            '{
                "@context": "http://www.w3.org/ns/odrl.jsonld",
                "@type": "Offer",
                "uid": $uid,
                "assigner": $assigner,
                "target": $target,
                "action": "read",
                "permission": [{
                    "action": "read",
                    "target": {
                        "@type": "AssetCollection",
                        "source": "twin:jsonPath",
                        "twin:jsonPathExpression": $source_expr,
                        "refinement": {
                            "leftOperand": {
                                "@type": "twin:jsonPath",
                                "twin:jsonPathExpression": $field_expr
                            },
                            "operator": "eq",
                            "rightOperand": $value
                        }
                    }
                }]
            }'
    else
        jq -n \
            --arg uid "${offer_id}" \
            --arg assigner "${assigner}" \
            --arg target "${target}" \
            '{
                "@context": "http://www.w3.org/ns/odrl.jsonld",
                "@type": "Offer",
                "uid": $uid,
                "assigner": $assigner,
                "target": $target,
                "action": "read",
                "permission": [{
                    "action": "read",
                    "target": {
                        "@type": "twin:jsonPath",
                        "twin:jsonPathExpression": "$"
                    }
                }]
            }'
    fi
}

# Seed ODRL Offer JSON into a node's PAP
# Usage: seed_offer <host> <session_token> <offer_json>
seed_offer() {
    local host="$1" session_token="$2" body="$3"
    local response http_code

    response=$(curl -si -X POST "${host}/rights-management/policy/admin" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${session_token}" \
        -d "${body}") || true

    http_code=$(echo "${response}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')

    if [ "${http_code}" != "201" ]; then
        echo "  HTTP Status: ${http_code}"
        echo "${response}"
        fail "Failed to seed offer into PAP at ${host} (HTTP ${http_code})"
    fi
}

# Run full PNP contract negotiation between consumer and provider
# Usage: negotiate_contract <consumer_host> <provider_host> <consumer_trust> <consumer_did> <provider_did> <consumer_internal> <consumer_token> <offer_json>
# Sets: RESULT_AGREEMENT_ID, RESULT_PROVIDER_NEGOTIATION_PID
negotiate_contract() {
    local consumer_host="$1" provider_host="$2" consumer_trust="$3"
    local consumer_did="$4" provider_did="$5" consumer_internal="$6"
    local consumer_token="$7" offer_json="$8"
    local consumer_pid="urn:contract-negotiation:consumer-$(date +%s)-${RANDOM}"

    # Pre-inject consumer-side negotiation entry (race condition fix)
    step "Pre-injecting consumer negotiation entry..."
    local pnap_body pnap_response pnap_http
    pnap_body=$(jq -n \
        --arg id "${consumer_pid}" \
        --arg dateCreated "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
        --arg organizationIdentity "${consumer_did}" \
        '{
            "id": $id,
            "correlationId": "",
            "dateCreated": $dateCreated,
            "state": "REQUESTED",
            "organizationIdentity": $organizationIdentity
        }')

    pnap_response=$(curl -s -w "\n%{http_code}" -X PUT \
        "${consumer_host}/rights-management/negotiations/admin/${consumer_pid}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${consumer_token}" \
        -d "${pnap_body}") || true

    pnap_http=$(echo "${pnap_response}" | tail -1)
    if [ "${pnap_http}" = "204" ] || [ "${pnap_http}" = "200" ]; then
        ok "Consumer negotiation entry created"
    else
        soft_fail "Failed to create consumer negotiation entry (HTTP ${pnap_http})"
    fi

    # Send ContractRequestMessage to provider
    step "Sending ContractRequestMessage to provider..."
    local negotiate_body negotiate_response negotiate_http negotiate_resp_body
    # callbackAddress must include the rights-management mount path. In production
    # the consumer-side PNP service does this via buildCallbackUrl + _callbackPath.
    # Here (curl) we mirror that so the provider's outbound rest-client (which uses
    # pathPrefix: "" since the URL has the path baked in) reaches the right route.
    negotiate_body=$(jq -n \
        --arg ctx "${DSP_CONTEXT}" \
        --arg consumerPid "${consumer_pid}" \
        --argjson offer "${offer_json}" \
        --arg callback "${consumer_internal}/rights-management" \
        '{
            "@context": [$ctx],
            "@type": "ContractRequestMessage",
            "consumerPid": $consumerPid,
            "offer": $offer,
            "callbackAddress": $callback
        }')

    negotiate_response=$(curl -s -w "\n%{http_code}" -X POST \
        "${provider_host}/rights-management/negotiations/request" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${consumer_trust}" \
        -d "${negotiate_body}") || true

    negotiate_http=$(echo "${negotiate_response}" | tail -1)
    negotiate_resp_body=$(echo "${negotiate_response}" | sed '$d')

    if [ "${negotiate_http}" != "200" ] && [ "${negotiate_http}" != "201" ]; then
        show_json "${negotiate_resp_body}"
        fail "Contract negotiation request failed (HTTP ${negotiate_http})"
    fi

    local provider_nego_pid
    provider_nego_pid=$(echo "${negotiate_resp_body}" | jq -r '.providerPid // empty' 2>/dev/null)
    if [ -z "${provider_nego_pid}" ]; then
        fail "Could not extract providerPid from negotiation response"
    fi

    ok "Negotiation initiated (providerPid: ${provider_nego_pid})"

    # Poll for FINALIZED
    step "Polling for negotiation completion..."
    local max_retries=15 delay=2 final_state=""
    for attempt in $(seq 1 "${max_retries}"); do
        local state_response state_http state_body current_state
        state_response=$(curl -s -w "\n%{http_code}" \
            "${provider_host}/rights-management/negotiations/${provider_nego_pid}" \
            -H "Authorization: Bearer ${consumer_trust}") || true
        state_http=$(echo "${state_response}" | tail -1)
        state_body=$(echo "${state_response}" | sed '$d')
        current_state=$(echo "${state_body}" | jq -r '.state // empty' 2>/dev/null)

        echo -e "    ${CYAN}Attempt ${attempt}/${max_retries}: state=${current_state}${NC}"

        if [ "${current_state}" = "FINALIZED" ] || [ "${current_state}" = "VERIFIED" ]; then
            final_state="${current_state}"
            break
        fi
        if [ "${attempt}" -lt "${max_retries}" ]; then
            sleep "${delay}"
        fi
    done

    if [ "${final_state}" = "FINALIZED" ] || [ "${final_state}" = "VERIFIED" ]; then
        ok "Negotiation completed (state: ${final_state})"

        # Extract actual agreement ID from consumer's PNAP
        local pnap_response2 pnap_body2 agreement_id
        pnap_response2=$(curl -s -w "\n%{http_code}" \
            "${consumer_host}/rights-management/negotiations/admin/${consumer_pid}" \
            -H "Authorization: Bearer ${consumer_token}") || true
        pnap_body2=$(echo "${pnap_response2}" | sed '$d')
        agreement_id=$(echo "${pnap_body2}" | jq -r '.agreement["@id"] // .agreement.uid // empty' 2>/dev/null)

        if [ -n "${agreement_id}" ]; then
            RESULT_AGREEMENT_ID="${agreement_id}"
            ok "Agreement ID: ${agreement_id}"
        else
            local fallback_offer_id
            fallback_offer_id=$(echo "${offer_json}" | jq -r '.uid // empty' 2>/dev/null)
            warn "Could not extract agreement ID from PNAP, falling back to offer ID"
            RESULT_AGREEMENT_ID="${fallback_offer_id}"
        fi
        RESULT_PROVIDER_NEGOTIATION_PID="${provider_nego_pid}"
    else
        fail "Negotiation did not reach FINALIZED (stuck at: ${final_state:-unknown})"
    fi
}

# Run full DSP transfer flow: request -> start -> pull -> complete
# Usage: run_dsp_transfer <flow_name> <provider_host> <consumer_host> \
#                         <consumer_trust> <provider_trust> <agreement_id> \
#                         <consumer_internal>
# Sets: RESULT_ITEM_COUNT, RESULT_FINAL_STATE
run_dsp_transfer() {
    local flow_name="$1" provider_host="$2" consumer_host="$3"
    local consumer_trust="$4" provider_trust="$5" agreement_id="$6"
    local consumer_internal="$7"
    local consumer_pid="urn:uuid:mobius-${flow_name}-$(date +%s)-${RANDOM}"
    local callback="${consumer_internal}/dataspace"

    # --- Transfer Request ---
    step "[${flow_name}] Requesting transfer (consumerPid: ${consumer_pid})..."

    local tr_response tr_http tr_body provider_pid transfer_state
    tr_response=$(curl -s -w "\n%{http_code}" -X POST "${provider_host}/dataspace/transfers/request" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${consumer_trust}" \
        -d "$(jq -n \
            --arg ctx "${DSP_CONTEXT}" \
            --arg consumerPid "${consumer_pid}" \
            --arg agreementId "${agreement_id}" \
            --arg callbackAddress "${callback}" \
            '{
                "@context": [$ctx],
                "@type": "TransferRequestMessage",
                "consumerPid": $consumerPid,
                "agreementId": $agreementId,
                "format": "Http-Pull-Query-Format",
                "callbackAddress": $callbackAddress
            }')") || true

    tr_http=$(echo "${tr_response}" | tail -1)
    tr_body=$(echo "${tr_response}" | sed '$d')

    local response_type
    response_type=$(echo "${tr_body}" | jq -r '.["@type"] // empty' 2>/dev/null)
    if [ "${response_type}" = "TransferError" ]; then
        local error_code
        error_code=$(echo "${tr_body}" | jq -r '.code // "unknown"' 2>/dev/null)
        soft_fail "[${flow_name}] Transfer request returned TransferError: ${error_code}"
        RESULT_ITEM_COUNT=0
        RESULT_FINAL_STATE="ERROR"
        return 1
    fi

    provider_pid=$(echo "${tr_body}" | jq -r '.providerPid // empty' 2>/dev/null)
    if [ -z "${provider_pid}" ] || [ "${provider_pid}" = "null" ]; then
        soft_fail "[${flow_name}] Could not extract providerPid"
        RESULT_ITEM_COUNT=0
        RESULT_FINAL_STATE="ERROR"
        return 1
    fi
    ok "[${flow_name}] Transfer created (providerPid: ${provider_pid})"

    # --- Start Transfer ---
    step "[${flow_name}] Starting transfer..."

    local start_response start_http start_body data_token data_endpoint_raw data_endpoint
    start_response=$(curl -s -w "\n%{http_code}" -X POST "${provider_host}/dataspace/transfers/${provider_pid}/start" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${provider_trust}" \
        -d "{
            \"@context\": [\"${DSP_CONTEXT}\"],
            \"@type\": \"TransferStartMessage\",
            \"consumerPid\": \"${consumer_pid}\",
            \"providerPid\": \"${provider_pid}\"
        }") || true

    start_http=$(echo "${start_response}" | tail -1)
    start_body=$(echo "${start_response}" | sed '$d')

    data_token=$(echo "${start_body}" | jq -r '
        (.dataAddress.endpointProperties // [])[]
        | select(.name == "authorization")
        | .value // empty
    ' 2>/dev/null || true)

    data_endpoint_raw=$(echo "${start_body}" | jq -r '.dataAddress.endpoint // empty' 2>/dev/null || true)

    if [ -n "${data_endpoint_raw}" ] && [ "${data_endpoint_raw}" != "null" ]; then
        data_endpoint=$(translate_endpoint "${data_endpoint_raw}")
    else
        data_endpoint="${provider_host}/dataspace/entities"
    fi

    if [ -z "${data_token}" ]; then
        warn "[${flow_name}] No data access token, using consumer trust"
        data_token="${consumer_trust}"
    fi

    ok "[${flow_name}] Transfer started, endpoint: ${data_endpoint}"

    # --- Pull Data ---
    step "[${flow_name}] Pulling data..."

    local pull_response pull_http pull_body item_count
    pull_response=$(curl -s -w "\n%{http_code}" -G "${data_endpoint}" \
        --data-urlencode "consumerPid=${consumer_pid}" \
        --data-urlencode "type=${ENTITY_TYPE}" \
        -H "Authorization: Bearer ${data_token}") || true

    pull_http=$(echo "${pull_response}" | tail -1)
    pull_body=$(echo "${pull_response}" | sed '$d')
    item_count=$(echo "${pull_body}" | jq -r '[(.itemListElement // [])[] | select(. != null)] | length' 2>/dev/null || echo "0")

    if [ "${item_count}" -gt 0 ] 2>/dev/null; then
        ok "[${flow_name}] Received ${item_count} entity/entities"

        # Extract ALL unloadingLocation.id values (UN/LOCODE) from the response
        local ports_of_entry
        ports_of_entry=$(echo "${pull_body}" | jq -r '[(.itemListElement // [])[] | select(. != null) | .unloadingLocation.id // empty] | map(select(. != "")) | join(",")' 2>/dev/null || true)
        if [ -n "${ports_of_entry}" ] && [ "${ports_of_entry}" != "null" ]; then
            ok "[${flow_name}] Consignment unloadingLocation IDs: ${ports_of_entry}"
        else
            warn "[${flow_name}] No unloadingLocation in consignment data"
        fi
    else
        local ports_of_entry=""
        warn "[${flow_name}] No entities in response"
    fi

    RESULT_PORTS_OF_ENTRY="${ports_of_entry:-}"

    # --- Complete Transfer ---
    step "[${flow_name}] Completing transfer..."

    local complete_response complete_http complete_body final_state
    complete_response=$(curl -s -w "\n%{http_code}" -X POST "${provider_host}/dataspace/transfers/${provider_pid}/complete" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${consumer_trust}" \
        -d "{
            \"@context\": [\"${DSP_CONTEXT}\"],
            \"@type\": \"TransferCompletionMessage\",
            \"consumerPid\": \"${consumer_pid}\",
            \"providerPid\": \"${provider_pid}\"
        }") || true

    complete_http=$(echo "${complete_response}" | tail -1)
    complete_body=$(echo "${complete_response}" | sed '$d')
    final_state=$(echo "${complete_body}" | jq -r '.state // empty' 2>/dev/null || true)

    if [ -n "${final_state}" ] && [ "${final_state}" != "null" ]; then
        ok "[${flow_name}] Transfer completed (state: ${final_state})"
    else
        warn "[${flow_name}] Could not confirm completion"
        final_state="UNKNOWN"
    fi

    RESULT_ITEM_COUNT="${item_count}"
    RESULT_FINAL_STATE="${final_state}"
}

# Count datasets in FC response (top-level + nested catalogs)
count_datasets() {
    echo "$1" | jq -r '[(.dataset // [] | if type == "array" then .[] else . end), (.catalog // [] | if type == "array" then .[] else . end | .dataset // [] | if type == "array" then .[] else . end)] | length' 2>/dev/null || echo "0"
}

# Translate container-internal URL to host-accessible URL
translate_endpoint() {
    local url="$1"
    url=$(echo "${url}" | sed "s|http://twin-mobius:${MOBIUS_PORT}|http://localhost:3020|g")
    url=$(echo "${url}" | sed "s|http://twin-ashford:${ASHFORD_PORT}|http://localhost:3021|g")
    url=$(echo "${url}" | sed "s|http://twin-suffolk:${SUFFOLK_PORT}|http://localhost:3022|g")
    url=$(echo "${url}" | sed "s|http://twin-mcp:${MCP_PORT}|http://localhost:3023|g")
    echo "${url}"
}

# Query federated catalogue and return dataset count
query_catalogue() {
    local host="$1" token="$2"
    local response http_code body

    response=$(curl -s -w "\n%{http_code}" -X POST "${host}/federated-catalogue/request" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${token}" \
        -d "{
            \"@context\": [\"${DSP_CONTEXT}\"],
            \"@type\": \"CatalogRequestMessage\",
            \"filter\": []
        }") || true

    http_code=$(echo "${response}" | tail -1)
    body=$(echo "${response}" | sed '$d')
    RESULT_CATALOG_BODY="${body}"
    RESULT_DATASET_COUNT=$(count_datasets "${body}")
}

# ---------------------------------------------------------------------------
# Argument validation
# ---------------------------------------------------------------------------
if [ $# -lt 4 ]; then
    echo -e "${BOLD}Usage:${NC} $0 <mobius-pw> <ashford-pw> <suffolk-pw> <mcp-pw>"
    echo ""
    echo "  Passwords are printed during setup.sh bootstrap."
    echo "  IMPORTANT: Wrap passwords in single quotes."
    echo ""
    echo "  Optional env vars:"
    echo "    SYNC_MAX_RETRIES (default: 20)"
    echo "    SYNC_RETRY_DELAY (default: 10 seconds)"
    exit 1
fi

MOBIUS_PASSWORD="$1"
ASHFORD_PASSWORD="$2"
SUFFOLK_PASSWORD="$3"
MCP_PASSWORD="$4"

echo -e "${BOLD}Mobius Supply Chain Docker Test (4-node)${NC}"
echo -e "  Mobius (Freight Forwarder): ${MOBIUS_HOST} (container: ${MOBIUS_CONTAINER})"
echo -e "  Ashford (Port Health):     ${ASHFORD_HOST} (container: ${ASHFORD_CONTAINER})"
echo -e "  Suffolk (Coastal PH):      ${SUFFOLK_HOST} (container: ${SUFFOLK_CONTAINER})"
echo -e "  MCP (Port Community):      ${MCP_HOST} (container: ${MCP_CONTAINER})"
echo -e "  IPFS: ${IPFS_API}"

# ==========================================================================
# Phase 0: Prerequisites Check
# ==========================================================================
phase 0 "Prerequisites Check"

step "Checking IPFS at ${IPFS_API}..."
IPFS_ID=$(curl -sf -X POST "${IPFS_API}/id" 2>/dev/null) || fail "IPFS not reachable"
ok "IPFS running"

check_node() {
    local label="$1" container="$2" host="$3"
    step "Checking ${label}..."
    docker inspect "${container}" >/dev/null 2>&1 || fail "Container ${container} not found"
    curl -sf "${host}/info" >/dev/null 2>&1 || fail "${label} not reachable at ${host}/info"
    ok "${label} is running"
}
check_node "Mobius" "${MOBIUS_CONTAINER}" "${MOBIUS_HOST}"
check_node "Ashford" "${ASHFORD_CONTAINER}" "${ASHFORD_HOST}"
check_node "Suffolk" "${SUFFOLK_CONTAINER}" "${SUFFOLK_HOST}"
check_node "MCP" "${MCP_CONTAINER}" "${MCP_HOST}"

PHASE_RESULTS+=("${GREEN}[0]${NC} Prerequisites")

# ==========================================================================
# Phase 1: Authentication
# ==========================================================================
phase 1 "Authentication (4 nodes)"

step "Logging in to Mobius..."
login_node "${MOBIUS_HOST}" "${MOBIUS_EMAIL}" "${MOBIUS_PASSWORD}"
MOBIUS_TOKEN="${RESULT_TOKEN}"
ok "Mobius token (${#MOBIUS_TOKEN} chars)"

step "Logging in to Ashford..."
login_node "${ASHFORD_HOST}" "${ASHFORD_EMAIL}" "${ASHFORD_PASSWORD}"
ASHFORD_TOKEN="${RESULT_TOKEN}"
ok "Ashford token (${#ASHFORD_TOKEN} chars)"

step "Logging in to Suffolk..."
login_node "${SUFFOLK_HOST}" "${SUFFOLK_EMAIL}" "${SUFFOLK_PASSWORD}"
SUFFOLK_TOKEN="${RESULT_TOKEN}"
ok "Suffolk token (${#SUFFOLK_TOKEN} chars)"

step "Logging in to MCP..."
login_node "${MCP_HOST}" "${MCP_EMAIL}" "${MCP_PASSWORD}"
MCP_TOKEN="${RESULT_TOKEN}"
ok "MCP token (${#MCP_TOKEN} chars)"

# Read DIDs
step "Reading DIDs from containers..."
read_did "${MOBIUS_CONTAINER}"; MOBIUS_DID="${RESULT_DID}"; ok "Mobius DID: ${MOBIUS_DID}"
read_did "${ASHFORD_CONTAINER}"; ASHFORD_DID="${RESULT_DID}"; ok "Ashford DID: ${ASHFORD_DID}"
read_did "${SUFFOLK_CONTAINER}"; SUFFOLK_DID="${RESULT_DID}"; ok "Suffolk DID: ${SUFFOLK_DID}"
read_did "${MCP_CONTAINER}"; MCP_DID="${RESULT_DID}"; ok "MCP DID: ${MCP_DID}"

# Generate trust tokens
step "Generating trust tokens..."
generate_trust "${MOBIUS_HOST}" "${MOBIUS_DID}" "${MOBIUS_TOKEN}"
MOBIUS_TRUST="${RESULT_TRUST_TOKEN}"; ok "Mobius trust token (${#MOBIUS_TRUST} chars)"

generate_trust "${ASHFORD_HOST}" "${ASHFORD_DID}" "${ASHFORD_TOKEN}"
ASHFORD_TRUST="${RESULT_TRUST_TOKEN}"; ok "Ashford trust token (${#ASHFORD_TRUST} chars)"

generate_trust "${SUFFOLK_HOST}" "${SUFFOLK_DID}" "${SUFFOLK_TOKEN}"
SUFFOLK_TRUST="${RESULT_TRUST_TOKEN}"; ok "Suffolk trust token (${#SUFFOLK_TRUST} chars)"

generate_trust "${MCP_HOST}" "${MCP_DID}" "${MCP_TOKEN}"
MCP_TRUST="${RESULT_TRUST_TOKEN}"; ok "MCP trust token (${#MCP_TRUST} chars)"

PHASE_RESULTS+=("${GREEN}[1]${NC} Authentication (4 nodes)")

# ==========================================================================
# Phase 2: Seed ODRL Offer on Mobius (publisher)
# ==========================================================================
phase 2 "Seed Per-Consumer ODRL Offers on Mobius"

# Build per-consumer offers with AssetCollection refinements (canonical typed form, post rights-management PR #133).
# source_expr: JSONPath to the array being filtered (placed under "twin:jsonPathExpression" sibling of source).
# field_expr:  absolute wildcard path for per-item evaluation (placed under leftOperand's "twin:jsonPathExpression").
# Ashford: unloadingLocation.id == unece:LOCODE#GBDVR (Dover area)
ASHFORD_OFFER_JSON=$(build_offer_json "${ASHFORD_OFFER_ID}" "${MOBIUS_DID}" "${DATASET_ID}" \
    "\$.itemList.itemListElement[*]" \
    "\$.itemList.itemListElement[*].unloadingLocation.id" "unece:LOCODE#GBDVR")
# Suffolk: unloadingLocation.id == unece:LOCODE#GBFXT (Felixstowe area)
SUFFOLK_OFFER_JSON=$(build_offer_json "${SUFFOLK_OFFER_ID}" "${MOBIUS_DID}" "${DATASET_ID}" \
    "\$.itemList.itemListElement[*]" \
    "\$.itemList.itemListElement[*].unloadingLocation.id" "unece:LOCODE#GBFXT")
# MCP: no refinement (sees all data)
MCP_OFFER_JSON=$(build_offer_json "${MCP_OFFER_ID}" "${MOBIUS_DID}" "${DATASET_ID}")

step "Seeding Ashford offer (GBDVR only)..."
seed_offer "${MOBIUS_HOST}" "${MOBIUS_TOKEN}" "${ASHFORD_OFFER_JSON}"
ok "Offer seeded: ${ASHFORD_OFFER_ID}"

step "Seeding Suffolk offer (GBFXT only)..."
seed_offer "${MOBIUS_HOST}" "${MOBIUS_TOKEN}" "${SUFFOLK_OFFER_JSON}"
ok "Offer seeded: ${SUFFOLK_OFFER_ID}"

step "Seeding MCP offer (all locations)..."
seed_offer "${MOBIUS_HOST}" "${MOBIUS_TOKEN}" "${MCP_OFFER_JSON}"
ok "Offer seeded: ${MCP_OFFER_ID}"

PHASE_RESULTS+=("${GREEN}[2]${NC} 3 Per-Consumer ODRL Offers Seeded (Mobius)")

# ==========================================================================
# Phase 3: Discovery — Federated Catalogue
# ==========================================================================
phase 3 "Discovery (Federated Catalogue)"

step "Verifying Mobius has datasets registered..."
query_catalogue "${MOBIUS_HOST}" "${MOBIUS_TOKEN}"
if [ "${RESULT_DATASET_COUNT}" -ge 1 ] 2>/dev/null; then
    ok "Mobius: ${RESULT_DATASET_COUNT} dataset(s)"
else
    warn "Mobius: no datasets found"
fi

# Also check consumer catalogues (they should have their own from the test app)
step "Checking consumer catalogues..."
query_catalogue "${ASHFORD_HOST}" "${ASHFORD_TOKEN}"; echo -e "    Ashford: ${RESULT_DATASET_COUNT} dataset(s)"
query_catalogue "${SUFFOLK_HOST}" "${SUFFOLK_TOKEN}"; echo -e "    Suffolk: ${RESULT_DATASET_COUNT} dataset(s)"
query_catalogue "${MCP_HOST}" "${MCP_TOKEN}"; echo -e "    MCP: ${RESULT_DATASET_COUNT} dataset(s)"

PHASE_RESULTS+=("${GREEN}[3]${NC} Discovery")

# ==========================================================================
# Phase 4: Contract Negotiation — Ashford negotiates with Mobius
# ==========================================================================
phase 4 "Contract Negotiation: Ashford <-> Mobius"

step "Negotiating contract: Ashford (consumer) -> Mobius (provider)..."
negotiate_contract "${ASHFORD_HOST}" "${MOBIUS_HOST}" "${ASHFORD_TRUST}" \
    "${ASHFORD_DID}" "${MOBIUS_DID}" "${ASHFORD_INTERNAL}" "${ASHFORD_TOKEN}" \
    "${ASHFORD_OFFER_JSON}"
ASHFORD_AGREEMENT="${RESULT_AGREEMENT_ID}"

PHASE_RESULTS+=("${GREEN}[4]${NC} Ashford<->Mobius negotiation")

# ==========================================================================
# Phase 5: Contract Negotiation — Suffolk negotiates with Mobius
# ==========================================================================
phase 5 "Contract Negotiation: Suffolk <-> Mobius"

step "Negotiating contract: Suffolk (consumer) -> Mobius (provider)..."
negotiate_contract "${SUFFOLK_HOST}" "${MOBIUS_HOST}" "${SUFFOLK_TRUST}" \
    "${SUFFOLK_DID}" "${MOBIUS_DID}" "${SUFFOLK_INTERNAL}" "${SUFFOLK_TOKEN}" \
    "${SUFFOLK_OFFER_JSON}"
SUFFOLK_AGREEMENT="${RESULT_AGREEMENT_ID}"

PHASE_RESULTS+=("${GREEN}[5]${NC} Suffolk<->Mobius negotiation")

# ==========================================================================
# Phase 6: Contract Negotiation — MCP negotiates with Mobius
# ==========================================================================
phase 6 "Contract Negotiation: MCP <-> Mobius"

step "Negotiating contract: MCP (consumer) -> Mobius (provider)..."
negotiate_contract "${MCP_HOST}" "${MOBIUS_HOST}" "${MCP_TRUST}" \
    "${MCP_DID}" "${MOBIUS_DID}" "${MCP_INTERNAL}" "${MCP_TOKEN}" \
    "${MCP_OFFER_JSON}"
MCP_AGREEMENT="${RESULT_AGREEMENT_ID}"

PHASE_RESULTS+=("${GREEN}[6]${NC} MCP<->Mobius negotiation")

# ==========================================================================
# Phase 7: Data Transfer — Ashford pulls from Mobius
# ==========================================================================
phase 7 "Data Transfer: Ashford <-- Mobius"

step "Running DSP transfer: Ashford pulls from Mobius..."
run_dsp_transfer "ashford" "${MOBIUS_HOST}" "${ASHFORD_HOST}" \
    "${ASHFORD_TRUST}" "${MOBIUS_TRUST}" "${ASHFORD_AGREEMENT}" "${ASHFORD_INTERNAL}"

ok "Ashford transfer: ${RESULT_ITEM_COUNT} entities, ports: ${RESULT_PORTS_OF_ENTRY:-n/a}, state: ${RESULT_FINAL_STATE}"
ASHFORD_PORTS="${RESULT_PORTS_OF_ENTRY:-}"
PHASE_RESULTS+=("${GREEN}[7]${NC} Ashford<-Mobius (${RESULT_ITEM_COUNT} entities, ports: ${ASHFORD_PORTS:-n/a})")

# ==========================================================================
# Phase 8: Data Transfer — Suffolk pulls from Mobius
# ==========================================================================
phase 8 "Data Transfer: Suffolk <-- Mobius"

step "Running DSP transfer: Suffolk pulls from Mobius..."
run_dsp_transfer "suffolk" "${MOBIUS_HOST}" "${SUFFOLK_HOST}" \
    "${SUFFOLK_TRUST}" "${MOBIUS_TRUST}" "${SUFFOLK_AGREEMENT}" "${SUFFOLK_INTERNAL}"

ok "Suffolk transfer: ${RESULT_ITEM_COUNT} entities, ports: ${RESULT_PORTS_OF_ENTRY:-n/a}, state: ${RESULT_FINAL_STATE}"
SUFFOLK_PORTS="${RESULT_PORTS_OF_ENTRY:-}"
PHASE_RESULTS+=("${GREEN}[8]${NC} Suffolk<-Mobius (${RESULT_ITEM_COUNT} entities, ports: ${SUFFOLK_PORTS:-n/a})")

# ==========================================================================
# Phase 9: Data Transfer — MCP pulls from Mobius
# ==========================================================================
phase 9 "Data Transfer: MCP <-- Mobius"

step "Running DSP transfer: MCP pulls from Mobius..."
run_dsp_transfer "mcp" "${MOBIUS_HOST}" "${MCP_HOST}" \
    "${MCP_TRUST}" "${MOBIUS_TRUST}" "${MCP_AGREEMENT}" "${MCP_INTERNAL}"

ok "MCP transfer: ${RESULT_ITEM_COUNT} entities, ports: ${RESULT_PORTS_OF_ENTRY:-n/a}, state: ${RESULT_FINAL_STATE}"
MCP_PORTS="${RESULT_PORTS_OF_ENTRY:-}"
PHASE_RESULTS+=("${GREEN}[9]${NC} MCP<-Mobius (${RESULT_ITEM_COUNT} entities, ports: ${MCP_PORTS:-n/a})")

# ==========================================================================
# Phase 10: Location Filtering Verification
# ==========================================================================
phase 10 "Location Filtering Verification"

# Helper: check if a comma-separated list contains a value
contains_port() {
    local ports="$1" target="$2"
    echo "${ports}" | tr ',' '\n' | grep -qF "${target}"
}

FILTER_PASS=true

# Ashford should see GBDVR only (not GBFXT)
step "Checking Ashford received ports: ${ASHFORD_PORTS:-none}"
if [ -z "${ASHFORD_PORTS}" ]; then
    soft_fail "Ashford received no port data"
    FILTER_PASS=false
else
    if contains_port "${ASHFORD_PORTS}" "unece:LOCODE#GBDVR"; then
        ok "Ashford received unece:LOCODE#GBDVR (Dover) — correct"
    else
        soft_fail "Ashford did NOT receive unece:LOCODE#GBDVR (expected)"
        FILTER_PASS=false
    fi
    if contains_port "${ASHFORD_PORTS}" "unece:LOCODE#GBFXT"; then
        soft_fail "Ashford received unece:LOCODE#GBFXT (Felixstowe) — should be filtered out"
        FILTER_PASS=false
    else
        ok "Ashford correctly filtered out GBFXT"
    fi
fi

# Suffolk should see GBFXT only (not GBDVR)
step "Checking Suffolk received ports: ${SUFFOLK_PORTS:-none}"
if [ -z "${SUFFOLK_PORTS}" ]; then
    soft_fail "Suffolk received no port data"
    FILTER_PASS=false
else
    if contains_port "${SUFFOLK_PORTS}" "unece:LOCODE#GBFXT"; then
        ok "Suffolk received unece:LOCODE#GBFXT (Felixstowe) — correct"
    else
        soft_fail "Suffolk did NOT receive unece:LOCODE#GBFXT (expected)"
        FILTER_PASS=false
    fi
    if contains_port "${SUFFOLK_PORTS}" "unece:LOCODE#GBDVR"; then
        soft_fail "Suffolk received unece:LOCODE#GBDVR (Dover) — should be filtered out"
        FILTER_PASS=false
    else
        ok "Suffolk correctly filtered out GBDVR"
    fi
fi

# MCP should see ALL locations (no refinement)
step "Checking MCP received ports: ${MCP_PORTS:-none}"
if [ -z "${MCP_PORTS}" ]; then
    soft_fail "MCP received no port data"
    FILTER_PASS=false
else
    if contains_port "${MCP_PORTS}" "unece:LOCODE#GBFXT" && contains_port "${MCP_PORTS}" "unece:LOCODE#GBDVR"; then
        ok "MCP received both LOCODE#GBFXT and LOCODE#GBDVR — full visibility as expected"
    else
        soft_fail "MCP should see both GBFXT and GBDVR but got: ${MCP_PORTS}"
        FILTER_PASS=false
    fi
fi

# Summary for this phase
echo ""
step "Location filtering summary:"
echo -e "    Ashford (expected: LOCODE#GBDVR only):  received ${ASHFORD_PORTS:-none}"
echo -e "    Suffolk (expected: LOCODE#GBFXT only):  received ${SUFFOLK_PORTS:-none}"
echo -e "    MCP     (expected: both LOCODEs):       received ${MCP_PORTS:-none}"
echo ""
if [ "${FILTER_PASS}" = true ]; then
    ok "Per-item ODRL filtering is working correctly!"
    PHASE_RESULTS+=("${GREEN}[10]${NC} Location filtering (per-item ODRL — PASS)")
else
    soft_fail "Per-item ODRL filtering did not produce expected results"
    PHASE_RESULTS+=("${RED}[10]${NC} Location filtering (per-item ODRL — FAIL)")
fi

# ==========================================================================
# Phase 11: Final Verification
# ==========================================================================
phase 11 "Final Verification"

step "Checking Docker container health..."
for CONTAINER in "${MOBIUS_CONTAINER}" "${ASHFORD_CONTAINER}" "${SUFFOLK_CONTAINER}" "${MCP_CONTAINER}"; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER}" 2>/dev/null || echo "unknown")
    STATUS=$(docker inspect --format='{{.State.Status}}' "${CONTAINER}" 2>/dev/null || echo "unknown")
    ok "Container ${CONTAINER}: status=${STATUS}, health=${HEALTH}"
done

step "Verifying IPFS..."
IPFS_STATS=$(curl -sf -X POST "${IPFS_API}/repo/stat" 2>/dev/null) || true
if [ -n "${IPFS_STATS}" ]; then
    IPFS_OBJECTS=$(echo "${IPFS_STATS}" | jq -r '.NumObjects // "unknown"' 2>/dev/null)
    ok "IPFS repo: ${IPFS_OBJECTS} objects"
fi

step "Final catalogue check (all 4 nodes)..."
query_catalogue "${MOBIUS_HOST}" "${MOBIUS_TOKEN}"; ok "Mobius: ${RESULT_DATASET_COUNT} dataset(s) in catalogue"
query_catalogue "${ASHFORD_HOST}" "${ASHFORD_TOKEN}"; ok "Ashford: ${RESULT_DATASET_COUNT} dataset(s) in catalogue"
query_catalogue "${SUFFOLK_HOST}" "${SUFFOLK_TOKEN}"; ok "Suffolk: ${RESULT_DATASET_COUNT} dataset(s) in catalogue"
query_catalogue "${MCP_HOST}" "${MCP_TOKEN}"; ok "MCP: ${RESULT_DATASET_COUNT} dataset(s) in catalogue"

PHASE_RESULTS+=("${GREEN}[11]${NC} Verification")

# ==========================================================================
# Summary
# ==========================================================================
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Mobius Supply Chain Docker Test Complete (4 nodes)${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo -e "  ${BOLD}Scenario:${NC}"
echo -e "    Mobius (Freight Forwarder) publishes consignment data"
echo -e "    3 consumers negotiate and pull data from Mobius:"
echo -e "      - Ashford Port Health (GBDVR, GBFOL)"
echo -e "      - Suffolk Coastal Port Health (GBFXT, GBHWR)"
echo -e "      - MCP / Port Community System (all locations)"
echo ""
echo -e "  ${BOLD}Phase results:${NC}"
for result in "${PHASE_RESULTS[@]}"; do
    echo -e "    ${result}"
done
echo ""
echo -e "  ${BOLD}Policy:${NC} Per-item ODRL filtering with AssetCollection refinements."
echo -e "  Ashford: unloadingLocation.id==unece:LOCODE#GBDVR | Suffolk: ==LOCODE#GBFXT | MCP: all"
echo ""
echo -e "  ${BOLD}Tear down:${NC} docker compose down -v"
echo ""
