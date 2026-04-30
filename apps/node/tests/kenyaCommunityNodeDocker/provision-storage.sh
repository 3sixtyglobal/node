#!/usr/bin/env bash
# =============================================================================
# provision-storage.sh — Seed KRA's ODRL offer + write trust tokens used by
# kenya-test.sh phases 3+.
# =============================================================================
# Run from this directory: ./provision-storage.sh
# Prereqs:
#   - ./setup.sh completed
#   - docker compose up -d
#   - kenya-test.sh foundation phases (0-1) green
#
# Steps:
#   1. Read node DID and tenant IDs from container state.
#   2. Log in as admin@kra → session JWT.
#   3. Generate KRA's trust JWT (cross-tenant Bearer for PAP/PNP/DSP).
#   4. Verify the test-app published its dataset to the federated catalogue
#      (catalogue is [Node]-only partitioned, so we query as KRA's session).
#   5. Seed an ODRL offer in KRA's PAP that targets the test-app's dataset.
#   6. Log in as admin@trader → session JWT + trust JWT, written for the test.
#
# Outputs (used by kenya-test.sh):
#   .session-tokens   — KRA_SESSION_JWT, TRADER_SESSION_JWT
#   .trust-tokens     — KRA_TRUST_JWT, TRADER_TRUST_JWT
#   .seeded-offer     — KRA_OFFER_ID, KRA_DATASET_ID, KRA_DID, TRADER_DID
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
ODRL_CONTEXT="http://www.w3.org/ns/odrl.jsonld"
TRUST_VM_ID="trust-assertion"

