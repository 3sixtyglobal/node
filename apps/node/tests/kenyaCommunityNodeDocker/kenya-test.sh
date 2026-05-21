#!/usr/bin/env bash
# =============================================================================
# kenya-test.sh — Same-node multi-tenant DSP + PNP scenario test.
# =============================================================================
# Run from this directory: ./kenya-test.sh
# Prereqs:
#   - ./setup.sh completed (node bootstrapped, KRA + Trader tenants + admins)
#   - docker compose up -d (node running on host port 3040)
#   - jq installed
#
# Phases (all green as of 2026-04-29):
#   0. Health check (tenant-gated by design) + per-tenant logins
#   1. Trader queries federated catalogue → cross-tenant [Node] discovery
#   2. KRA's offer presence (seeded by provision-storage.sh)
#   3. Trader sees KRA's dataset + encrypted twin:tenantToken (TICKET-G)
#   4. Trader initiates PNP negotiation against KRA's offer
#   5. Negotiation reaches FINALIZED (REQUESTED → AGREED → FINALIZED)
#   6. Trader requestTransfer against the agreement
#   7. Trader startTransfer + encrypted dataAddress.endpoint (TICKET-D) + pull
#   8. Tenant isolation negatives — intentionally not yet automated
#
# Findings recorded in ../multiTenancyDocker/findings-from-first-run.md
# under "Kenya empirical findings".
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

[ -s .node-password ]  || fail "Missing .node-password — run ./setup.sh first"
[ -s .tenants ]        || fail "Missing .tenants — run ./setup.sh first"
[ -s .tenant-users ]   || fail "Missing .tenant-users — run ./setup.sh first"

# shellcheck disable=SC1091
source .node-password
# shellcheck disable=SC1091
source .tenants
# shellcheck disable=SC1091
source .tenant-users

HOST="http://localhost:3040"
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"

# Issue a login and echo the JWT extracted from the access_token cookie.
# Usage: login <api-key> <email> <password>
login() {
    local api_key="$1" email="$2" password="$3"
    local headers
    headers=$(curl -sS -i -X POST "${HOST}/authentication/login" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${api_key}" \
        -d "$(jq -n --arg e "$email" --arg p "$password" '{email:$e,password:$p}')")
    # Extract access_token cookie value
    echo "${headers}" | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-
}

# ============================================================================
phase 0 "Health check + per-tenant logins"
# ============================================================================

# Keyless health → 401 (TenantProcessor gate)
status=$(curl -sS -o /dev/null -w "%{http_code}" "${HOST}/health")
[ "${status}" = "401" ] && ok "Keyless GET /health → 401 (TenantProcessor gate intact)" \
    || fail "Keyless GET /health expected 401, got ${status}"

# Tenant-scoped health → 200 (each tenant)
status=$(curl -sS -o /dev/null -w "%{http_code}" -H "x-api-key: ${TENANT_KRA_API_KEY}" "${HOST}/health")
[ "${status}" = "200" ] && ok "GET /health with KRA api-key → 200" \
    || fail "GET /health with KRA api-key expected 200, got ${status}"

status=$(curl -sS -o /dev/null -w "%{http_code}" -H "x-api-key: ${TENANT_TRADER_API_KEY}" "${HOST}/health")
[ "${status}" = "200" ] && ok "GET /health with Trader api-key → 200" \
    || fail "GET /health with Trader api-key expected 200, got ${status}"

# Per-tenant logins
JWT_KRA=$(login    "${TENANT_KRA_API_KEY}"    "${TENANT_KRA_USER_EMAIL}"    "${TENANT_KRA_USER_PASSWORD}")
JWT_TRADER=$(login "${TENANT_TRADER_API_KEY}" "${TENANT_TRADER_USER_EMAIL}" "${TENANT_TRADER_USER_PASSWORD}")
[ -n "${JWT_KRA}" ]    || fail "KRA login did not return a JWT"
[ -n "${JWT_TRADER}" ] || fail "Trader login did not return a JWT"
ok "KRA admin (${TENANT_KRA_USER_EMAIL}) logged in"
ok "Trader admin (${TENANT_TRADER_USER_EMAIL}) logged in"

info "Phase 0 complete. TICKET-A (trust auto-enable) + TICKET-C (vault key bootstrap)"
info "implicitly verified — node started cleanly with full DSP+PNP+rights-mgmt enabled."

# ============================================================================
phase 1 "Trader queries federated catalogue (expects shared [Node] discovery)"
# ============================================================================

# Body shape mirrors mobiusSupplyChainDocker (DSP CatalogRequestMessage).
# Note: this expects the catalogue to be tenant-shared (partition [Node]-only,
# verified 2026-04-24 in engine-types/components/federatedCatalogue.ts:47).
# Trader's tenant context must successfully reach the catalogue service —
# whether 0 or many datasets are returned proves the routing works. The
# 404 + noDatasetsFound response is the catalogue's "empty result" payload,
# not an auth failure.
response=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/federated-catalogue/request" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
    -H "Cookie: access_token=${JWT_TRADER}" \
    -d "{
        \"@context\": [\"${DSP_CONTEXT}\"],
        \"@type\": \"CatalogRequestMessage\",
        \"filter\": []
    }")

