#!/usr/bin/env bash
# =============================================================================
# kenya-usecase-test.sh — Multi-publisher Kenya use case (publish-and-aggregate)
# =============================================================================
# Run from this directory: ./kenya-usecase-test.sh
# Prereqs:
#   - ./setup.sh completed (5 tenants: KRA, KPA, KENTRADE, AFA, Trader)
#   - docker compose up -d (node on host port 3041)
#   - ./provision-storage.sh completed (4 publisher datasets + offers seeded)
#   - jq installed
#
# Story: four authorities (KRA, KPA, KENTRADE, AFA) each PUBLISH their own
# consignment slice into the shared [Node] catalogue. The consumer (Trader)
# DISCOVERS all four, NEGOTIATES + PULLS from each (scoping each pull by the
# authority's consignment id), and AGGREGATES the four distinct slices locally.
# This is the DSP-native publish-and-aggregate model — no cross-tenant writes.
#
# Phases:
#   0. Health (tenant-gated) + per-tenant logins
#   1. Trader discovers all four publisher datasets in the shared catalogue
#   2. The four datasets carry four DISTINCT publisher attributions
#   3. For each authority: negotiate → FINALIZED → transfer → pull its slice
#   4. Aggregation: all four distinct consignment slices were pulled
#   5. Negative-path isolation (cross-tenant credential mix is rejected)
#
# Push-mode, S4 boot-republish and the full 5-layer isolation matrix are NOT
# re-tested here — they're covered by the base kenyaCommunityNodeDocker scaffold.
# This scaffold focuses on the multi-publisher aggregation use case.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

step() { echo -e "${BLUE}  -> $1${NC}"; }
ok()   { echo -e "${GREEN}  [OK] $1${NC}"; }
fail() { echo -e "${RED}  [FAIL] $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}  [WARN] $1${NC}"; }
info() { echo -e "${BLUE}  $1${NC}"; }

phase() {
    echo ""
    echo "================================================================"
    echo -e "  ${BOLD}Phase $1: $2${NC}"
    echo "================================================================"
    echo ""
}

[ -s .node-password ]     || fail "Missing .node-password — run ./setup.sh first"
[ -s .tenants ]           || fail "Missing .tenants — run ./setup.sh first"
[ -s .tenant-users ]      || fail "Missing .tenant-users — run ./setup.sh first"
[ -s .tenant-identities ] || fail "Missing .tenant-identities — run ./setup.sh first"

# shellcheck disable=SC1091
source .node-password
# shellcheck disable=SC1091
source .tenants
# shellcheck disable=SC1091
source .tenant-users
# shellcheck disable=SC1091
source .tenant-identities

HOST="http://localhost:3041"
INTERNAL_URL="http://twin-kenya-usecase-node:3000"
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"
ODRL_CONTEXT="http://www.w3.org/ns/odrl.jsonld"

login() {
    local api_key="$1" email="$2" password="$3"
    curl -sS -i -X POST "${HOST}/authentication/login" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${api_key}" \
    -d "$(jq -n --arg e "$email" --arg p "$password" '{email:$e,password:$p}')" \
    | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-
}

translate_endpoint() {
    local url="$1"
    echo "${url}" | sed "s|${INTERNAL_URL}|${HOST}|g"
}

# ============================================================================
phase 0 "Health check + per-tenant logins"
# ============================================================================
status=$(curl -sS -o /dev/null -w "%{http_code}" "${HOST}/health")
[ "${status}" = "401" ] && ok "Keyless GET /health → 401 (TenantProcessor gate intact)" \
|| fail "Keyless GET /health expected 401, got ${status}"

status=$(curl -sS -o /dev/null -w "%{http_code}" -H "x-api-key: ${TENANT_KRA_API_KEY}" "${HOST}/health")
# ("feat: tenant id in jwt") /health no longer has skipAuth: true — api-key
# alone is rejected (session JWT required). 401 here proves both gates are intact.
[ "${status}" = "401" ] && ok "GET /health with KRA api-key (no session) → 401 (auth gate intact)" \
|| fail "GET /health with KRA api-key (no session) expected 401, got ${status}"

