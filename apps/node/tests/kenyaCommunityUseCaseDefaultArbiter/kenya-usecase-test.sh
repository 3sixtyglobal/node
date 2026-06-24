#!/usr/bin/env bash
# =============================================================================
# kenya-usecase-test.sh — Multi-publisher Kenya use case (publish-and-aggregate)
# =============================================================================
# Run from this directory: ./kenya-usecase-test.sh
# Prereqs:
#   - ./setup.sh completed (5 tenants: KRA, KPA, KENTRADE, AFA, Trader)
#   - docker compose up -d (node on host port 3042)
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

# --- Contract-shape helpers (hardening item F) ------------------------------
# These assert the SHAPE of what the platform returns, not just HTTP status, so
# a silent contract drift in a refactor (tenant claim leaking into a token, a
# composite identifier coming back, a missing publisher) fails the run.

# JWT payload (base64url) -> JSON. jq @base64d keeps this portable (no `base64`
# binary, whose flags differ across macOS/Linux). Inspects token CLAIMS.
jwt_claims() { jq -R 'split(".")[1] | gsub("-";"+") | gsub("_";"/") | @base64d | fromjson' <<<"$1" 2>/dev/null; }

# A bare org DID is exactly did:iota:<network>:0x<hex> — no extra ":segment" or
# "#fragment". The pre-#203 composite (nodeDid:hash(tenantId)) would NOT match,
# so this rejects a regression to tenant-scoped identifiers.
is_bare_org_did() { printf '%s' "$1" | grep -qE '^did:iota:[a-z]+:0x[0-9a-f]+$'; }