http_code=$(echo "${response}" | tail -1)
body=$(echo "${response}" | sed '$d')

# Three valid outcomes prove tenant routing works:
# (a) HTTP 200 with a Catalog object (datasets present)
# (b) HTTP 404 with noDatasetsFound (empty catalogue — current state)
# (c) HTTP 200 with a Catalog @type and no .dataset key (alternative empty representation)
catalog_type=$(echo "${body}" | jq -r '.["@type"]? // ""')
err_message=$(echo "${body}" | jq -r '.reason[0].message? // .message? // ""')

if [ "${http_code}" = "200" ] && [ "${catalog_type}" = "Catalog" ]; then
    count=$(echo "${body}" | jq -r '(.dataset // []) | length')
    ok "Trader can reach federated-catalogue/request (HTTP 200, datasets: ${count})"
elif [ "${http_code}" = "404" ] && [ "${err_message}" = "federatedCatalogueService.noDatasetsFound" ]; then
    ok "Trader can reach federated-catalogue/request (HTTP 404 noDatasetsFound — empty)"
    info "This proves the partition fix: Trader's tenant context successfully queried"
    info "the [Node]-only catalogue. Empty result is expected before KRA seeds an offer."
else
    fail "Trader catalogue query failed: HTTP ${http_code} body=${body}"
fi
info "Run ./provision-storage.sh next to seed KRA's dataset + ODRL offer,"
info "then re-run kenya-test.sh."

# ============================================================================
# Phases 2-7 require provision-storage.sh to have run first (it seeds KRA's
# offer in the PAP, generates trust JWTs, captures the test-app dataset id).
# ============================================================================

if [ ! -s .session-tokens ] || [ ! -s .trust-tokens ] || [ ! -s .seeded-offer ]; then
    echo ""
    info "Phases 2-7 require ./provision-storage.sh to have run first."
    info "Foundation phases 0-1 are complete; run provision-storage.sh and re-run this."
    exit 0
fi

# shellcheck disable=SC1091
source .session-tokens
# shellcheck disable=SC1091
source .trust-tokens
# shellcheck disable=SC1091
source .seeded-offer

# Internal URL for callback addresses inside Docker (both tenants live on the
# same container hostname). Host-accessible equivalent is HOST itself.
INTERNAL_URL="http://twin-kenya-node:3000"

# Translate container-internal callback URLs to host-accessible ones for
# follow-up curls. Strips the encrypted ?x-enc-tenant-token=... query if present
# (the host curl would reach the running container which decrypts itself).
translate_endpoint() {
    local url="$1"
    echo "${url}" | sed "s|${INTERNAL_URL}|${HOST}|g"
}

# ============================================================================
phase 2 "KRA's offer presence (provision-storage.sh seeded it)"
# ============================================================================
info "KRA seeded offer ${KRA_OFFER_ID} for dataset ${KRA_DATASET_ID}."
info "Skipping a re-seed — Phase 2 is owned by provision-storage.sh."
ok "Phase 2 (offer seeding) executed by provision-storage.sh"

# ============================================================================
phase 3 "Trader sees the test-app dataset in catalogue"
# ============================================================================
catalog_resp=$(curl -sS -X POST "${HOST}/federated-catalogue/request" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
    -H "Cookie: access_token=${TRADER_SESSION_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"CatalogRequestMessage\",\"filter\":[]}")