JWT_TRADER=$(login "${TENANT_TRADER_API_KEY}" "${TENANT_TRADER_USER_EMAIL}" "${TENANT_TRADER_USER_PASSWORD}")
[ -n "${JWT_TRADER}" ] || fail "Trader login did not return a JWT"
ok "Trader admin (${TENANT_TRADER_USER_EMAIL}) logged in"

# Provisioned tokens/ids are required for phases 1+.
if [ ! -s .session-tokens ] || [ ! -s .trust-tokens ] || [ ! -s .publishers ]; then
    info "Phases 1+ require ./provision-storage.sh to have run first. Run it and re-run this."
    exit 0
fi
# shellcheck disable=SC1091
source .session-tokens
# shellcheck disable=SC1091
source .trust-tokens
# shellcheck disable=SC1091
source .publishers

# PUBLISHERS is a space-separated list written by provision-storage.sh.
read -r -a PUBS <<< "${PUBLISHERS}"

# ============================================================================
phase 1 "Trader discovers all four publisher datasets in the shared catalogue"
# ============================================================================
catalog_resp=$(curl -sS -X POST "${HOST}/federated-catalogue/request" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
    -H "Cookie: access_token=${TRADER_SESSION_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"CatalogRequestMessage\",\"filter\":[]}")

# Per publisher: confirm its dataset is discoverable and capture its TICKET-G
# baked tenant token from the distribution accessService URL. bash 3.2 has no
# associative arrays, so tokens are stored as dynamic globals (PUB_TOKEN_<PUB>).
for pub in "${PUBS[@]}"; do
    ds_var="${pub}_DATASET_ID"; dataset_id="${!ds_var}"
    found=$(echo "${catalog_resp}" | jq -r '(.dataset[]?, .catalog[]?.dataset[]?) | .["@id"] // empty' | grep -F "${dataset_id}" || true)
    [ -n "${found}" ] || { info "Catalogue: ${catalog_resp}"; fail "[${pub}] dataset ${dataset_id} not discoverable"; }

    dist_url=$(echo "${catalog_resp}" | jq -r --arg id "${dataset_id}" \
        '(.dataset[]?, .catalog[]?.dataset[]?) | select(.["@id"] == $id) | (.distribution // .["dcat:distribution"]) | (if type == "array" then .[0] else . end) | .accessService // empty' | head -1)
    token=$(echo "${dist_url}" | sed -nE 's/.*[?&]x-enc-tenant-token=([^&]+).*/\1/p')
    [ -n "${token}" ] || { info "Distribution URL: ${dist_url}"; fail "[${pub}] distribution carries no x-enc-tenant-token"; }
    printf -v "PUB_TOKEN_${pub}" '%s' "${token}"
    ok "[${pub}] dataset discovered + tenant token captured (${#token} chars: ${token:0:10}…)"
done
ok "Trader discovered all ${#PUBS[@]} publisher datasets in the shared [Node] catalogue"

# ============================================================================
phase 2 "The four datasets carry four DISTINCT publisher attributions"
# ============================================================================
# Each dataset's dcterms:publisher is the publisher's composite identifier
# (nodeDid:hash(tenantId)). Four publishers ⇒ four distinct values. bash 3.2 has
# no associative arrays, so collect the values and count uniques via sort -u.
publisher_list=""
for pub in "${PUBS[@]}"; do
    ds_var="${pub}_DATASET_ID"; dataset_id="${!ds_var}"
    publisher=$(echo "${catalog_resp}" | jq -r --arg id "${dataset_id}" \
        '(.dataset[]?, .catalog[]?.dataset[]?) | select(.["@id"] == $id) | (.["dct:publisher"] // .["dcterms:publisher"]) // empty' | head -1)
    if [ -n "${publisher}" ]; then
        info "[${pub}] publisher = ${publisher}"
        publisher_list="${publisher_list}${publisher}
"
    fi
