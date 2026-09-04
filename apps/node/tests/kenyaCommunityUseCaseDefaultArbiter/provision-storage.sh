#!/usr/bin/env bash
# =============================================================================
# provision-storage.sh — Seed the four publisher authorities' ODRL offers +
# datasets, and write the tokens/ids used by kenya-usecase-test.sh.
# =============================================================================
# Run from this directory: ./provision-storage.sh
# Prereqs:
#   - ./setup.sh completed (5 tenants: KRA, KPA, KENTRADE, AFA, Trader)
#   - docker compose up -d
#
# Model (publish-and-aggregate): each authority publishes its OWN dataset into
# the shared [Node] catalogue, in its own tenant context, with an ODRL offer in
# its own PAP. Each dataset maps to the dataspace-test-app (appId app1); the
# test app serves the 4-consignment superset (consignments.json) filtered by the
# `id` the consumer requests on pull. So publisher X's dataset, when pulled with
# `?id=<X consignment>`, returns X's distinct slice. The consumer (Trader)
# discovers all four, negotiates + pulls each, and aggregates locally.
#
# Steps:
#   1. Read node DID from container state.
#   2. For each publisher (KRA, KPA, KENTRADE, AFA): login → trust JWT → seed
#      ODRL offer (PAP) → register dataset (tenant-context publish to fedcat) →
#      sanity-check the catalogue organizationIdentity.
#   3. Login Trader → session + trust JWT. (Post-#203 there is no encrypted
#      tenantToken to mint — callbacks route via ?organization=<org-did>.)
#   4. Persist tokens/ids.
#
# Post-#203 (organization identifiers): non-login routes are tenant-routed by
# the ?organization=<org-did> query param (the tenant's org DID minted in
# setup.sh), NOT by x-api-key. x-api-key only routes /login.
#
# Outputs (used by kenya-usecase-test.sh):
#   .session-tokens   — <PUB>_SESSION_JWT for all 5 tenants
#   .trust-tokens     — <PUB>_TRUST_JWT for all 5 tenants
#   .publishers       — per publisher: <PUB>_DID, <PUB>_DATASET_ID,
#                       <PUB>_OFFER_ID, <PUB>_CONSIGNMENT_ID; plus TRADER_DID,
#                       PUBLISHERS list
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

[ -s .node-password ]      || fail "Missing .node-password — run ./setup.sh first"
[ -s .tenants ]            || fail "Missing .tenants — run ./setup.sh first"
[ -s .tenant-users ]       || fail "Missing .tenant-users — run ./setup.sh first"
[ -s .tenant-identities ]  || fail "Missing .tenant-identities — run ./setup.sh first"

# shellcheck disable=SC1091
source .node-password
# shellcheck disable=SC1091
source .tenants
# shellcheck disable=SC1091
source .tenant-users
# shellcheck disable=SC1091
source .tenant-identities

HOST="http://localhost:3042"
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"
ODRL_CONTEXT="http://www.w3.org/ns/odrl.jsonld"
TRUST_VM_ID="trust-assertion"

# Publisher → consignment id mapping. bash 3.2 (macOS default) has no
# associative arrays, so this is a case function. The consignment ids MUST match
# the `id` fields in consignments.json (served by the test app). The consumer
# pulls each publisher's dataset scoped by `?id=<consignment id>`.
consignment_for() {
    case "$1" in
        KRA)      echo "urn:ucr:KE-KRA-2026-CUSTOMS-0001" ;;
        KPA)      echo "urn:ucr:KE-KPA-2026-PORT-0002" ;;
        KENTRADE) echo "urn:ucr:KE-KENTRADE-2026-PERMIT-0003" ;;
        AFA)      echo "urn:ucr:KE-AFA-2026-PHYTO-0004" ;;
        *)        echo "" ;;
    esac
}
PUBLISHERS=(KRA KPA KENTRADE AFA)