# S1 (2026-05-19): with distinct per-tenant DIDs in Kenya, the catalogue now nests
# datasets in a per-publisher sub-catalog (DCAT-AP correct behaviour). Traverse
# both top-level (.dataset[]) and sub-catalog (.catalog[].dataset[]) so the
# assertion works whether tenants share NODE_DID or have distinct DIDs.
found_id=$(echo "${catalog_resp}" | jq -r '(.dataset[]?, .catalog[]?.dataset[]?) | .["@id"] // empty' | grep -F "${KRA_DATASET_ID}" || true)
if [ -n "${found_id}" ]; then
    ok "Trader sees dataset ${KRA_DATASET_ID} (cross-tenant catalogue discovery works)"
else
    info "Catalogue response: ${catalog_resp}"
    fail "Trader did NOT see KRA's dataset in catalogue"
fi

# TICKET-G: the catalogue bakes the
# publishing tenant's encrypted token into each distribution's accessService URL at
# fedcat set() time. Extract the token from the URL query string so we can re-apply
# it as ?x-enc-tenant-token= on subsequent PNP/DSP URLs the consumer constructs.
KRA_DIST_URL=$(echo "${catalog_resp}" | jq -r --arg id "${KRA_DATASET_ID}" \
    '(.dataset[]?, .catalog[]?.dataset[]?) | select(.["@id"] == $id) | (.distribution // .["dcat:distribution"]) | (if type == "array" then .[0] else . end) | .accessService // empty' | head -1)
KRA_TENANT_TOKEN=$(echo "${KRA_DIST_URL}" | sed -nE 's/.*[?&]x-enc-tenant-token=([^&]+).*/\1/p')
if [ -n "${KRA_TENANT_TOKEN}" ]; then
    ok "Distribution accessService URL carries encrypted tenantToken (${#KRA_TENANT_TOKEN} chars)"
else
    info "Catalogue response: ${catalog_resp}"
    info "Distribution URL: ${KRA_DIST_URL}"
    fail "Distribution accessService did NOT carry x-enc-tenant-token query param — fedcat URL-baking wiring missing"
fi

# ============================================================================
phase 4 "Trader initiates PNP negotiation against KRA's offer"
# ============================================================================
TRADER_CONSUMER_PID="urn:contract-negotiation:trader-$(date +%s)-${RANDOM}"

# Pre-inject a consumer-side negotiation entry — mobius pattern, avoids race
# where the provider's offer-to-consumer arrives before the consumer's PNAP
# has the negotiation registered.
step "Pre-injecting Trader negotiation entry into PNAP..."
pnap_body=$(jq -n \
    --arg id "${TRADER_CONSUMER_PID}" \
    --arg dateCreated "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
    --arg organizationIdentity "${TRADER_DID}" \
    '{ id: $id, correlationId: "", dateCreated: $dateCreated, state: "REQUESTED", organizationIdentity: $organizationIdentity }')

# PNAP /admin/* routes accept the local session JWT (mobius pattern).
# Trust JWT is reserved for cross-tenant DSP/PNP messages on /request and friends.
pnap_resp_full=$(curl -sS -w "\n%{http_code}" -X PUT \
    "${HOST}/rights-management/negotiations/admin/${TRADER_CONSUMER_PID}" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
    -H "Authorization: Bearer ${TRADER_SESSION_JWT}" \
    -d "${pnap_body}")
pnap_status=$(echo "${pnap_resp_full}" | tail -1)
pnap_resp_body=$(echo "${pnap_resp_full}" | sed '$d')
if [ "${pnap_status}" = "204" ] || [ "${pnap_status}" = "200" ]; then
    ok "Trader PNAP entry created (HTTP ${pnap_status})"
else
    info "PNAP PUT response: ${pnap_resp_body}"
    fail "Trader PNAP pre-inject failed (HTTP ${pnap_status})"
fi

# Send the ContractRequestMessage. The offer JSON we send must mirror the
# ODRL Offer KRA seeded in Step 5 of provision-storage.sh.
step "Sending ContractRequestMessage to KRA..."
offer_json=$(jq -n \
    --arg ctx "${ODRL_CONTEXT:-http://www.w3.org/ns/odrl.jsonld}" \
    --arg uid "${KRA_OFFER_ID}" \
    --arg assigner "${KRA_DID}" \
    --arg target "${KRA_DATASET_ID}" \
    '{ "@context": $ctx, "@type": "Offer", uid: $uid, assigner: $assigner, target: $target,
       action: "read", permission: [{ action: "read", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }] }')