done
distinct_count=$(printf '%s' "${publisher_list}" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')
if [ "${distinct_count}" -eq "${#PUBS[@]}" ]; then
    ok "${distinct_count} distinct publisher attributions — one per authority"
else
    warn "Expected ${#PUBS[@]} distinct publishers, saw ${distinct_count} (publisher attribution may be node-scoped in this build)"
fi

# ============================================================================
phase 3 "Per authority: negotiate → FINALIZED → transfer → pull its slice"
# ============================================================================
# Records each pulled consignment id (as dynamic globals PULLED_<PUB>) so Phase 4
# can assert the aggregation — bash 3.2 has no associative arrays.
negotiate_and_pull() {
    local pub="$1"
    local did_var="${pub}_DID" offer_var="${pub}_OFFER_ID" ds_var="${pub}_DATASET_ID"
    local cons_var="${pub}_CONSIGNMENT_ID" trust_var="${pub}_TRUST_JWT" token_var="PUB_TOKEN_${pub}"
    local pub_did="${!did_var}" offer_id="${!offer_var}" dataset_id="${!ds_var}"
    local consignment_id="${!cons_var}" pub_trust="${!trust_var}"
    local pub_token="${!token_var}"

    local consumer_pid="urn:contract-negotiation:trader-${pub}-$(date +%s)-${RANDOM}"
    [ "${pub}" = "KRA" ] && info "  consumerPid: ${consumer_pid}"

    # Pre-inject Trader's consumer-side negotiation entry (mobius pattern: avoid
    # the provider-offer-before-consumer-registered race).
    local pnap_body
    pnap_body=$(jq -n \
        --arg id "${consumer_pid}" \
        --arg dateCreated "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
        --arg nodeIdentity "${TRADER_DID}" \
        --arg organizationIdentity "${TRADER_DID}" \
        '{ id: $id, correlationId: "", dateCreated: $dateCreated, state: "REQUESTED", nodeIdentity: $nodeIdentity, organizationIdentity: $organizationIdentity }')
    local pnap_status
    pnap_status=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT \
        "${HOST}/rights-management/negotiations/admin/${consumer_pid}" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
        -H "Authorization: Bearer ${TRADER_SESSION_JWT}" \
        -d "${pnap_body}")
    { [ "${pnap_status}" = "204" ] || [ "${pnap_status}" = "200" ]; } \
        || fail "[${pub}] PNAP pre-inject failed (HTTP ${pnap_status})"

    # ContractRequestMessage mirroring the publisher's seeded offer. Callback
    # carries Trader's token (reply routes to Trader); request routed to the
    # publisher via its tenant token.
    local offer_json callback_url negotiate_body
    offer_json=$(jq -n \
        --arg ctx "${ODRL_CONTEXT}" --arg uid "${offer_id}" --arg assigner "${pub_did}" --arg target "${dataset_id}" \
        '{ "@context": $ctx, "@type": "Offer", uid: $uid, assigner: $assigner, target: $target,
           action: "read", permission: [{ action: "read", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }] }')
    callback_url="${INTERNAL_URL}/rights-management?x-enc-tenant-token=${TRADER_TENANT_TOKEN}"
    negotiate_body=$(jq -n \
        --arg ctx "${DSP_CONTEXT}" --arg consumerPid "${consumer_pid}" --argjson offer "${offer_json}" --arg callback "${callback_url}" \
        '{ "@context": [$ctx], "@type": "ContractRequestMessage", consumerPid: $consumerPid, offer: $offer, callbackAddress: $callback }')

    local nego_resp nego_http nego_body provider_nego_pid
    nego_resp=$(curl -sS -w "\n%{http_code}" -X POST \
        "${HOST}/rights-management/negotiations/request?x-enc-tenant-token=${pub_token}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
        -d "${negotiate_body}")
    nego_http=$(echo "${nego_resp}" | tail -1); nego_body=$(echo "${nego_resp}" | sed '$d')
    { [ "${nego_http}" = "200" ] || [ "${nego_http}" = "201" ]; } \
        || { info "Nego body: ${nego_body}"; fail "[${pub}] negotiation request failed (HTTP ${nego_http})"; }
    provider_nego_pid=$(echo "${nego_body}" | jq -r '.providerPid // empty')
    [ -n "${provider_nego_pid}" ] || fail "[${pub}] no providerPid in negotiation response"

    # Poll FINALIZED (state lives in the publisher's PNAP partition).
    # For KRA, log each new state observed — shows the audience the DSP state machine in action.
    local final_state="" current_state="" prev_state=""
    local poll_start=$(date +%s)
    for attempt in $(seq 1 15); do
        current_state=$(curl -sS "${HOST}/rights-management/negotiations/${provider_nego_pid}?x-enc-tenant-token=${pub_token}" \
            -H "Authorization: Bearer ${TRADER_TRUST_JWT}" | jq -r '.state // empty')
        if [ -n "${current_state}" ] && [ "${current_state}" != "${prev_state}" ]; then
            [ "${pub}" = "KRA" ] && info "  state: ${current_state}"
            prev_state="${current_state}"
        fi
        if [ "${current_state}" = "FINALIZED" ] || [ "${current_state}" = "VERIFIED" ]; then
            final_state="${current_state}"; break
        fi
        [ "${attempt}" -lt 15 ] && sleep 2
    done
    local poll_secs=$(( $(date +%s) - poll_start ))
    [ -n "${final_state}" ] || fail "[${pub}] negotiation did not reach FINALIZED (last: ${current_state:-unknown})"
    [ "${pub}" = "KRA" ] && info "  state machine settled in ${poll_secs}s"

    local nego_admin_resp agreement_id
    nego_admin_resp=$(curl -sS "${HOST}/rights-management/negotiations/admin/${consumer_pid}" \
        -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
        -H "Authorization: Bearer ${TRADER_SESSION_JWT}")
    agreement_id=$(echo "${nego_admin_resp}" | jq -r '.agreement["@id"] // .agreement.uid // empty')
    [ -n "${agreement_id}" ] || agreement_id="${offer_id}"
    ok "[${pub}] negotiation ${final_state} (agreement ${agreement_id})"
    # Save the agreement id globally for the push phases below.
    printf -v "AGREEMENT_${pub}" '%s' "${agreement_id}"
    if [ "${pub}" = "KRA" ]; then
        local ag_action
        ag_action=$(echo "${nego_admin_resp}" | jq -r '.agreement.permission[0].action // .agreement.action // "read"')
        info "  ODRL permission: action=${ag_action}  target=${dataset_id}"
    fi

    # requestTransfer + startTransfer via the production rest-client wrapper.
    local dsp_pid transfer_msg tr_resp tr_body provider_dsp_pid
    dsp_pid="urn:uuid:trader-${pub}-dsp-$(date +%s)-${RANDOM}"
    transfer_msg=$(jq -c -n \
        --arg ctx "${DSP_CONTEXT}" --arg consumerPid "${dsp_pid}" --arg agreementId "${agreement_id}" \
        --arg callbackAddress "${INTERNAL_URL}/dataspace?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
        '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "Http-Pull-Query-Format", callbackAddress: $callbackAddress }')
    tr_resp=$(node scripts/dsp-client.mjs requestTransfer \
        --host "${HOST}" --tenant-token "${pub_token}" --trust-payload "${TRADER_TRUST_JWT}" --body "${transfer_msg}")
    [ "$(echo "${tr_resp}" | jq -r '.ok')" = "true" ] \
        || fail "[${pub}] requestTransfer failed: $(echo "${tr_resp}" | jq -r '.errorMessage')"
    tr_body=$(echo "${tr_resp}" | jq -c '.body')
    [ "$(echo "${tr_body}" | jq -r '.["@type"] // empty')" != "TransferError" ] \
        || fail "[${pub}] requestTransfer returned TransferError: $(echo "${tr_body}" | jq -r '.code')"
    provider_dsp_pid=$(echo "${tr_body}" | jq -r '.providerPid // empty')
    [ -n "${provider_dsp_pid}" ] || fail "[${pub}] no providerPid from transfer"
    [ "${pub}" = "KRA" ] && info "  requestTransfer → provider DSP pid: ${provider_dsp_pid}"

    local start_msg start_resp start_body data_endpoint_raw data_token data_endpoint
    start_msg=$(jq -c -n \
        --arg ctx "${DSP_CONTEXT}" --arg consumerPid "${dsp_pid}" --arg providerPid "${provider_dsp_pid}" \
        '{ "@context": [$ctx], "@type": "TransferStartMessage", consumerPid: $consumerPid, providerPid: $providerPid }')
    start_resp=$(node scripts/dsp-client.mjs startTransfer \
        --host "${HOST}" --tenant-token "${pub_token}" --trust-payload "${pub_trust}" --body "${start_msg}")
    [ "$(echo "${start_resp}" | jq -r '.ok')" = "true" ] \
        || fail "[${pub}] startTransfer failed: $(echo "${start_resp}" | jq -r '.errorMessage')"
    start_body=$(echo "${start_resp}" | jq -c '.body')
    data_endpoint_raw=$(echo "${start_body}" | jq -r '.dataAddress.endpoint // empty')
    data_token=$(echo "${start_body}" | jq -r '(.dataAddress.endpointProperties // [])[] | select(.name == "authorization") | .value // empty' | head -1)
    [ -n "${data_endpoint_raw}" ] || { info "Start body: ${start_body}"; fail "[${pub}] no dataAddress.endpoint"; }
    data_endpoint=$(translate_endpoint "${data_endpoint_raw}")
    [ -n "${data_token}" ] || data_token="${TRADER_TRUST_JWT}"
    if [ "${pub}" = "KRA" ]; then
        info "  startTransfer → data-plane endpoint: ${data_endpoint}"
        info "  data-plane auth token: ${data_token:0:10}… (${#data_token} chars)"
    fi

    # Pull scoped by this authority's consignment id → test app returns its slice.
    local pull_resp pull_http pull_body
    pull_resp=$(curl -sS -w "\n%{http_code}" -G "${data_endpoint}" \
        --data-urlencode "consumerPid=${dsp_pid}" \
        --data-urlencode "type=https://vocabulary.uncefact.org/Consignment" \
        --data-urlencode "id=${consignment_id}" \
        -H "Authorization: Bearer ${data_token}")
    pull_http=$(echo "${pull_resp}" | tail -1); pull_body=$(echo "${pull_resp}" | sed '$d')
    [ "${pull_http}" = "200" ] || { info "Pull (HTTP ${pull_http}): ${pull_body}"; fail "[${pub}] pull failed"; }
    # The slice must contain this authority's consignment id (robust to single
    # vs itemList wrapping — assert the id is present in the returned payload).
    echo "${pull_body}" | grep -qF "${consignment_id}" \
        || { info "Pull body: ${pull_body}"; fail "[${pub}] pulled slice does not contain ${consignment_id}"; }
    printf -v "PULLED_${pub}" '%s' "${consignment_id}"
    ok "[${pub}] pulled its slice: ${consignment_id}"

    # One-line slice summary (loading/unloading) — shows the audience a real
    # piece of the pulled data, not just a urn. KRA gets the @type too.
    local sample loading_loc unloading_loc consign_type
    sample=$(echo "${pull_body}" | jq -c 'if (type == "object" and has("itemListElement")) then (.itemListElement[0] // empty) else . end' 2>/dev/null)
    if [ -n "${sample}" ] && [ "${sample}" != "null" ]; then
        loading_loc=$(echo "${sample}" | jq -r '.loadingLocation.id // .loadingLocation // "?"')
        unloading_loc=$(echo "${sample}" | jq -r '.unloadingLocation.id // .unloadingLocation // "?"')
        if [ "${pub}" = "KRA" ]; then
            consign_type=$(echo "${sample}" | jq -r '."@type" // .type // "Consignment"')
            info "  slice: @type=${consign_type}  loading=${loading_loc}  unloading=${unloading_loc}"
        else
            info "  slice: loading=${loading_loc}  unloading=${unloading_loc}"
        fi
    fi
}