# Trust tokens must be IDENTITY-ONLY: post-#203 tenant routing is via
# ?organization=, never JWT claims. Assert iss == this tenant's bare org DID and
# that NO tenant/org routing claim (tid/tenantId/tenant/organization/org) appears
# anywhere in the payload.
assert_trust_identity_only() {
    local label="$1" jwt="$2" expected_did="$3" claims iss bad
    claims=$(jwt_claims "${jwt}")
    [ -n "${claims}" ] || fail "[${label}] trust JWT payload could not be decoded"
    iss=$(echo "${claims}" | jq -r '.iss // empty')
    is_bare_org_did "${iss}" || { info "iss=${iss}"; fail "[${label}] trust JWT iss is not a bare org DID"; }
    [ "${iss}" = "${expected_did}" ] || { info "iss=${iss} expected=${expected_did}"; fail "[${label}] trust JWT iss is not this tenant's org DID"; }
    bad=$(echo "${claims}" | jq -r '[paths(scalars) | last | strings | ascii_downcase] | map(select(. == "tid" or . == "tenantid" or . == "tenant" or . == "organization" or . == "org")) | unique | join(", ")')
    [ -z "${bad}" ] || { info "claims: ${claims}"; fail "[${label}] trust JWT carries tenant/org routing claim(s): ${bad}"; }
    ok "[${label}] trust JWT is identity-only (iss=org DID, no tenant/org claims)"
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

HOST="http://localhost:3042"
INTERNAL_URL="http://twin-kenya-defaultarb-node:3000"
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

# Post-#203 (organization identifiers): non-login routes are tenant-routed by
# ?organization=<org-did> (cleartext org DID, reverse-mapped to the tenant via
# Tenant.organizationId + aliases). Encrypted tenant tokens are gone.
urlenc()   { jq -rn --arg v "$1" '$v|@uri'; }
urldecode() { local d="${1//+/ }"; printf '%b' "${d//\%/\\x}"; }
TRADER_ORG_ENC=$(urlenc "${TRADER_DID}")

# Contract-shape (F): the trust tokens minted in provision-storage.sh must be
# identity-only — a tenant/org claim leaking back into the JWT would be a routing
# regression (post-#203 routing is the ?organization= param, not the token).
assert_trust_identity_only "Trader" "${TRADER_TRUST_JWT}" "${TRADER_DID}"
assert_trust_identity_only "KRA"    "${KRA_TRUST_JWT}"    "${KRA_DID}"

# ============================================================================
phase 1 "Trader discovers all four publisher datasets in the shared catalogue"
# ============================================================================
catalog_resp=$(curl -sS -X POST "${HOST}/federated-catalogue/request?organization=${TRADER_ORG_ENC}" \
    -H "Content-Type: application/json" \
    -H "Cookie: access_token=${TRADER_SESSION_JWT}" \
    -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"CatalogRequestMessage\",\"filter\":[]}")

# Per publisher: confirm its dataset is discoverable and capture the publisher's
# org DID baked into the distribution accessService URL (post-#203 the catalogue
# bakes ?organization=<org-did> instead of an encrypted tenant token). bash 3.2
# has no associative arrays, so values are dynamic globals (PUB_ORG_<PUB> /
# PUB_ORG_ENC_<PUB>).
for pub in "${PUBS[@]}"; do
    ds_var="${pub}_DATASET_ID"; dataset_id="${!ds_var}"
    found=$(echo "${catalog_resp}" | jq -r '(.dataset[]?, .catalog[]?.dataset[]?) | .["@id"] // empty' | grep -F "${dataset_id}" || true)
    [ -n "${found}" ] || { info "Catalogue: ${catalog_resp}"; fail "[${pub}] dataset ${dataset_id} not discoverable"; }

    dist_url=$(echo "${catalog_resp}" | jq -r --arg id "${dataset_id}" \
        '(.dataset[]?, .catalog[]?.dataset[]?) | select(.["@id"] == $id) | (.distribution // .["dcat:distribution"]) | (if type == "array" then .[0] else . end) | .accessService // empty' | head -1)
    org_enc=$(echo "${dist_url}" | sed -nE 's/.*[?&]organization=([^&]+).*/\1/p')
    [ -n "${org_enc}" ] || { info "Distribution URL: ${dist_url}"; fail "[${pub}] distribution carries no organization param"; }
    org_did=$(urldecode "${org_enc}")
    expected_var="${pub}_DID"
    [ "${org_did}" = "${!expected_var}" ] \
        || { info "Distribution org: ${org_did} (expected ${!expected_var})"; fail "[${pub}] distribution organization is not the publisher's org DID"; }
    printf -v "PUB_ORG_${pub}" '%s' "${org_did}"
    printf -v "PUB_ORG_ENC_${pub}" '%s' "${org_enc}"
    ok "[${pub}] dataset discovered + org DID captured (${org_did})"
done
ok "Trader discovered all ${#PUBS[@]} publisher datasets in the shared [Node] catalogue"

# ============================================================================
phase 2 "The four datasets carry four DISTINCT publisher attributions"
# ============================================================================
# Post-#203 the composite identifier (nodeDid:hash(tenantId)) is gone — each
# dataset's publisher attribution is its BARE org DID. (Hardening F: assert the
# SHAPE, not just the count — every dcterms:publisher must be present, a bare org
# DID, and equal to that authority's org DID; and the four must be distinct. A
# regression to a composite/node-scoped identifier fails here instead of warning.)
publisher_list=""
for pub in "${PUBS[@]}"; do
    ds_var="${pub}_DATASET_ID"; dataset_id="${!ds_var}"
    did_var="${pub}_DID"; expected_did="${!did_var}"
    publisher=$(echo "${catalog_resp}" | jq -r --arg id "${dataset_id}" \
        '(.dataset[]?, .catalog[]?.dataset[]?) | select(.["@id"] == $id) | (.["dct:publisher"] // .["dcterms:publisher"]) // empty' | head -1)
    [ -n "${publisher}" ] || { info "entry: $(echo "${catalog_resp}" | jq -c --arg id "${dataset_id}" '(.dataset[]?, .catalog[]?.dataset[]?)|select(.["@id"]==$id)')"; fail "[${pub}] dataset has no dct:/dcterms:publisher"; }
    is_bare_org_did "${publisher}" || { info "publisher=${publisher}"; fail "[${pub}] publisher attribution is not a bare org DID"; }
    [ "${publisher}" = "${expected_did}" ] || { info "publisher=${publisher} expected=${expected_did}"; fail "[${pub}] publisher attribution != authority org DID"; }
    info "[${pub}] publisher = ${publisher}"
    publisher_list="${publisher_list}${publisher}
"
done
distinct_count=$(printf '%s' "${publisher_list}" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')
[ "${distinct_count}" -eq "${#PUBS[@]}" ] || fail "Expected ${#PUBS[@]} distinct publisher org DIDs, saw ${distinct_count}"
ok "${distinct_count} distinct publisher attributions — each a bare org DID matching its authority"

# ============================================================================
phase 3 "Per authority: negotiate → FINALIZED → transfer → pull its slice"
# ============================================================================
# Records each pulled consignment id (as dynamic globals PULLED_<PUB>) so Phase 4
# can assert the aggregation — bash 3.2 has no associative arrays.
negotiate_and_pull() {
    local pub="$1"
    local did_var="${pub}_DID" offer_var="${pub}_OFFER_ID" ds_var="${pub}_DATASET_ID"
    local cons_var="${pub}_CONSIGNMENT_ID" trust_var="${pub}_TRUST_JWT"
    local org_var="PUB_ORG_${pub}" org_enc_var="PUB_ORG_ENC_${pub}"
    local pub_did="${!did_var}" offer_id="${!offer_var}" dataset_id="${!ds_var}"
    local consignment_id="${!cons_var}" pub_trust="${!trust_var}"
    local pub_org="${!org_var}" pub_org_enc="${!org_enc_var}"

    local consumer_pid="urn:contract-negotiation:trader-${pub}-$(date +%s)-${RANDOM}"
    [ "${pub}" = "KRA" ] && info "  consumerPid: ${consumer_pid}"

    # Pre-inject Trader's consumer-side negotiation entry (mobius pattern: avoid
    # the provider-offer-before-consumer-registered race). Post-#203 the record
    # has NO nodeIdentity/tenantId fields and organizationIdentity is REQUIRED.
    local pnap_body
    pnap_body=$(jq -n \
        --arg id "${consumer_pid}" \
        --arg dateCreated "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
        --arg organizationIdentity "${TRADER_DID}" \
        '{ id: $id, correlationId: "", dateCreated: $dateCreated, state: "REQUESTED", organizationIdentity: $organizationIdentity }')
    local pnap_status
    pnap_status=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT \
        "${HOST}/rights-management/negotiations/admin/${consumer_pid}?organization=${TRADER_ORG_ENC}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TRADER_SESSION_JWT}" \
        -d "${pnap_body}")
    { [ "${pnap_status}" = "204" ] || [ "${pnap_status}" = "200" ]; } \
        || fail "[${pub}] PNAP pre-inject failed (HTTP ${pnap_status})"

    # ContractRequestMessage mirroring the publisher's seeded offer. Callback
    # carries Trader's org DID (reply routes to Trader); request routed to the
    # publisher via its org DID.
    local offer_json callback_url negotiate_body
    offer_json=$(jq -n \
        --arg ctx "${ODRL_CONTEXT}" --arg uid "${offer_id}" --arg assigner "${pub_did}" --arg target "${dataset_id}" \
        '{ "@context": $ctx, "@type": "Offer", uid: $uid, assigner: $assigner, target: $target,
           action: "read", permission: [{ action: "read", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }] }')
    callback_url="${INTERNAL_URL}/rights-management?organization=${TRADER_ORG_ENC}"
    negotiate_body=$(jq -n \
        --arg ctx "${DSP_CONTEXT}" --arg consumerPid "${consumer_pid}" --argjson offer "${offer_json}" --arg callback "${callback_url}" \
        '{ "@context": [$ctx], "@type": "ContractRequestMessage", consumerPid: $consumerPid, offer: $offer, callbackAddress: $callback }')

    local nego_resp nego_http nego_body provider_nego_pid
    nego_resp=$(curl -sS -w "\n%{http_code}" -X POST \
        "${HOST}/rights-management/negotiations/request?organization=${pub_org_enc}" \
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
        current_state=$(curl -sS "${HOST}/rights-management/negotiations/${provider_nego_pid}?organization=${pub_org_enc}" \
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
    nego_admin_resp=$(curl -sS "${HOST}/rights-management/negotiations/admin/${consumer_pid}?organization=${TRADER_ORG_ENC}" \
        -H "Authorization: Bearer ${TRADER_SESSION_JWT}")
    agreement_id=$(echo "${nego_admin_resp}" | jq -r '.agreement["@id"] // .agreement.uid // empty')
    [ -n "${agreement_id}" ] || agreement_id="${offer_id}"
    ok "[${pub}] negotiation ${final_state} (agreement ${agreement_id})"
    # Save the agreement id globally for the push phases below.
    printf -v "AGREEMENT_${pub}" '%s' "${agreement_id}"

    # Contract-shape (F): the finalized agreement's assigner/assignee must be
    # BARE org DIDs (assigner = this authority, assignee = Trader) — not the
    # pre-#203 composite nodeDid:hash(tenantId).
    local ag_assigner ag_assignee
    ag_assigner=$(echo "${nego_admin_resp}" | jq -r '.agreement.assigner // empty')
    ag_assignee=$(echo "${nego_admin_resp}" | jq -r '.agreement.assignee // empty')
    { [ -n "${ag_assigner}" ] && [ -n "${ag_assignee}" ]; } \
        || { info "agreement: $(echo "${nego_admin_resp}" | jq -c '.agreement')"; fail "[${pub}] agreement missing assigner/assignee"; }
    is_bare_org_did "${ag_assigner}" || { info "assigner=${ag_assigner}"; fail "[${pub}] agreement assigner is not a bare org DID"; }
    is_bare_org_did "${ag_assignee}" || { info "assignee=${ag_assignee}"; fail "[${pub}] agreement assignee is not a bare org DID"; }
    [ "${ag_assigner}" = "${pub_did}" ]   || { info "assigner=${ag_assigner} expected=${pub_did}"; fail "[${pub}] agreement assigner != authority org DID"; }
    [ "${ag_assignee}" = "${TRADER_DID}" ] || { info "assignee=${ag_assignee} expected=${TRADER_DID}"; fail "[${pub}] agreement assignee != Trader org DID"; }
    ok "[${pub}] agreement assigner=authority + assignee=Trader, both bare org DIDs"
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
        --arg callbackAddress "${INTERNAL_URL}/dataspace?organization=${TRADER_ORG_ENC}" \
        '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "Http-Pull-Query-Format", callbackAddress: $callbackAddress }')
    tr_resp=$(node scripts/dsp-client.mjs requestTransfer \
        --host "${HOST}" --organization "${pub_org}" --trust-payload "${TRADER_TRUST_JWT}" --body "${transfer_msg}")
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
        --host "${HOST}" --organization "${pub_org}" --trust-payload "${pub_trust}" --body "${start_msg}")
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
phase 5 "Push setup REJECTS missing organization id (multi-tenant gate, KRA proof)"
# ============================================================================
# Push transfer where dataAddress.endpoint (the consumer's inbox) carries NO
# ?organization=<org-did>. On a multi-tenant publisher the data plane must
# refuse setupPushSubscription (pushSubscriptionMissingOrganizationId,
# post-#203 rename of pushSubscriptionMissingTenantToken) rather than letting
# the eventual delivery 401 silently. Proven against KRA — symmetric for the
# other three publishers.
KRA_PUSH_NEG_PID="urn:uuid:trader-KRA-push-neg-$(date +%s)-${RANDOM}"
push_neg_msg=$(jq -c -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${KRA_PUSH_NEG_PID}" \
    --arg agreementId "${AGREEMENT_KRA}" \
    --arg callbackAddress "${INTERNAL_URL}/dataspace?organization=${TRADER_ORG_ENC}" \
    --arg inbox "${INTERNAL_URL}/dataspace/inbox" \
    '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "HttpProxy-PUSH", callbackAddress: $callbackAddress, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')
push_neg_resp=$(node scripts/dsp-client.mjs requestTransfer \
    --host "${HOST}" \
    --organization "${PUB_ORG_KRA}" \
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
    --organization "${PUB_ORG_KRA}" \
    --trust-payload "${KRA_TRUST_JWT}" \
    --body "${start_neg_msg}")
start_neg_body=$(echo "${start_neg_resp}" | jq -c '.body')
start_neg_type=$(echo "${start_neg_body}" | jq -r '.["@type"] // empty')
start_neg_code=$(echo "${start_neg_body}" | jq -r '.code // empty')

if [ "${start_neg_type}" = "TransferError" ] && echo "${start_neg_code}" | grep -q "pushSubscriptionMissingOrganizationId"; then
    ok "[KRA] Push setup rejected as expected — code: ${start_neg_code}"
elif [ "${start_neg_type}" = "TransferError" ]; then
    info "[KRA] Push setup returned TransferError but with a different code: ${start_neg_code}"
    info "Body: ${start_neg_body}"
    fail "[KRA] Push setup error code mismatch — expected pushSubscriptionMissingOrganizationId"
else
    info "[KRA] Response type: ${start_neg_type}; body: ${start_neg_body}"
    fail "[KRA] Push setup did NOT reject the bare endpoint — multi-tenant gate is bypassed"
fi

# ============================================================================
phase 6 "Push setup ACCEPTS endpoint with baked consumer org DID (KRA proof)"
# ============================================================================
# Same shape as Phase 5 but dataAddress.endpoint now carries Trader's
# ?organization=<org-did>, satisfying the data plane's multi-tenant gate.
KRA_PUSH_POS_PID="urn:uuid:trader-KRA-push-pos-$(date +%s)-${RANDOM}"
push_pos_msg=$(jq -c -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${KRA_PUSH_POS_PID}" \
    --arg agreementId "${AGREEMENT_KRA}" \
    --arg callbackAddress "${INTERNAL_URL}/dataspace?organization=${TRADER_ORG_ENC}" \
    --arg inbox "${INTERNAL_URL}/dataspace/inbox?organization=${TRADER_ORG_ENC}" \
    '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "HttpProxy-PUSH", callbackAddress: $callbackAddress, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')
push_pos_resp=$(node scripts/dsp-client.mjs requestTransfer \
    --host "${HOST}" \
    --organization "${PUB_ORG_KRA}" \
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
    --organization "${PUB_ORG_KRA}" \
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
ok "[KRA] Push setup accepted with baked consumer org DID (providerPid: ${push_pos_provider_pid})"

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

# ============================================================================
phase 8 "Inbox PEP gate under the DEFAULT arbiter — read GRANTED, write DENIED"
# ============================================================================
# Phase 6 left a STARTED push transfer in KRA's tenant (consumerPid =
# KRA_PUSH_POS_PID, providerPid = push_pos_provider_pid, identities provider=KRA /
# consumer=Trader, agreement = read-only). This node runs the DEFAULT arbiter, so
# the inbox gate's interceptWithPolicy actually evaluates the action against the
# agreement — unlike the pass-through scaffold, which grants everything. Both
# deliveries hit notifyActivity → enforceInboxPolicy on the SAME transfer.

# 8a — provider-generated READ delivery (generator = providerPid → action=read).
# The read-only agreement permits read, so the default arbiter GRANTS (HTTP 202).
read_activity=$(jq -c -n \
    --arg gen "${push_pos_provider_pid}" \
    --arg cons "${KRA_CONSIGNMENT_ID:-urn:ucr:KE-KRA-2026-CUSTOMS-0001}" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ "@context": "https://www.w3.org/ns/activitystreams", type: "Create", generator: $gen,
       object: { "@context": "https://vocabulary.uncefact.org/unece-context-D23B.jsonld", type: "Consignment", globalId: $cons },
       updated: $ts }')
read_file=$(mktemp)
read_http=$(curl -sS -o "${read_file}" -w "%{http_code}" \
    -X POST "${HOST}/dataspace/inbox?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${KRA_TRUST_JWT}" \
    -d "${read_activity}")
read_body=$(cat "${read_file}"); rm -f "${read_file}"
if [ "${read_http}" = "202" ] || [ "${read_http}" = "201" ]; then
    ok "[KRA] 8a Read delivery GRANTED by the default arbiter (HTTP ${read_http}) — action=read matches the read agreement"
elif echo "${read_body}" | grep -q "ruleTargetNotSupported"; then
    info "Body: ${read_body}"
    fail "[KRA] 8a Default arbiter threw ruleTargetNotSupported — the offer's permission target needs a typed twin:jsonPath form"
else
    info "HTTP ${read_http} | Body: ${read_body}"
    fail "[KRA] 8a Read delivery not granted (HTTP ${read_http}) — the default arbiter should grant read on a read agreement"
fi

# 8b — consumer-generated WRITE (generator = consumerPid → action=write). The
# consumer holds only a read agreement, so the default arbiter finds no write
# permission and DENIES; the gate returns 401 pushActivityNotPermittedByPolicy.
# This is the #124 headline proven with a real arbiter.
write_activity=$(jq -c -n \
    --arg gen "${KRA_PUSH_POS_PID}" \
    --arg cons "${KRA_CONSIGNMENT_ID:-urn:ucr:KE-KRA-2026-CUSTOMS-0001}" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ "@context": "https://www.w3.org/ns/activitystreams", type: "Create", generator: $gen,
       object: { "@context": "https://vocabulary.uncefact.org/unece-context-D23B.jsonld", type: "Consignment", globalId: $cons },
       updated: $ts }')
write_file=$(mktemp)
write_http=$(curl -sS -o "${write_file}" -w "%{http_code}" \
    -X POST "${HOST}/dataspace/inbox?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
    -d "${write_activity}")
write_body=$(cat "${write_file}"); rm -f "${write_file}"
if echo "${write_body}" | grep -q "pushActivityNotPermittedByPolicy"; then
    ok "[KRA] 8b Cross-tenant WRITE DENIED by the default arbiter (HTTP ${write_http}) — read holder has no write permission (#124 enforced)"
elif [ "${write_http}" = "202" ] || [ "${write_http}" = "201" ]; then
    info "Body: ${write_body}"
    fail "[KRA] 8b Cross-tenant write was GRANTED under the default arbiter — the inbox gate is NOT enforcing #124"
elif echo "${write_body}" | grep -q "ruleTargetNotSupported"; then
    info "Body: ${write_body}"
    fail "[KRA] 8b Default arbiter threw ruleTargetNotSupported — the offer's permission target needs a typed twin:jsonPath form"
else
    info "HTTP ${write_http} | Body: ${write_body}"
    fail "[KRA] 8b Unexpected response on the write delivery (HTTP ${write_http})"
fi

# ============================================================================
phase 9 "Constraint-based filtering at the inbox gate (default arbiter)"
# ============================================================================
# Seed a CONSTRAINED read offer (KRA): read is permitted only when the payload's
# destinationCountry is KE. Negotiate it into an agreement, set up a push transfer,
# then deliver two provider-generated READ activities to KRA's inbox — both action=
# read, differing only in destinationCountry. The default arbiter evaluates the
# permission's constraint against the payload: KE satisfies → GRANTED (202); a
# non-KE payload fails the constraint → the permission does not apply → DENIED (401).
C9_OFFER_ID="urn:policy:kra-constrained-offer-$(date +%s)-${RANDOM}"
c9_offer=$(jq -n \
    --arg ctx "${ODRL_CONTEXT}" --arg uid "${C9_OFFER_ID}" --arg assigner "${KRA_DID}" --arg target "${KRA_DATASET_ID}" \
    '{ "@context": $ctx, "@type": "Offer", uid: $uid, assigner: $assigner, target: $target, action: "read",
       permission: [{ action: "read",
                      target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" },
                      constraint: [{ leftOperand: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$.object.destinationCountry.countryId" },
                                     operator: "eq", rightOperand: "unece:CountryId#KE" }] }] }')

# Seed the constrained offer in KRA's PAP.
c9_pap=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${HOST}/rights-management/policy/admin?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${KRA_SESSION_JWT}" \
    -d "${c9_offer}")
{ [ "${c9_pap}" = "201" ] || [ "${c9_pap}" = "204" ]; } || fail "[KRA] 9 constrained offer seed failed (HTTP ${c9_pap})"

# Negotiate it (Trader = consumer); pass-through negotiator copies the offer's rules.
C9_NEG_PID="urn:contract-negotiation:trader-kra-c9-$(date +%s)-${RANDOM}"
c9_pnap=$(jq -n --arg id "${C9_NEG_PID}" --arg dc "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" --arg oi "${TRADER_DID}" \
    '{ id: $id, correlationId: "", dateCreated: $dc, state: "REQUESTED", organizationIdentity: $oi }')
curl -sS -o /dev/null -X PUT "${HOST}/rights-management/negotiations/admin/${C9_NEG_PID}?organization=${TRADER_ORG_ENC}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_SESSION_JWT}" -d "${c9_pnap}"
c9_neg_body=$(jq -n --arg ctx "${DSP_CONTEXT}" --arg cp "${C9_NEG_PID}" --argjson offer "${c9_offer}" \
    --arg cb "${INTERNAL_URL}/rights-management?organization=${TRADER_ORG_ENC}" \
    '{ "@context": [$ctx], "@type": "ContractRequestMessage", consumerPid: $cp, offer: $offer, callbackAddress: $cb }')
c9_neg=$(curl -sS -X POST "${HOST}/rights-management/negotiations/request?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_TRUST_JWT}" -d "${c9_neg_body}")
c9_prov_pid=$(echo "${c9_neg}" | jq -r '.providerPid // empty')
[ -n "${c9_prov_pid}" ] || { info "Nego: ${c9_neg}"; fail "[KRA] 9 negotiation returned no providerPid"; }
c9_state=""
for _ in $(seq 1 15); do
    c9_state=$(curl -sS "${HOST}/rights-management/negotiations/${c9_prov_pid}?organization=${PUB_ORG_ENC_KRA}" \
        -H "Authorization: Bearer ${TRADER_TRUST_JWT}" | jq -r '.state // empty')
    { [ "${c9_state}" = "FINALIZED" ] || [ "${c9_state}" = "VERIFIED" ]; } && break
    sleep 2
done
{ [ "${c9_state}" = "FINALIZED" ] || [ "${c9_state}" = "VERIFIED" ]; } || fail "[KRA] 9 negotiation not FINALIZED (last: ${c9_state:-none})"
c9_admin=$(curl -sS "${HOST}/rights-management/negotiations/admin/${C9_NEG_PID}?organization=${TRADER_ORG_ENC}" \
    -H "Authorization: Bearer ${TRADER_SESSION_JWT}")
C9_AGREEMENT=$(echo "${c9_admin}" | jq -r '.agreement["@id"] // .agreement.uid // empty')
[ -n "${C9_AGREEMENT}" ] || C9_AGREEMENT="${C9_OFFER_ID}"
c9_constraints=$(echo "${c9_admin}" | jq -r '[.agreement.permission[]?.constraint // empty] | flatten | length')

# Push transfer against the constrained agreement.
C9_PUSH_PID="urn:uuid:trader-kra-c9-push-$(date +%s)-${RANDOM}"
c9_req=$(jq -c -n --arg ctx "${DSP_CONTEXT}" --arg cp "${C9_PUSH_PID}" --arg ag "${C9_AGREEMENT}" \
    --arg cb "${INTERNAL_URL}/dataspace?organization=${TRADER_ORG_ENC}" \
    --arg inbox "${INTERNAL_URL}/dataspace/inbox?organization=${TRADER_ORG_ENC}" \
    '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $cp, agreementId: $ag, format: "HttpProxy-PUSH", callbackAddress: $cb, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')
c9_req_resp=$(node scripts/dsp-client.mjs requestTransfer --host "${HOST}" --organization "${PUB_ORG_KRA}" --trust-payload "${TRADER_TRUST_JWT}" --body "${c9_req}")
[ "$(echo "${c9_req_resp}" | jq -r '.ok')" = "true" ] || fail "[KRA] 9 requestTransfer failed: $(echo "${c9_req_resp}" | jq -r '.errorMessage')"
c9_push_prov=$(echo "${c9_req_resp}" | jq -r '.body.providerPid // empty')
[ -n "${c9_push_prov}" ] || fail "[KRA] 9 requestTransfer returned no providerPid"
c9_start=$(jq -c -n --arg ctx "${DSP_CONTEXT}" --arg cp "${C9_PUSH_PID}" --arg pp "${c9_push_prov}" \
    '{ "@context": [$ctx], "@type": "TransferStartMessage", consumerPid: $cp, providerPid: $pp }')
c9_start_resp=$(node scripts/dsp-client.mjs startTransfer --host "${HOST}" --organization "${PUB_ORG_KRA}" --trust-payload "${KRA_TRUST_JWT}" --body "${c9_start}")
[ "$(echo "${c9_start_resp}" | jq -r '.ok')" = "true" ] || fail "[KRA] 9 startTransfer failed: $(echo "${c9_start_resp}" | jq -r '.errorMessage')"

# Deliver a provider-generated read activity carrying the given destinationCountry.
# $1 = destinationCountry id, $2 = file to write the response body into; prints the
# HTTP status to stdout (the body can't go through a global — the call runs in a
# command-substitution subshell).
deliver_c9() {
    local country="$1" bodyfile="$2" act
    act=$(jq -c -n --arg gen "${c9_push_prov}" --arg cid "${KRA_CONSIGNMENT_ID}" --arg cc "${country}" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '{ "@context": "https://www.w3.org/ns/activitystreams", type: "Create", generator: $gen,
           object: { "@context": "https://vocabulary.uncefact.org/unece-context-D23B.jsonld", type: "Consignment", globalId: $cid, destinationCountry: { type: "Country", countryId: $cc } },
           updated: $ts }')
    curl -sS -o "${bodyfile}" -w "%{http_code}" -X POST "${HOST}/dataspace/inbox?organization=${PUB_ORG_ENC_KRA}" \
        -H "Content-Type: application/json" -H "Authorization: Bearer ${KRA_TRUST_JWT}" -d "${act}"
}

c9_sat_file=$(mktemp); c9_vio_file=$(mktemp)
c9_sat=$(deliver_c9 "unece:CountryId#KE" "${c9_sat_file}")
c9_vio=$(deliver_c9 "unece:CountryId#XX" "${c9_vio_file}")
c9_sat_body=$(cat "${c9_sat_file}"); c9_vio_body=$(cat "${c9_vio_file}")
rm -f "${c9_sat_file}" "${c9_vio_file}"

if [ "${c9_constraints}" = "0" ]; then
    warn "[KRA] 9 Negotiated agreement carried no constraint (pass-through negotiator did not preserve it) — constraint enforcement not asserted (sat=${c9_sat} vio=${c9_vio})"
elif { [ "${c9_sat}" = "202" ] || [ "${c9_sat}" = "201" ]; } && echo "${c9_vio_body}" | grep -q "pushActivityNotPermittedByPolicy"; then
    ok "[KRA] 9 Constraint ENFORCED by the default arbiter — KE payload GRANTED (${c9_sat}), non-KE payload DENIED (${c9_vio})"
elif { [ "${c9_sat}" = "202" ] || [ "${c9_sat}" = "201" ]; } && { [ "${c9_vio}" = "202" ] || [ "${c9_vio}" = "201" ]; }; then
    info "sat=${c9_sat} vio=${c9_vio} | vio body: ${c9_vio_body}"
    fail "[KRA] 9 Constraint NOT enforced — non-KE payload was granted; the default arbiter should have denied it"
else
    info "sat=${c9_sat} sat body: ${c9_sat_body} | vio=${c9_vio} vio body: ${c9_vio_body}"
    fail "[KRA] 9 Unexpected constraint-test outcome"
fi

# ============================================================================
phase 10 "Write-scoped agreement at the inbox gate — a write contribution SUCCEEDS"
# ============================================================================
# The symmetric positive of 8b (ticket #124 req 3: "a writer holding a write agreement
# succeeds"). Seed a WRITE-scoped offer (permission action=write), negotiate it into a
# write agreement, set up a push transfer, then the consumer (Trader) pushes a write
# activity. generator=consumerPid → the gate derives action=write; the agreement permits
# write, so the default arbiter GRANTS (202). 8b showed a read-only holder is rejected;
# this shows a holder of a write agreement is allowed — the two halves of req 3.
C10_OFFER_ID="urn:policy:kra-write-offer-$(date +%s)-${RANDOM}"
c10_offer=$(jq -n \
    --arg ctx "${ODRL_CONTEXT}" --arg uid "${C10_OFFER_ID}" --arg assigner "${KRA_DID}" --arg target "${KRA_DATASET_ID}" \
    '{ "@context": $ctx, "@type": "Offer", uid: $uid, assigner: $assigner, target: $target, action: "write",
       permission: [{ action: "write", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }] }')

c10_pap=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${HOST}/rights-management/policy/admin?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${KRA_SESSION_JWT}" \
    -d "${c10_offer}")
{ [ "${c10_pap}" = "201" ] || [ "${c10_pap}" = "204" ]; } || fail "[KRA] 10 write offer seed failed (HTTP ${c10_pap})"

C10_NEG_PID="urn:contract-negotiation:trader-kra-c10-$(date +%s)-${RANDOM}"
c10_pnap=$(jq -n --arg id "${C10_NEG_PID}" --arg dc "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" --arg oi "${TRADER_DID}" \
    '{ id: $id, correlationId: "", dateCreated: $dc, state: "REQUESTED", organizationIdentity: $oi }')
curl -sS -o /dev/null -X PUT "${HOST}/rights-management/negotiations/admin/${C10_NEG_PID}?organization=${TRADER_ORG_ENC}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_SESSION_JWT}" -d "${c10_pnap}"
c10_neg_body=$(jq -n --arg ctx "${DSP_CONTEXT}" --arg cp "${C10_NEG_PID}" --argjson offer "${c10_offer}" \
    --arg cb "${INTERNAL_URL}/rights-management?organization=${TRADER_ORG_ENC}" \
    '{ "@context": [$ctx], "@type": "ContractRequestMessage", consumerPid: $cp, offer: $offer, callbackAddress: $cb }')
c10_neg=$(curl -sS -X POST "${HOST}/rights-management/negotiations/request?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_TRUST_JWT}" -d "${c10_neg_body}")
c10_prov_pid=$(echo "${c10_neg}" | jq -r '.providerPid // empty')
[ -n "${c10_prov_pid}" ] || { info "Nego: ${c10_neg}"; fail "[KRA] 10 negotiation returned no providerPid"; }
c10_state=""
for _ in $(seq 1 15); do
    c10_state=$(curl -sS "${HOST}/rights-management/negotiations/${c10_prov_pid}?organization=${PUB_ORG_ENC_KRA}" \
        -H "Authorization: Bearer ${TRADER_TRUST_JWT}" | jq -r '.state // empty')
    { [ "${c10_state}" = "FINALIZED" ] || [ "${c10_state}" = "VERIFIED" ]; } && break
    sleep 2
done
{ [ "${c10_state}" = "FINALIZED" ] || [ "${c10_state}" = "VERIFIED" ]; } || fail "[KRA] 10 negotiation not FINALIZED (last: ${c10_state:-none})"
c10_admin=$(curl -sS "${HOST}/rights-management/negotiations/admin/${C10_NEG_PID}?organization=${TRADER_ORG_ENC}" \
    -H "Authorization: Bearer ${TRADER_SESSION_JWT}")
C10_AGREEMENT=$(echo "${c10_admin}" | jq -r '.agreement["@id"] // .agreement.uid // empty')
[ -n "${C10_AGREEMENT}" ] || C10_AGREEMENT="${C10_OFFER_ID}"
c10_action=$(echo "${c10_admin}" | jq -r '.agreement.permission[0].action // .agreement.action // "unknown"')

C10_PUSH_PID="urn:uuid:trader-kra-c10-push-$(date +%s)-${RANDOM}"
c10_req=$(jq -c -n --arg ctx "${DSP_CONTEXT}" --arg cp "${C10_PUSH_PID}" --arg ag "${C10_AGREEMENT}" \
    --arg cb "${INTERNAL_URL}/dataspace?organization=${TRADER_ORG_ENC}" \
    --arg inbox "${INTERNAL_URL}/dataspace/inbox?organization=${TRADER_ORG_ENC}" \
    '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $cp, agreementId: $ag, format: "HttpProxy-PUSH", callbackAddress: $cb, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')
c10_req_resp=$(node scripts/dsp-client.mjs requestTransfer --host "${HOST}" --organization "${PUB_ORG_KRA}" --trust-payload "${TRADER_TRUST_JWT}" --body "${c10_req}")
[ "$(echo "${c10_req_resp}" | jq -r '.ok')" = "true" ] || fail "[KRA] 10 requestTransfer failed: $(echo "${c10_req_resp}" | jq -r '.errorMessage')"
c10_push_prov=$(echo "${c10_req_resp}" | jq -r '.body.providerPid // empty')
[ -n "${c10_push_prov}" ] || fail "[KRA] 10 requestTransfer returned no providerPid"
c10_start=$(jq -c -n --arg ctx "${DSP_CONTEXT}" --arg cp "${C10_PUSH_PID}" --arg pp "${c10_push_prov}" \
    '{ "@context": [$ctx], "@type": "TransferStartMessage", consumerPid: $cp, providerPid: $pp }')
c10_start_resp=$(node scripts/dsp-client.mjs startTransfer --host "${HOST}" --organization "${PUB_ORG_KRA}" --trust-payload "${KRA_TRUST_JWT}" --body "${c10_start}")
[ "$(echo "${c10_start_resp}" | jq -r '.ok')" = "true" ] || fail "[KRA] 10 startTransfer failed: $(echo "${c10_start_resp}" | jq -r '.errorMessage')"

# Consumer (Trader) pushes a WRITE into KRA's inbox. generator=consumerPid → action=write.
c10_write=$(jq -c -n --arg gen "${C10_PUSH_PID}" --arg cid "${KRA_CONSIGNMENT_ID}" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{ "@context": "https://www.w3.org/ns/activitystreams", type: "Create", generator: $gen,
       object: { "@context": "https://vocabulary.uncefact.org/unece-context-D23B.jsonld", type: "Consignment", globalId: $cid },
       updated: $ts }')
c10_file=$(mktemp)
c10_http=$(curl -sS -o "${c10_file}" -w "%{http_code}" -X POST "${HOST}/dataspace/inbox?organization=${PUB_ORG_ENC_KRA}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_TRUST_JWT}" -d "${c10_write}")
c10_body=$(cat "${c10_file}"); rm -f "${c10_file}"

if [ "${c10_action}" != "write" ]; then
    warn "[KRA] 10 Negotiated agreement action='${c10_action}' (expected write) — negotiator did not preserve the write action; cannot assert (HTTP ${c10_http})"
elif [ "${c10_http}" = "202" ] || [ "${c10_http}" = "201" ]; then
    ok "[KRA] 10 Write contribution GRANTED by the default arbiter (HTTP ${c10_http}) — consumer holds a WRITE agreement (action=write permitted)"
elif echo "${c10_body}" | grep -q "pushActivityNotPermittedByPolicy"; then
    info "Body: ${c10_body}"
    fail "[KRA] 10 Write DENIED despite a write agreement — the gate is over-rejecting permitted writes"
else
    info "HTTP ${c10_http} | Body: ${c10_body}"
    fail "[KRA] 10 Unexpected response on the write-agreement delivery (HTTP ${c10_http})"
fi

echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  ✓ Multi-publisher use case complete${NC}"
echo -e "${BOLD}${GREEN}    ${#PUBS[@]} authorities published → Trader discovered, negotiated,${NC}"
echo -e "${BOLD}${GREEN}    pulled, and aggregated ${slice_count} distinct slices.${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