# -----------------------------------------------------------------------------
# Step 1: Read node DID from container state.
# -----------------------------------------------------------------------------
echo -e "${BOLD}Step 1: Read node identity from engine state${NC}"
NODE_STATE=$(docker compose run --rm -T --no-deps twin-kenya-node \
    sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
NODE_DID=$(echo "${NODE_STATE}" | jq -r '.nodeId // empty')
[ -n "${NODE_DID}" ] || fail "Could not read nodeId from engine-state.json"
ok "Node DID: ${NODE_DID}"

# -----------------------------------------------------------------------------
# login_session(): POST /authentication/login → echo session JWT cookie value.
# -----------------------------------------------------------------------------
login_session() {
    local api_key="$1" email="$2" password="$3"
    curl -sS -i -X POST "${HOST}/authentication/login" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${api_key}" \
        -d "$(jq -n --arg e "$email" --arg p "$password" '{email:$e,password:$p}')" \
        | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-
}

# generate_trust_jwt(): POST /identity/:did/verifiable-credential/:vmId
# → returns the .jwt field, suitable as Authorization: Bearer for PAP/PNP/DSP.
generate_trust_jwt() {
    local api_key="$1" session_jwt="$2" did="$3" subject="$4"
    local resp
    resp=$(curl -sS -X POST "${HOST}/identity/${did}/verifiable-credential/${TRUST_VM_ID}" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${api_key}" \
        -H "Cookie: access_token=${session_jwt}" \
        -d "$(jq -n --arg s "$subject" '{subject:{id:$s}}')")
    echo "${resp}" | jq -r '.jwt // empty'
}

# -----------------------------------------------------------------------------
# Step 2: Log in as KRA + Trader.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Per-tenant logins${NC}"
KRA_SESSION_JWT=$(login_session    "${TENANT_KRA_API_KEY}"    "${TENANT_KRA_USER_EMAIL}"    "${TENANT_KRA_USER_PASSWORD}")
TRADER_SESSION_JWT=$(login_session "${TENANT_TRADER_API_KEY}" "${TENANT_TRADER_USER_EMAIL}" "${TENANT_TRADER_USER_PASSWORD}")
[ -n "${KRA_SESSION_JWT}" ]    || fail "KRA login did not return a JWT"
[ -n "${TRADER_SESSION_JWT}" ] || fail "Trader login did not return a JWT"
ok "KRA session JWT  (${#KRA_SESSION_JWT} chars)"
ok "Trader session JWT (${#TRADER_SESSION_JWT} chars)"

# Both per-tenant users were created with --user-identity=NODE_DID and
# --organization-identity=NODE_DID (mt-test pattern, see setup.sh comment).
# So both KRA's and Trader's organization identity is the node DID for now.
KRA_DID="${NODE_DID}"
TRADER_DID="${NODE_DID}"

# -----------------------------------------------------------------------------
# Step 3: Generate trust JWTs.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Generate trust JWTs (cross-tenant Bearer tokens)${NC}"
KRA_TRUST_JWT=$(generate_trust_jwt    "${TENANT_KRA_API_KEY}"    "${KRA_SESSION_JWT}"    "${KRA_DID}"    "urn:trust:kra-kenya-node")
TRADER_TRUST_JWT=$(generate_trust_jwt "${TENANT_TRADER_API_KEY}" "${TRADER_SESSION_JWT}" "${TRADER_DID}" "urn:trust:trader-kenya-node")
[ -n "${KRA_TRUST_JWT}" ]    || fail "Could not generate KRA trust JWT"
[ -n "${TRADER_TRUST_JWT}" ] || fail "Could not generate Trader trust JWT"
ok "KRA trust JWT  (${#KRA_TRUST_JWT} chars)"
ok "Trader trust JWT (${#TRADER_TRUST_JWT} chars)"

# -----------------------------------------------------------------------------
# Step 4: Verify the test-app dataset is in the catalogue. test-app publishes
# at DSP startup with @id "https://twin.example.org/data-service-1" (see
# dataspace-test-app/src/testDataspaceDataPlaneApp.ts:163).
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Verify test-app dataset is in federated catalogue${NC}"
CATALOG_RESP=$(curl -sS -X POST "${HOST}/federated-catalogue/request" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_KRA_API_KEY}" \
    -H "Cookie: access_token=${KRA_SESSION_JWT}" \
    -d "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"CatalogRequestMessage\",\"filter\":[]}")

DATASET_COUNT=$(echo "${CATALOG_RESP}" | jq -r '(.dataset // []) | length // 0')
KRA_DATASET_ID=$(echo "${CATALOG_RESP}" | jq -r '.dataset[0]["@id"] // empty')

if [ -z "${KRA_DATASET_ID}" ]; then
    warn "Catalogue still empty — dataspace-test-app may not be loaded."
    info "Confirm TWIN_EXTENSIONS=\"@twin.org/dataspace-test-app\" is in env/node.env"
    info "and that the node was rebuilt (./setup.sh --clean) after adding it."
    info "Catalogue response: ${CATALOG_RESP}"
    fail "No dataset found"
fi
ok "Catalogue has ${DATASET_COUNT} dataset(s); using \"${KRA_DATASET_ID}\""

# -----------------------------------------------------------------------------
# Step 5: KRA seeds an ODRL Offer in their PAP for that dataset. Mirrors the
# mobius pattern (build_offer_json, seed_offer in mobius-test.sh) but without
# refinement constraints — minimal viable Kenya cut. PIN filtering can be
# added as a follow-up phase once the negotiation+transfer flow proves out.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5: KRA seeds ODRL offer in PAP${NC}"
KRA_OFFER_ID="urn:policy:kra-offer-$(date +%s)"

OFFER_BODY=$(jq -n \
    --arg ctx "${ODRL_CONTEXT}" \
    --arg uid "${KRA_OFFER_ID}" \
    --arg assigner "${KRA_DID}" \
    --arg target "${KRA_DATASET_ID}" \
    '{
        "@context": $ctx,
        "@type": "Offer",
        uid: $uid,
        assigner: $assigner,
        target: $target,
        action: "read",
        permission: [{ action: "read", target: "twin:jsonpath:$" }]
    }')

# PAP admin endpoints accept the local session JWT (signed with auth-signing key).
# Mobius uses the session token here (mobius-test.sh `seed_offer`), not the trust
# JWT — which is reserved for cross-tenant DSP/PNP message authentication.
#
# CAVEAT (documented in findings.md as TICKET-G test alignment): the
# dataspace-test-app publishes its Consignment dataset to the catalogue from
# inside the engine startup — which runs in the NODE tenant context. So the
# catalogue's stored `tenantId` for that dataset is NODE_TENANT_ID, not
# KRA_TENANT_ID. TICKET-G's `twin:tenantToken` in the catalogue response
# therefore decrypts back to NODE, not to KRA. KRA's offer (seeded below)
# lives in KRA's PAP partition — Trader's tenantToken-routed negotiate
# request will reach NODE's PAP and not find KRA's offer.
#
# Phases 0-3 fully verify TICKET-G's mechanism (catalogue emits the token,
# Trader can read it). Phases 4+ surface the next gap: catalogue publishing
# needs to honour a per-tenant publishing context (TICKET-G+1).
PAP_RESP=$(curl -sS -i -X POST "${HOST}/rights-management/policy/admin" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_KRA_API_KEY}" \
    -H "Authorization: Bearer ${KRA_SESSION_JWT}" \
    -d "${OFFER_BODY}" || true)

PAP_STATUS=$(echo "${PAP_RESP}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
if [ "${PAP_STATUS}" != "201" ] && [ "${PAP_STATUS}" != "204" ]; then
    info "PAP response: ${PAP_RESP}"
    fail "PAP offer seed failed (HTTP ${PAP_STATUS})"
fi
ok "Offer ${KRA_OFFER_ID} seeded in KRA's PAP (HTTP ${PAP_STATUS})"

# -----------------------------------------------------------------------------
# Step 5b (test scaffold workaround): Re-tag the test-app's dataset entity in
# the catalogue so its `tenantId` field points at KRA. The test-app publishes
# the Consignment dataset from inside the engine startup, which runs in the
# Node tenant context — so without this step the catalogue's `twin:tenantToken`
# would route Trader's negotiation request back to the Node tenant rather than
# KRA, and PAP (partitioned by [Node, Tenant]) wouldn't find KRA's offer.
#
# Federated catalogue dataset storage is [Node]-only partitioned, so we only
# need to flip the `tenantId` field — no partitionId change required. In a
# real Kenya deployment, KRA's own dataspace app would publish the dataset in
# KRA's tenant context (TICKET-G+1 follow-up: per-tenant publishing).
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5b: Re-tag dataset tenantId to KRA (test scaffold workaround)${NC}"
docker exec twin-kenya-node node -e "
const fs = require('fs');
const path = '/app/data/dataset/store.json';
const store = JSON.parse(fs.readFileSync(path, 'utf8'));
const target = '${KRA_DATASET_ID}';
const kraTenantId = '${TENANT_KRA_TENANT_ID}';
let patched = 0;
for (const entry of store) {
    if (entry.id === target) {
        entry.tenantId = kraTenantId;
        patched++;
    }
}
fs.writeFileSync(path, JSON.stringify(store, null, '\t'));
console.log('patched=' + patched);
" || fail "Dataset re-tag failed"
ok "Dataset ${KRA_DATASET_ID} re-tagged with tenantId=${TENANT_KRA_TENANT_ID}"

# -----------------------------------------------------------------------------
# Step 5c (test scaffold workaround): Mint an encrypted tenantToken for Trader
# by directly invoking the same ChaCha20Poly1305 encryption the platform's
# `EntityStorageVaultConnector.encrypt()` does, against the vault key entity
# stored at `/app/data/vault-key/store.json`.
#
# Why this is here: in production, the consumer-side PNP service would build
# its own `callbackAddress` via `policyNegotiationPointService.sendRequestToProvider`,
# which calls `buildCallbackUrl(publicOrigin, ContextIds[Tenant])` and embeds
# the encrypted tenantToken automatically. The Kenya test uses curl directly to
# craft the ContractRequestMessage, bypassing that platform path — so we mint
# the token here and inject it into kenya-test.sh's `callbackAddress`. Pure
# test plumbing; no platform change.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5c: Mint Trader's encrypted tenantToken (test scaffold workaround)${NC}"
TRADER_TENANT_TOKEN=$(docker exec twin-kenya-node node -e "
const fs = require('fs');
const { ChaCha20Poly1305 } = require('@twin.org/crypto');
const { Converter, RandomHelper } = require('@twin.org/core');

const store = JSON.parse(fs.readFileSync('/app/data/vault-key/store.json', 'utf8'));
const fullKeyName = '${KRA_DID}/tenant-token-encryption';
const vaultKey = store.find(e => e.id === fullKeyName);
if (!vaultKey) {
    console.error('Vault key not found:', fullKeyName);
    process.exit(1);
}

const privateKey = Converter.base64ToBytes(vaultKey.privateKey);
const nonce = RandomHelper.generate(12);
const cipher = new ChaCha20Poly1305(privateKey, nonce);
const payload = cipher.encrypt(Converter.utf8ToBytes('${TENANT_TRADER_TENANT_ID}'));
const encrypted = new Uint8Array(nonce.length + payload.length);
encrypted.set(nonce);
encrypted.set(payload, nonce.length);
process.stdout.write(Converter.bytesToBase64Url(encrypted));
") || fail "Trader tenantToken mint failed"
if [ -z "${TRADER_TENANT_TOKEN}" ]; then
    fail "Empty TRADER_TENANT_TOKEN"
fi
ok "Minted Trader tenantToken (${#TRADER_TENANT_TOKEN} chars)"

# -----------------------------------------------------------------------------
# Step 6: Persist tokens + ids for kenya-test.sh.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 6: Persist tokens for kenya-test.sh${NC}"
{
    printf 'KRA_SESSION_JWT=%q\n'    "${KRA_SESSION_JWT}"
    printf 'TRADER_SESSION_JWT=%q\n' "${TRADER_SESSION_JWT}"
} > .session-tokens

{
    printf 'KRA_TRUST_JWT=%q\n'    "${KRA_TRUST_JWT}"
    printf 'TRADER_TRUST_JWT=%q\n' "${TRADER_TRUST_JWT}"
} > .trust-tokens

{
    printf 'KRA_DID=%q\n'              "${KRA_DID}"
    printf 'TRADER_DID=%q\n'           "${TRADER_DID}"
    printf 'KRA_DATASET_ID=%q\n'       "${KRA_DATASET_ID}"
    printf 'KRA_OFFER_ID=%q\n'         "${KRA_OFFER_ID}"
    printf 'TRADER_TENANT_TOKEN=%q\n'  "${TRADER_TENANT_TOKEN}"
} > .seeded-offer

ok ".session-tokens, .trust-tokens, .seeded-offer written"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Provision complete${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
echo "  KRA DID:        ${KRA_DID}"
echo "  Dataset ID:     ${KRA_DATASET_ID}"
echo "  Offer ID:       ${KRA_OFFER_ID}"
echo ""
echo -e "${BOLD}Next:${NC}"
echo "  ./kenya-test.sh   # runs phases 0-7 end-to-end"