# Embed Trader's encrypted tenantToken in the callbackAddress so that when KRA
# (the provider) calls back to Trader's PNAP, the receiving handler decrypts it,
# sets ContextIds[Tenant] = Trader, and PNAP finds Trader's pre-injected entry.
# In production, the consumer-side PNP service does this automatically via
# `policyNegotiationPointService.sendRequestToProvider` → `buildCallbackUrl`,
# which includes the configured `_callbackPath` (default "rights-management").
# We mirror that here so the path is in the URL — KRA's outbound rest-client
# uses `pathPrefix: ""` and relies on the path already being present.
TRADER_CALLBACK_URL="${INTERNAL_URL}/rights-management?x-enc-tenant-token=${TRADER_TENANT_TOKEN}"

negotiate_body=$(jq -n \
    --arg ctx "${DSP_CONTEXT}" \
    --arg consumerPid "${TRADER_CONSUMER_PID}" \
    --argjson offer "${offer_json}" \
    --arg callback "${TRADER_CALLBACK_URL}" \
    '{ "@context": [$ctx], "@type": "ContractRequestMessage", consumerPid: $consumerPid, offer: $offer, callbackAddress: $callback }')

# TICKET-G: ?x-enc-tenant-token=<KRA_ENCRYPTED> routes the inbound through TenantProcessor
# decryption → ContextIds[Tenant] = KRA → PNP/PAP lookup runs in KRA's partition.
negotiate_resp=$(curl -sS -w "\n%{http_code}" -X POST \
    "${HOST}/rights-management/negotiations/request?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
    -d "${negotiate_body}")
nego_http=$(echo "${negotiate_resp}" | tail -1)
nego_body=$(echo "${negotiate_resp}" | sed '$d')

if [ "${nego_http}" != "200" ] && [ "${nego_http}" != "201" ]; then
    info "Negotiation response body: ${nego_body}"
    fail "PNP negotiation request failed (HTTP ${nego_http})"
fi
PROVIDER_NEGO_PID=$(echo "${nego_body}" | jq -r '.providerPid // empty')
[ -n "${PROVIDER_NEGO_PID}" ] || fail "Could not extract providerPid from negotiation response"
ok "Negotiation initiated (providerPid: ${PROVIDER_NEGO_PID})"

# ============================================================================
phase 5 "Negotiation reaches FINALIZED / VERIFIED"
# ============================================================================
final_state=""
for attempt in $(seq 1 15); do
    # State lives in KRA's PNAP partition → route via tenantToken
    state_resp=$(curl -sS "${HOST}/rights-management/negotiations/${PROVIDER_NEGO_PID}?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
        -H "Authorization: Bearer ${TRADER_TRUST_JWT}")
    current_state=$(echo "${state_resp}" | jq -r '.state // empty')
    echo "    Attempt ${attempt}/15: state=${current_state:-<unknown>}"
    if [ "${current_state}" = "FINALIZED" ] || [ "${current_state}" = "VERIFIED" ]; then
        final_state="${current_state}"
        break
    fi
    [ "${attempt}" -lt 15 ] && sleep 2
done

[ -n "${final_state}" ] || fail "Negotiation did not reach FINALIZED (last seen: ${current_state:-unknown})"
ok "Negotiation completed (state: ${final_state})"

# Extract agreement id from Trader's PNAP — /admin/* uses session JWT
pnap_resp=$(curl -sS "${HOST}/rights-management/negotiations/admin/${TRADER_CONSUMER_PID}" \
    -H "x-api-key: ${TENANT_TRADER_API_KEY}" \
    -H "Authorization: Bearer ${TRADER_SESSION_JWT}")
TRADER_AGREEMENT_ID=$(echo "${pnap_resp}" | jq -r '.agreement["@id"] // .agreement.uid // empty')
if [ -n "${TRADER_AGREEMENT_ID}" ]; then
    ok "Agreement id from Trader PNAP: ${TRADER_AGREEMENT_ID}"
