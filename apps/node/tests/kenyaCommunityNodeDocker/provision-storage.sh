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
# Step 4: The catalogue starts empty — there's no static `datasetsHandled` to
# pre-populate it. The dataset id is hard-coded here and KRA registers a
# matching partial in Step 5b which inline-publishes it via fedcat.set in
# KRA's tenant context.
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Pin dataset id (catalogue starts empty until Step 5b)${NC}"
KRA_DATASET_ID="https://twin.example.org/data-service-1"
ok "Dataset id pinned: \"${KRA_DATASET_ID}\""

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
# Step 5b: Register a dataset under KRA's tenant context.
#
# The Control Plane's POST /dataspace/datasets route persists the dataset
# record AND inline-publishes it via fedcat.set() wrapped in
# ContextIdStore.run({Tenant: KRA}). fedcat then captures tenantId = KRA on
# the Dataset entity and the URL transformer bakes the correct KRA-tenant
# token into the distribution's accessService URL.
#
# This replaces the previous disk-level re-tag workaround (which only patched
# the entity's tenantId field but left the URL-baked token pointing at the
# wrong tenant).
# -----------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5b: Register a dataset as KRA tenant${NC}"

# The dataspace-test-app's static datasetsHandled() also publishes the same
# @id at engine startup (in the Node tenant context). Phase B of the Control
# Plane's start() loop replays partials AFTER Phase A's legacy publish — and
# the partial CRUD route inline-publishes on create — so the KRA-tenant
# version always wins. The shape mirrors the test-app's static dataset.
DATASET_BODY=$(jq -n \
    --arg datasetCtx "${DSP_CONTEXT}" \
    --arg dsId "${KRA_DATASET_ID}" \
    --arg appId "https://twin.example.org/app1" \
    --arg assigner "${KRA_DID}" \
    '{
        appId: $appId,
        dataset: {
            "@context": [$datasetCtx, { dcterms: "http://purl.org/dc/terms/" }],
            "@id": $dsId,
            "@type": "Dataset",
            hasPolicy: [{
                "@id": "urn:policy:kra-dataset-offer",
                "@type": "Offer",
                assigner: $assigner,
                permission: [{ action: "read" }]
            }],
            distribution: [{
                "@id": "https://twin.example.org/distribution-1",
                "@type": "Distribution",
                accessService: $dsId,
                format: "Http-Pull-Query-Format"
            }],
            "dcterms:type": "https://vocabulary.uncefact.org/Consignment"
        }
    }')

DATASET_RESP=$(curl -sS -i -X POST "${HOST}/dataspace/datasets" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TENANT_KRA_API_KEY}" \
    -H "Authorization: Bearer ${KRA_SESSION_JWT}" \
    -d "${DATASET_BODY}" || true)

DATASET_STATUS=$(echo "${DATASET_RESP}" | grep -i '^HTTP/' | tail -1 | awk '{print $2}')
if [ "${DATASET_STATUS}" != "201" ] && [ "${DATASET_STATUS}" != "204" ]; then
    info "Dataset response: ${DATASET_RESP}"
    fail "Dataset registration failed (HTTP ${DATASET_STATUS})"
fi
ok "Dataset registered for ${KRA_DATASET_ID} as KRA (HTTP ${DATASET_STATUS})"

# -----------------------------------------------------------------------------
# Sanity check: confirm the catalogue's URL-baked tenant token now decrypts
# to KRA's tenant id (it used to decrypt to the Node tenant — see findings).
# -----------------------------------------------------------------------------
DATASET_FILE="/app/data/dataset/store.json"
RECAPTURED_TENANT=$(docker exec twin-kenya-node node -e "
const fs = require('fs');
const store = JSON.parse(fs.readFileSync('${DATASET_FILE}', 'utf8'));
const target = '${KRA_DATASET_ID}';
const entry = store.find(e => e.id === target);
process.stdout.write(entry?.tenantId ?? '');
" 2>/dev/null || true)

if [ "${RECAPTURED_TENANT}" = "${TENANT_KRA_TENANT_ID}" ]; then
    ok "Catalogue dataset.tenantId now equals KRA (${TENANT_KRA_TENANT_ID})"
else
    info "Recaptured tenantId: \"${RECAPTURED_TENANT}\""
    info "Expected:            \"${TENANT_KRA_TENANT_ID}\""
    fail "Partial-publish did not retag dataset.tenantId — partial-dataset wiring may be broken"
fi

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
const fullKeyName = '${KRA_DID}/param-encryption';
const vaultKey = store.find(e => e.id === fullKeyName);
if (!vaultKey) {
    console.error('Vault key not found:', fullKeyName);
    process.exit(1);
}

const privateKey = Converter.base64ToBytes(vaultKey.privateKey);
// HostingService.encryptParam prepends an 8-byte salt to the plaintext before
// encrypting (defence-in-depth against rainbow tables). decryptParam strips
// the first 8 bytes of the decrypted output. Mirror that so vault.decrypt
// + slice(8) on the receiving side recovers the original tenant id.
const salt = RandomHelper.generate(8);
const tenantBytes = Converter.utf8ToBytes('${TENANT_TRADER_TENANT_ID}');
const plaintext = new Uint8Array(salt.length + tenantBytes.length);
plaintext.set(salt);
plaintext.set(tenantBytes, salt.length);
const nonce = RandomHelper.generate(12);
const cipher = new ChaCha20Poly1305(privateKey, nonce);
const payload = cipher.encrypt(plaintext);
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