# -----------------------------------------------------------------------------
# Step 1: Read node DID from container state.
# -----------------------------------------------------------------------------
echo -e "${BOLD}Step 1: Read node identity from engine state${NC}"
NODE_STATE=$(docker compose run --rm -T --no-deps twin-kenya-defaultarb-node \
    sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
NODE_DID=$(echo "${NODE_STATE}" | jq -r '.nodeId // empty')
[ -n "${NODE_DID}" ] || fail "Could not read nodeId from engine-state.json"
ok "Node DID: ${NODE_DID}"

# -----------------------------------------------------------------------------
# Helpers (identical to the base Kenya scaffold).
# -----------------------------------------------------------------------------
# URL-encode a value for use in a query string (org DIDs contain ':').
urlenc() { jq -rn --arg v "$1" '$v|@uri'; }

login_session() {
    local api_key="$1" email="$2" password="$3"
    curl -sS -i -X POST "${HOST}/authentication/login" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${api_key}" \
        -d "$(jq -n --arg e "$email" --arg p "$password" '{email:$e,password:$p}')" \
        | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-
}

generate_trust_jwt() {
    local session_jwt="$1" did="$2" subject="$3"
    # Post-#203: non-login routes are tenant-routed by ?organization=<org-did>;
    # here the tenant's org DID is the same DID the VC is issued for.
    local resp
    resp=$(curl -sS -X POST "${HOST}/identity/${did}/verifiable-credential/${TRUST_VM_ID}?organization=$(urlenc "${did}")" \
        -H "Content-Type: application/json" \
        -H "Cookie: access_token=${session_jwt}" \
        -d "$(jq -n --arg s "$subject" '{subject:{id:$s}}')")
    echo "${resp}" | jq -r '.jwt // empty'
}

# -----------------------------------------------------------------------------
# seed_publisher(prefix): login, mint trust JWT, seed ODRL offer in the
# publisher's PAP, register its dataset (published into the catalogue in the
# publisher's tenant context), sanity-check the catalogue tenantId.
#
# Stores per-publisher results as dynamic globals (PUB_SESSION_<PUB> etc.) via
# printf -v — bash 3.2 has no associative arrays.
# -----------------------------------------------------------------------------
seed_publisher() {
    local prefix="$1"
    local label
    label=$(echo "${prefix}" | tr '[:upper:]' '[:lower:]')

    # Indirect expansion of the per-tenant vars produced by setup.sh.
    local api_key_var="TENANT_${prefix}_API_KEY"
    local tenant_id_var="TENANT_${prefix}_TENANT_ID"
    local did_var="TENANT_${prefix}_DID"
    local email_var="TENANT_${prefix}_USER_EMAIL"
    local pass_var="TENANT_${prefix}_USER_PASSWORD"
    local api_key="${!api_key_var}" tenant_id="${!tenant_id_var}" did="${!did_var}"
    local email="${!email_var}" password="${!pass_var}"
    [ -n "${api_key}" ] || fail "${api_key_var} empty — re-run ./setup.sh --clean"
    [ -n "${did}" ]     || fail "${did_var} empty — re-run ./setup.sh --clean"

    local dataset_id="https://twin.example.org/${label}-consignment"
    local consignment_id; consignment_id="$(consignment_for "${prefix}")"
    local offer_id="urn:policy:${label}-offer-$(date +%s)-${RANDOM}"

    step "[${prefix}] login ${email}"
    local session_jwt
    session_jwt=$(login_session "${api_key}" "${email}" "${password}")
    [ -n "${session_jwt}" ] || fail "${prefix} login did not return a JWT"

    step "[${prefix}] generate trust JWT"
    local trust_jwt
    trust_jwt=$(generate_trust_jwt "${session_jwt}" "${did}" "urn:trust:${label}-kenya-node")
    [ -n "${trust_jwt}" ] || fail "Could not generate ${prefix} trust JWT"

    local org_enc
    org_enc=$(urlenc "${did}")

    # ODRL offer targeting this publisher's dataset (pass-through negotiator,
    # read action — the demo proves aggregation, not per-item enforcement).
    step "[${prefix}] seed ODRL offer ${offer_id}"
    local offer_body
    offer_body=$(jq -n \
        --arg ctx "${ODRL_CONTEXT}" \
        --arg uid "${offer_id}" \
        --arg assigner "${did}" \
        --arg target "${dataset_id}" \
        '{
            "@context": $ctx,
            "@type": "Offer",
            uid: $uid,
            assigner: $assigner,
            target: $target,
            action: "read",
            permission: [{ action: "read", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }]
        }')
    local pap_resp pap_status
    pap_resp=$(curl -sS -i -X POST "${HOST}/rights-management/policy/admin?organization=${org_enc}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${session_jwt}" \
        -d "${offer_body}" || true)
    pap_status=$(echo "${pap_resp}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
    if [ "${pap_status}" != "201" ] && [ "${pap_status}" != "204" ]; then
        info "PAP response: ${pap_resp}"
        fail "[${prefix}] PAP offer seed failed (HTTP ${pap_status})"
    fi
    ok "[${prefix}] offer seeded (HTTP ${pap_status})"

    # Register the dataset in the publisher's tenant context → the catalogue
    # captures ownerId = this publisher's org DID and bakes
    # ?organization=<org-did> into the distribution accessService URL
    # (bakeOrganizationIntoDistributions, post-#203).
    step "[${prefix}] register dataset ${dataset_id}"
    local dataset_body
    dataset_body=$(jq -n \
        --arg datasetCtx "${DSP_CONTEXT}" \
        --arg dsId "${dataset_id}" \
        --arg appId "https://twin.example.org/app1" \
        --arg assigner "${did}" \
        '{
            appId: $appId,
            dataset: {
                "@context": [$datasetCtx, { dcterms: "http://purl.org/dc/terms/" }],
                "@id": $dsId,
                "@type": "Dataset",
                "dcterms:publisher": $assigner,
                hasPolicy: [{
                    "@id": ("urn:policy:" + ($dsId | sub("https://twin.example.org/"; "")) + "-offer"),
                    "@type": "Offer",
                    assigner: $assigner,
                    permission: [{ action: "read" }]
                }],
                distribution: [{
                    "@id": ($dsId + "/distribution-1"),
                    "@type": "Distribution",
                    accessService: $dsId,
                    format: "HttpData-PULL"
                }, {
                    "@id": ($dsId + "/distribution-2"),
                    "@type": "Distribution",
                    accessService: $dsId,
                    format: "HttpData-PUSH"
                }],
                "dcterms:type": "https://vocabulary.uncefact.org/Consignment"
            }
        }')
    local dataset_resp dataset_status
    dataset_resp=$(curl -sS -i -X POST "${HOST}/dataspace/app-datasets?organization=${org_enc}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${session_jwt}" \
        -d "${dataset_body}" || true)
    dataset_status=$(echo "${dataset_resp}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
    # 409 = dataset already registered by a previous provision run (same id,
    # same body) — acceptable for idempotent re-runs on a preserved volume.
    if [ "${dataset_status}" != "201" ] && [ "${dataset_status}" != "204" ] && [ "${dataset_status}" != "409" ]; then
        info "Dataset response: ${dataset_resp}"
        fail "[${prefix}] dataset registration failed (HTTP ${dataset_status})"
    fi
    ok "[${prefix}] dataset registered (HTTP ${dataset_status})"

    # Sanity: the stored app-dataset must be owned by the publisher's org
    # (post-#203 DataspaceAppDataset carries organizationIdentity, not a
    # bare nodeIdentity; tenant partition fields are storage-internal).
    local recaptured
    recaptured=$(docker exec twin-kenya-defaultarb-node node -e "
const fs = require('fs');
const store = JSON.parse(fs.readFileSync('/app/data/dataspace-app-dataset/store.json', 'utf8'));
const entry = store.find(e => e.id === '${dataset_id}');
process.stdout.write(JSON.stringify({ organizationIdentity: entry?.organizationIdentity ?? '', tenantId: entry?.tenantId ?? '' }));
" 2>/dev/null || true)
    local recaptured_org recaptured_tenant
    recaptured_org=$(echo "${recaptured}" | jq -r '.organizationIdentity // empty')
    recaptured_tenant=$(echo "${recaptured}" | jq -r '.tenantId // empty')
    if [ "${recaptured_org}" = "${did}" ]; then
        ok "[${prefix}] app-dataset organizationIdentity = ${prefix} org (${did})"
    elif [ "${recaptured_tenant}" = "${tenant_id}" ]; then
        ok "[${prefix}] app-dataset tenant partition = ${prefix} (${tenant_id}); organizationIdentity=\"${recaptured_org}\""
    else
        info "Recaptured: ${recaptured} (expected org ${did} / tenant ${tenant_id})"
        fail "[${prefix}] dataset registration not attributed to this publisher"
    fi

    printf -v "PUB_SESSION_${prefix}" '%s' "${session_jwt}"
    printf -v "PUB_TRUST_${prefix}"   '%s' "${trust_jwt}"
    printf -v "PUB_DID_${prefix}"     '%s' "${did}"
    printf -v "PUB_DATASET_${prefix}" '%s' "${dataset_id}"
    printf -v "PUB_OFFER_${prefix}"   '%s' "${offer_id}"
}

# -----------------------------------------------------------------------------
# Step 2: Seed all four publisher authorities.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Seed publisher authorities (KRA, KPA, KENTRADE, AFA)${NC}"
for pub in "${PUBLISHERS[@]}"; do
    echo ""
    echo -e "${BOLD}--- Publisher: ${pub} ---${NC}"
    seed_publisher "${pub}"
done

# -----------------------------------------------------------------------------
# Step 3: Consumer (Trader) — login + trust JWT.
#
# Post-#203 the old "mint Trader's encrypted tenantToken" scaffold workaround is
# GONE: callback URLs carry ?organization=<trader-org-did> in cleartext and the
# TenantProcessor reverse-maps the org DID to the tenant partition.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Consumer (Trader) login + trust JWT${NC}"
TRADER_DID="${TENANT_TRADER_DID}"
[ -n "${TRADER_DID}" ] || fail "TENANT_TRADER_DID empty — re-run ./setup.sh --clean"
TRADER_SESSION_JWT=$(login_session "${TENANT_TRADER_API_KEY}" "${TENANT_TRADER_USER_EMAIL}" "${TENANT_TRADER_USER_PASSWORD}")
[ -n "${TRADER_SESSION_JWT}" ] || fail "Trader login did not return a JWT"
TRADER_TRUST_JWT=$(generate_trust_jwt "${TRADER_SESSION_JWT}" "${TRADER_DID}" "urn:trust:trader-kenya-node")
[ -n "${TRADER_TRUST_JWT}" ] || fail "Could not generate Trader trust JWT"
ok "Trader session + trust JWT ready"

# -----------------------------------------------------------------------------
# Step 4: Persist tokens + ids for kenya-usecase-test.sh.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Persist tokens + ids${NC}"

: > .session-tokens
: > .trust-tokens
: > .publishers

for pub in "${PUBLISHERS[@]}"; do
    sv="PUB_SESSION_${pub}"; tv="PUB_TRUST_${pub}"; dv="PUB_DID_${pub}"
    dsv="PUB_DATASET_${pub}"; ov="PUB_OFFER_${pub}"
    printf '%s_SESSION_JWT=%q\n'    "${pub}" "${!sv}"  >> .session-tokens
    printf '%s_TRUST_JWT=%q\n'      "${pub}" "${!tv}"  >> .trust-tokens
    {
        printf '%s_DID=%q\n'            "${pub}" "${!dv}"
        printf '%s_DATASET_ID=%q\n'     "${pub}" "${!dsv}"
        printf '%s_OFFER_ID=%q\n'       "${pub}" "${!ov}"
        printf '%s_CONSIGNMENT_ID=%q\n' "${pub}" "$(consignment_for "${pub}")"
    } >> .publishers
done

{
    printf 'TRADER_SESSION_JWT=%q\n' "${TRADER_SESSION_JWT}"
} >> .session-tokens
{
    printf 'TRADER_TRUST_JWT=%q\n' "${TRADER_TRUST_JWT}"
} >> .trust-tokens
{
    printf 'TRADER_DID=%q\n' "${TRADER_DID}"
    printf 'PUBLISHERS=%q\n' "${PUBLISHERS[*]}"
} >> .publishers

ok ".session-tokens, .trust-tokens, .publishers written"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Provision complete — 4 publishers seeded${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
for pub in "${PUBLISHERS[@]}"; do
    dsv="PUB_DATASET_${pub}"
    echo "  ${pub}: dataset=${!dsv}  consignment=$(consignment_for "${pub}")"
done
echo ""
echo -e "${BOLD}Next:${NC}"
echo "  ./kenya-usecase-test.sh   # discover all 4 → negotiate + pull each → aggregate"