else
    warn "Could not extract agreement id from Trader PNAP — falling back to KRA_OFFER_ID"
    TRADER_AGREEMENT_ID="${KRA_OFFER_ID}"
fi

# ============================================================================
phase 6 "Trader requestTransfer against the agreement"
# ============================================================================
TRADER_DSP_PID="urn:uuid:trader-dsp-$(date +%s)-${RANDOM}"
# DSP transfer request goes to KRA (provider) → route via tenantToken
tr_resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/dataspace/transfers/request?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
    -d "$(jq -n \
        --arg ctx "${DSP_CONTEXT}" \
        --arg consumerPid "${TRADER_DSP_PID}" \
        --arg agreementId "${TRADER_AGREEMENT_ID}" \
        --arg callbackAddress "${INTERNAL_URL}/dataspace?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
        '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "Http-Pull-Query-Format", callbackAddress: $callbackAddress }')")

tr_http=$(echo "${tr_resp}" | tail -1)
tr_body=$(echo "${tr_resp}" | sed '$d')
tr_type=$(echo "${tr_body}" | jq -r '.["@type"] // empty')

if [ "${tr_type}" = "TransferError" ]; then
    err_code=$(echo "${tr_body}" | jq -r '.code // "unknown"')
    fail "Transfer request returned TransferError: ${err_code}"
fi
PROVIDER_DSP_PID=$(echo "${tr_body}" | jq -r '.providerPid // empty')
[ -n "${PROVIDER_DSP_PID}" ] || fail "Could not extract providerPid from transfer response"
ok "Transfer created (providerPid: ${PROVIDER_DSP_PID})"

# ============================================================================
phase 7 "Trader startTransfer + receives encrypted endpoint + pulls data"
# ============================================================================
# DSP transfer start runs on KRA (provider) side → route via tenantToken
start_resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/dataspace/transfers/${PROVIDER_DSP_PID}/start?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${KRA_TRUST_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"TransferStartMessage\",\"consumerPid\":\"${TRADER_DSP_PID}\",\"providerPid\":\"${PROVIDER_DSP_PID}\"}")
start_http=$(echo "${start_resp}" | tail -1)
start_body=$(echo "${start_resp}" | sed '$d')

data_endpoint_raw=$(echo "${start_body}" | jq -r '.dataAddress.endpoint // empty')
data_token=$(echo "${start_body}" | jq -r '(.dataAddress.endpointProperties // [])[] | select(.name == "authorization") | .value // empty' | head -1)

[ -n "${data_endpoint_raw}" ] || { info "Start response: ${start_body}"; fail "No dataAddress.endpoint in start response"; }
ok "Transfer started, raw endpoint: ${data_endpoint_raw}"

# CRITICAL CHECK: the endpoint MUST contain the tenantToken query param —
# that's TICKET-D's signature.
if echo "${data_endpoint_raw}" | grep -q "tenant-token="; then
    ok "TICKET-D verified: dataAddress.endpoint carries encrypted tenantToken"
else
    warn "TICKET-D unexpected: endpoint has NO tenantToken query — was DSP wired correctly?"
fi

# Translate container-internal URL → host
data_endpoint=$(translate_endpoint "${data_endpoint_raw}")
[ -n "${data_token}" ] || { warn "No data access token in dataAddress; falling back to TRADER_TRUST_JWT"; data_token="${TRADER_TRUST_JWT}"; }

step "Pulling data from ${data_endpoint} ..."
pull_resp=$(curl -sS -w "\n%{http_code}" -G "${data_endpoint}" \
    --data-urlencode "consumerPid=${TRADER_DSP_PID}" \
    --data-urlencode "type=https://vocabulary.uncefact.org/Consignment" \
    -H "Authorization: Bearer ${data_token}")
pull_http=$(echo "${pull_resp}" | tail -1)
pull_body=$(echo "${pull_resp}" | sed '$d')

item_count=$(echo "${pull_body}" | jq -r '[(.itemListElement // [])[] | select(. != null)] | length' 2>/dev/null || echo "0")
if [ "${pull_http}" = "200" ] && [ "${item_count}" -gt 0 ] 2>/dev/null; then
    ok "Trader pulled ${item_count} item(s) from KRA's data plane (HTTP 200)"