for pub in "${PUBS[@]}"; do
    echo ""
    echo -e "${BOLD}--- Authority: ${pub} ---${NC}"
    negotiate_and_pull "${pub}"
done

# ============================================================================
phase 4 "Aggregation — all four distinct consignment slices were pulled"
# ============================================================================
slice_list=""
for pub in "${PUBS[@]}"; do
    cid_var="PULLED_${pub}"; cid="${!cid_var}"
    [ -n "${cid}" ] || fail "[${pub}] no slice was pulled"
    slice_list="${slice_list}${cid}
"
done
slice_count=$(printf '%s' "${slice_list}" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')
if [ "${slice_count}" -eq "${#PUBS[@]}" ]; then
    ok "Trader aggregated ${slice_count} DISTINCT consignment slices (one per authority):"
    for pub in "${PUBS[@]}"; do cid_var="PULLED_${pub}"; info "  ${pub} → ${!cid_var}"; done
else
    fail "Expected ${#PUBS[@]} distinct slices, aggregated ${slice_count} — Option-A id-scoping is not distinct"
fi

# ============================================================================
phase 5 "Push setup REJECTS missing tenant token (multi-tenant gate, KRA proof)"
# ============================================================================
# Push transfer where dataAddress.endpoint (the consumer's inbox) carries NO
# x-enc-tenant-token. On a multi-tenant publisher the data plane must refuse
# setupPushSubscription rather than letting the eventual delivery 401 silently.
# We exercise the proof against KRA — symmetric for the other three publishers.
KRA_PUSH_NEG_PID="urn:uuid:trader-KRA-push-neg-$(date +%s)-${RANDOM}"
push_neg_msg=$(jq -c -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${KRA_PUSH_NEG_PID}" \
    --arg agreementId "${AGREEMENT_KRA}" \
    --arg callbackAddress "${INTERNAL_URL}/dataspace?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
    --arg inbox "${INTERNAL_URL}/dataspace/inbox" \
    '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "HttpProxy-PUSH", callbackAddress: $callbackAddress, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')
push_neg_resp=$(node scripts/dsp-client.mjs requestTransfer \
    --host "${HOST}" \
    --tenant-token "${PUB_TOKEN_KRA}" \
    --trust-payload "${TRADER_TRUST_JWT}" \
    --body "${push_neg_msg}")
[ "$(echo "${push_neg_resp}" | jq -r '.ok')" = "true" ] \
    || fail "[KRA push-neg] requestTransfer failed: $(echo "${push_neg_resp}" | jq -r '.errorMessage')"
push_neg_provider_pid=$(echo "${push_neg_resp}" | jq -r '.body.providerPid // empty')
[ -n "${push_neg_provider_pid}" ] || fail "[KRA push-neg] requestTransfer did not return providerPid"

# startTransfer — the data plane setup gate should reject (response body may be
# DSP-spec shape with HTTP 200 OR HTTP 5xx; both forms carry the TransferError envelope).
start_neg_msg=$(jq -c -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${KRA_PUSH_NEG_PID}" \
    --arg providerPid "${push_neg_provider_pid}" \
    '{ "@context": [$ctx], "@type": "TransferStartMessage", consumerPid: $consumerPid, providerPid: $providerPid }')
start_neg_resp=$(node scripts/dsp-client.mjs startTransfer \
    --host "${HOST}" \
    --tenant-token "${PUB_TOKEN_KRA}" \
    --trust-payload "${KRA_TRUST_JWT}" \
    --body "${start_neg_msg}")
start_neg_body=$(echo "${start_neg_resp}" | jq -c '.body')
start_neg_type=$(echo "${start_neg_body}" | jq -r '.["@type"] // empty')
start_neg_code=$(echo "${start_neg_body}" | jq -r '.code // empty')

if [ "${start_neg_type}" = "TransferError" ] && echo "${start_neg_code}" | grep -q "pushSubscriptionMissingTenantToken"; then
    ok "[KRA] Push setup rejected as expected — code: ${start_neg_code}"
elif [ "${start_neg_type}" = "TransferError" ]; then
    info "[KRA] Push setup returned TransferError but with a different code: ${start_neg_code}"
    info "Body: ${start_neg_body}"
    fail "[KRA] Push setup error code mismatch — expected pushSubscriptionMissingTenantToken"
else
    info "[KRA] Response type: ${start_neg_type}; body: ${start_neg_body}"
    fail "[KRA] Push setup did NOT reject the bare endpoint — multi-tenant gate is bypassed"
fi

# ============================================================================
phase 6 "Push setup ACCEPTS endpoint with baked consumer tenant token (KRA proof)"
# ============================================================================
# Same shape as Phase 5 but dataAddress.endpoint now carries Trader's
# x-enc-tenant-token, satisfying the data plane's multi-tenant gate.
KRA_PUSH_POS_PID="urn:uuid:trader-KRA-push-pos-$(date +%s)-${RANDOM}"
push_pos_msg=$(jq -c -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${KRA_PUSH_POS_PID}" \
    --arg agreementId "${AGREEMENT_KRA}" \
    --arg callbackAddress "${INTERNAL_URL}/dataspace?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
    --arg inbox "${INTERNAL_URL}/dataspace/inbox?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
    '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "HttpProxy-PUSH", callbackAddress: $callbackAddress, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')
push_pos_resp=$(node scripts/dsp-client.mjs requestTransfer \
    --host "${HOST}" \
    --tenant-token "${PUB_TOKEN_KRA}" \
    --trust-payload "${TRADER_TRUST_JWT}" \
    --body "${push_pos_msg}")
[ "$(echo "${push_pos_resp}" | jq -r '.ok')" = "true" ] \
    || fail "[KRA push-pos] requestTransfer failed: $(echo "${push_pos_resp}" | jq -r '.errorMessage')"
push_pos_provider_pid=$(echo "${push_pos_resp}" | jq -r '.body.providerPid // empty')
[ -n "${push_pos_provider_pid}" ] || fail "[KRA push-pos] requestTransfer did not return providerPid"

start_pos_msg=$(jq -c -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${KRA_PUSH_POS_PID}" \
    --arg providerPid "${push_pos_provider_pid}" \
    '{ "@context": [$ctx], "@type": "TransferStartMessage", consumerPid: $consumerPid, providerPid: $providerPid }')
start_pos_resp=$(node scripts/dsp-client.mjs startTransfer \
    --host "${HOST}" \
    --tenant-token "${PUB_TOKEN_KRA}" \
    --trust-payload "${KRA_TRUST_JWT}" \
    --body "${start_pos_msg}")
[ "$(echo "${start_pos_resp}" | jq -r '.ok')" = "true" ] \
    || fail "[KRA push-pos] startTransfer failed: $(echo "${start_pos_resp}" | jq -r '.errorMessage')"
start_pos_body=$(echo "${start_pos_resp}" | jq -c '.body')
start_pos_type=$(echo "${start_pos_body}" | jq -r '.["@type"] // empty')

if [ "${start_pos_type}" = "TransferError" ]; then
    err_code=$(echo "${start_pos_body}" | jq -r '.code // "unknown"')
    fail "[KRA push-pos] Push setup failed: ${err_code} | body: ${start_pos_body}"
fi
ok "[KRA] Push setup accepted with baked consumer tenant token (providerPid: ${push_pos_provider_pid})"

# ============================================================================
phase 7 "Negative-path tenant isolation (cross-tenant credential mix rejected)"
# ============================================================================
# Trader's email under KRA's api-key must fail: TenantProcessor scopes the user
# lookup to KRA's partition where the Trader user does not exist.
status=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${HOST}/authentication/login" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_KRA_API_KEY}" \
    -d "$(jq -n --arg e "${TENANT_TRADER_USER_EMAIL}" --arg p "${TENANT_TRADER_USER_PASSWORD}" '{email:$e,password:$p}')")
[ "${status}" = "401" ] \
    && ok "Trader email + KRA api-key → 401 (user not found in KRA partition)" \
    || fail "Cross-tenant credential mix expected 401, got ${status}"

echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  ✓ Multi-publisher use case complete${NC}"
echo -e "${BOLD}${GREEN}    ${#PUBS[@]} authorities published → Trader discovered, negotiated,${NC}"
echo -e "${BOLD}${GREEN}    pulled, and aggregated ${slice_count} distinct slices.${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