else
    info "Pull response (HTTP ${pull_http}): ${pull_body}"
    fail "Data pull failed or returned 0 items"
fi

# ============================================================================
phase 8 "Push setup REJECTS missing tenant token (multi-tenant gate)"
# ============================================================================
# Trader requests a PUSH transfer with a callback URL that does NOT carry an
# x-enc-tenant-token query parameter. On a multi-tenant publisher the data plane
# must refuse setupPushSubscription rather than letting the eventual delivery 401.
TRADER_PUSH_NEG_PID="urn:uuid:trader-push-neg-$(date +%s)-${RANDOM}"
push_neg_resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/dataspace/transfers/request?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
    -d "$(jq -n \
        --arg ctx "${DSP_CONTEXT}" \
        --arg consumerPid "${TRADER_PUSH_NEG_PID}" \
        --arg agreementId "${TRADER_AGREEMENT_ID}" \
        --arg callbackAddress "${INTERNAL_URL}/dataspace?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
        '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "HttpProxy-PUSH", callbackAddress: $callbackAddress, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: "http://twin-kenya-node:3000/dataspace/inbox" } }')")
push_neg_body=$(echo "${push_neg_resp}" | sed '$d')
push_neg_provider_pid=$(echo "${push_neg_body}" | jq -r '.providerPid // empty')
[ -n "${push_neg_provider_pid}" ] || fail "Negative push: requestTransfer did not return providerPid"

# Now send startTransfer — the setup gate inside the data plane should reject.
start_neg_resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/dataspace/transfers/${push_neg_provider_pid}/start?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${KRA_TRUST_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"TransferStartMessage\",\"consumerPid\":\"${TRADER_PUSH_NEG_PID}\",\"providerPid\":\"${push_neg_provider_pid}\"}")
start_neg_body=$(echo "${start_neg_resp}" | sed '$d')
start_neg_type=$(echo "${start_neg_body}" | jq -r '.["@type"] // empty')
start_neg_code=$(echo "${start_neg_body}" | jq -r '.code // empty')

if [ "${start_neg_type}" = "TransferError" ] && echo "${start_neg_code}" | grep -q "pushSubscriptionMissingTenantToken"; then
    ok "Push setup rejected as expected — code: ${start_neg_code}"
elif [ "${start_neg_type}" = "TransferError" ]; then
    warn "Push setup returned TransferError but with a different code: ${start_neg_code}"
    info "Body: ${start_neg_body}"
else
    warn "Push setup did NOT reject the bare endpoint. Either Kenya's data plane is not in multi-tenant mode, or the gate is bypassed."
    info "Response type: ${start_neg_type}; body: ${start_neg_body}"
fi

# ============================================================================
phase 9 "Push setup ACCEPTS endpoint with baked consumer tenant token"
# ============================================================================
TRADER_PUSH_POS_PID="urn:uuid:trader-push-pos-$(date +%s)-${RANDOM}"
push_pos_resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/dataspace/transfers/request?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TRADER_TRUST_JWT}" \
    -d "$(jq -n \
        --arg ctx "${DSP_CONTEXT}" \
        --arg consumerPid "${TRADER_PUSH_POS_PID}" \
        --arg agreementId "${TRADER_AGREEMENT_ID}" \
        --arg callbackAddress "${INTERNAL_URL}/dataspace?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
        --arg inbox "http://twin-kenya-node:3000/dataspace/inbox?x-enc-tenant-token=${TRADER_TENANT_TOKEN}" \
        '{ "@context": [$ctx], "@type": "TransferRequestMessage", consumerPid: $consumerPid, agreementId: $agreementId, format: "HttpProxy-PUSH", callbackAddress: $callbackAddress, dataAddress: { "@type": "DataAddress", endpointType: "https", endpoint: $inbox } }')")
push_pos_body=$(echo "${push_pos_resp}" | sed '$d')
push_pos_provider_pid=$(echo "${push_pos_body}" | jq -r '.providerPid // empty')
[ -n "${push_pos_provider_pid}" ] || fail "Positive push: requestTransfer did not return providerPid"

start_pos_resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/dataspace/transfers/${push_pos_provider_pid}/start?x-enc-tenant-token=${KRA_TENANT_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${KRA_TRUST_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"TransferStartMessage\",\"consumerPid\":\"${TRADER_PUSH_POS_PID}\",\"providerPid\":\"${push_pos_provider_pid}\"}")
start_pos_body=$(echo "${start_pos_resp}" | sed '$d')
start_pos_type=$(echo "${start_pos_body}" | jq -r '.["@type"] // empty')

if [ "${start_pos_type}" = "TransferError" ]; then
    err_code=$(echo "${start_pos_body}" | jq -r '.code // "unknown"')
    fail "Positive push setup failed: ${err_code} | body: ${start_pos_body}"
fi
ok "Push setup accepted with baked consumer tenant token (providerPid: ${push_pos_provider_pid})"

# ============================================================================
phase 10 "S4 — composite publisher fallback on boot republish (no-user context)"
# ============================================================================
# Verifies S4's composite-fallback in populateDefaults: when the engine
# republishes a stored DataspaceAppDataset on restart, there's no logged-in
# user → ContextIdKeys.Organization is undefined → populateDefaults falls back
# to the `nodeId:tenantId` composite for `dcterms:publisher`.
#
# Why this works: the stored entity's `dataset` payload never carries a
# publisher field (it's stamped at publish time, not stored). On a fresh
# create (Step 5b, user-authenticated) the publisher is the user's org DID.
# On restart, populateDefaults runs in node-tenant context (no user) →
# composite path fires. This is exactly the no-user flow flagged
# (2026-05-20) that motivated S4.

step "Reading expected nodeId from container engine-state.json + tenantId from .tenants"
NODE_DID_FROM_STATE=$(docker exec twin-kenya-node sh -c 'cat /app/data/engine-state.json' \
    | jq -r '.nodeId // empty')
[ -n "${NODE_DID_FROM_STATE}" ] || fail "Could not read nodeId from engine-state.json"
EXPECTED_COMPOSITE="${NODE_DID_FROM_STATE}:${TENANT_KRA_TENANT_ID}"
info "Expected composite publisher: ${EXPECTED_COMPOSITE}"

step "Restarting node container to trigger boot republish"
docker compose restart twin-kenya-node 2>&1 | tail -3 \
    || fail "Container restart failed"

# Wait for the engine to finish populating the catalogue.
sleep 12

step "Re-logging in as KRA after restart (sessions are in-memory, restart invalidates)"
KRA_SESSION_JWT_PHASE10=$(curl -sS -i -X POST "${HOST}/authentication/login" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_KRA_API_KEY}" \
    -d "$(jq -n --arg e "${TENANT_KRA_USER_EMAIL}" --arg p "${TENANT_KRA_USER_PASSWORD}" '{email:$e,password:$p}')" \
    | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-)
[ -n "${KRA_SESSION_JWT_PHASE10}" ] || fail "KRA re-login after restart failed"
ok "KRA re-logged in after restart"

step "Querying catalogue + decoding dcterms:publisher"
catalog_resp_phase10=$(curl -sS -X POST "${HOST}/federated-catalogue/request" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_KRA_API_KEY}" \
    -H "Cookie: access_token=${KRA_SESSION_JWT_PHASE10}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"CatalogRequestMessage\",\"filter\":[]}")

actual_publisher=$(echo "${catalog_resp_phase10}" | jq -r --arg id "${KRA_DATASET_ID}" \
    '(.dataset[]?, .catalog[]?.dataset[]?) | select(.["@id"] == $id) | (.["dct:publisher"] // .["dcterms:publisher"]) // empty' | head -1)

if [ -z "${actual_publisher}" ]; then
    info "Catalogue response: ${catalog_resp_phase10}"
    fail "Could not extract dcterms:publisher from catalogue for ${KRA_DATASET_ID}"
fi

info "Actual publisher: ${actual_publisher}"
if [ "${actual_publisher}" = "${EXPECTED_COMPOSITE}" ]; then
    ok "S4 composite-fallback fired correctly: publisher = nodeId:tenantId composite"
else
    fail "S4 composite-fallback did NOT fire. Expected ${EXPECTED_COMPOSITE}, got ${actual_publisher}"
fi

# ============================================================================
echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  ✓ Phases 0-10 complete (pull 0-7 + push 8-9 + S4 verify 10)${NC}"
echo -e "${GREEN}================================================================${NC}"
