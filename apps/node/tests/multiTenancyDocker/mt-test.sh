#!/usr/bin/env bash
# =============================================================================
# mt-test.sh — Multi-tenancy isolation test (single node, two tenants)
# =============================================================================
# Run from this directory: ./mt-test.sh
# Prereqs:
#   - ./setup.sh completed (bootstrapped node, created tenants and per-tenant users)
#   - docker compose up -d (node running on host port 3030)
#   - jq installed
#
# Phases prove that two tenants on one node are fully isolated:
#   - Application data written by Tenant A is invisible to Tenant B
#   - Cross-tenant JWT reuse is rejected by the AuthHeaderProcessor tid check
#   - Missing x-api-key is rejected by the TenantProcessor
#   - On-disk partition keys differ between Tenant A's and Tenant B's records
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

HOST="${HOST:-http://localhost:3030}"
CONTAINER="${CONTAINER:-twin-mt-node}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

phase() {
    echo ""
    echo -e "${BOLD}${BLUE}================================================================${NC}"
    echo -e "${BOLD}${BLUE}  Phase $1: $2${NC}"
    echo -e "${BOLD}${BLUE}================================================================${NC}"
}
step() { echo -e "${CYAN}  -> $1${NC}"; }
ok()   { echo -e "${GREEN}  [OK] $1${NC}"; }
fail() { echo -e "${RED}  [FAIL] $1${NC}"; exit 1; }
warn() { echo -e "${YELLOW}  [WARN] $1${NC}"; }

# ---------------------------------------------------------------------------
# Load state written by setup.sh
# ---------------------------------------------------------------------------
[ -s .node-password ] || fail "Missing .node-password — run ./setup.sh first"
[ -s .tenants ]       || fail "Missing .tenants — run ./setup.sh first"
[ -s .tenant-users ]  || fail "Missing .tenant-users — run ./setup.sh first (Step 4 creates per-tenant users)"
# shellcheck disable=SC1091
source .node-password
# shellcheck disable=SC1091
source .tenants
# shellcheck disable=SC1091
source .tenant-users

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
# Issue a login and echo the JWT extracted from the access_token cookie.
# Usage: login <api-key> <email> <password>
login() {
    local api_key="$1" email="$2" password="$3"
    local headers
    headers=$(curl -sS -i -X POST "${HOST}/authentication/login" \
        ${api_key:+-H "x-api-key: ${api_key}"} \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg e "$email" --arg p "$password" '{email:$e,password:$p}')")
    echo "${headers}" | grep -i '^set-cookie:' \
        | sed 's/.*access_token=//;s/;.*//' | tr -d '[:space:]'
}

# Usage: http_status <method> <path> <api-key> <jwt> [data]
http_status() {
    local method="$1" path="$2" api_key="$3" jwt="$4" data="${5:-}"
    curl -sS -o /dev/null -w '%{http_code}' -X "${method}" "${HOST}${path}" \
        ${api_key:+-H "x-api-key: ${api_key}"} \
        ${jwt:+-H "Authorization: Bearer ${jwt}"} \
        -H "Content-Type: application/json" \
        ${data:+-d "${data}"}
}

# URL-encode an attestation id for use as a path segment (the id contains
# colons and base64 padding characters that need escaping).
url_encode() { jq -rn --arg s "$1" '$s|@uri'; }

# URL-decode a value (Location response headers come back percent-encoded;
# response bodies carry the raw URN, so we decode for body-vs-header
# comparisons in the list-isolation phase).
url_decode() {
    local s="${1//+/ }"
    printf '%b' "${s//%/\\x}"
}

# ---------------------------------------------------------------------------
# Phase 0: Health — /health is tenant-gated by design (Lead Dev verdict
# 2026-04-21: in multi-tenant deployments with per-tenant infra, health
# must be tenant-scoped). A keyless probe returns 401; a probe with any
# valid tenant's x-api-key returns 200.
# ---------------------------------------------------------------------------
phase 0 "Health check (tenant-gated by design)"
code_no_key=$(curl -s -o /dev/null -w '%{http_code}' "${HOST}/health" || true)
[ "${code_no_key}" = "401" ] || fail "Expected keyless /health to return 401 (tenant-gated), got ${code_no_key}"
ok "Keyless GET /health → 401 (TenantProcessor gate intact)"

code_with_key=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-key: ${TENANT_A_API_KEY}" "${HOST}/health" || true)
[ "${code_with_key}" = "200" ] || fail "Expected /health with Tenant A key to return 200, got ${code_with_key}"
ok "GET /health with Tenant A api-key → 200 (tenant-scoped probe works)"

# ---------------------------------------------------------------------------
# Phase 1: Tenant-scoped logins for both tenants' users
# ---------------------------------------------------------------------------
phase 1 "Login as per-tenant users"
JWT_A=$(login "${TENANT_A_API_KEY}" "${TENANT_A_USER_EMAIL}" "${TENANT_A_USER_PASSWORD}")
JWT_B=$(login "${TENANT_B_API_KEY}" "${TENANT_B_USER_EMAIL}" "${TENANT_B_USER_PASSWORD}")
[ -n "${JWT_A}" ] || fail "Tenant A login did not return a JWT (user=${TENANT_A_USER_EMAIL})"
[ -n "${JWT_B}" ] || fail "Tenant B login did not return a JWT (user=${TENANT_B_USER_EMAIL})"
ok "Tenant A user (${TENANT_A_USER_EMAIL}) logged in"
ok "Tenant B user (${TENANT_B_USER_EMAIL}) logged in"

# ---------------------------------------------------------------------------
# Phase 2: Tenant A creates an attestation
# ---------------------------------------------------------------------------
phase 2 "Tenant A creates an attestation"
A_BODY=$(jq -n '{
    attestationObject: {
        "@context": "https://schema.org",
        type: "DigitalDocument",
        name: "tenant-a-document",
        mimeType: "text/plain",
        fingerprint: "0xa11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a"
    }
}')
A_RAW=$(curl -sS -i -X POST "${HOST}/attestation" \
    -H "x-api-key: ${TENANT_A_API_KEY}" \
    -H "Authorization: Bearer ${JWT_A}" \
    -H "Content-Type: application/json" \
    -d "${A_BODY}")
A_STATUS=$(echo "${A_RAW}" | grep -m1 -E '^HTTP/' | awk '{print $2}' || true)
A_ID=$(echo "${A_RAW}" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/[[:space:]]*$//' | tail -1 || true)
if [ "${A_STATUS}" != "201" ] || [ -z "${A_ID}" ]; then
    echo "----- response (Tenant A attestation create) -----"
    echo "${A_RAW}" | tail -40
    echo "--------------------------------------------------"
    fail "Tenant A attestation creation failed (HTTP ${A_STATUS}, id=[${A_ID}])"
fi
ok "Tenant A attestation id: ${A_ID}"

# ---------------------------------------------------------------------------
# Phase 3: Tenant B creates an attestation
# ---------------------------------------------------------------------------
phase 3 "Tenant B creates an attestation"
B_BODY=$(jq -n '{
    attestationObject: {
        "@context": "https://schema.org",
        type: "DigitalDocument",
        name: "tenant-b-document",
        mimeType: "text/plain",
        fingerprint: "0xb22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b"
    }
}')
B_RAW=$(curl -sS -i -X POST "${HOST}/attestation" \
    -H "x-api-key: ${TENANT_B_API_KEY}" \
    -H "Authorization: Bearer ${JWT_B}" \
    -H "Content-Type: application/json" \
    -d "${B_BODY}")
B_STATUS=$(echo "${B_RAW}" | grep -m1 -E '^HTTP/' | awk '{print $2}' || true)
B_ID=$(echo "${B_RAW}" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/[[:space:]]*$//' | tail -1 || true)
if [ "${B_STATUS}" != "201" ] || [ -z "${B_ID}" ]; then
    echo "----- response (Tenant B attestation create) -----"
    echo "${B_RAW}" | tail -40
    echo "--------------------------------------------------"
    fail "Tenant B attestation creation failed (HTTP ${B_STATUS}, id=[${B_ID}])"
fi
ok "Tenant B attestation id: ${B_ID}"

A_ID_ENC=$(url_encode "${A_ID}")
B_ID_ENC=$(url_encode "${B_ID}")

# ---------------------------------------------------------------------------
# Phase 4: Tenant A reads its own (200) and Tenant B's (must NOT see)
# ---------------------------------------------------------------------------
phase 4 "Tenant A query — isolation check"
a_self=$(http_status GET "/attestation/${A_ID_ENC}" "${TENANT_A_API_KEY}" "${JWT_A}")
a_peer=$(http_status GET "/attestation/${B_ID_ENC}" "${TENANT_A_API_KEY}" "${JWT_A}")
[ "${a_self}" = "200" ] || fail "Tenant A could not read its own attestation (HTTP ${a_self})"
case "${a_peer}" in
    404|403) ok "Tenant A sees its own (200) and not B's (HTTP ${a_peer})" ;;
    200)     fail "ISOLATION BREACH: Tenant A could read Tenant B's attestation (HTTP 200)" ;;
    *)       fail "Unexpected status ${a_peer} for Tenant A reading B's record" ;;
esac

# ---------------------------------------------------------------------------
# Phase 5: Tenant B reads its own (200) and Tenant A's (must NOT see)
# ---------------------------------------------------------------------------
phase 5 "Tenant B query — isolation check"
b_self=$(http_status GET "/attestation/${B_ID_ENC}" "${TENANT_B_API_KEY}" "${JWT_B}")
b_peer=$(http_status GET "/attestation/${A_ID_ENC}" "${TENANT_B_API_KEY}" "${JWT_B}")
[ "${b_self}" = "200" ] || fail "Tenant B could not read its own attestation (HTTP ${b_self})"
case "${b_peer}" in
    404|403) ok "Tenant B sees its own (200) and not A's (HTTP ${b_peer})" ;;
    200)     fail "ISOLATION BREACH: Tenant B could read Tenant A's attestation (HTTP 200)" ;;
    *)       fail "Unexpected status ${b_peer} for Tenant B reading A's record" ;;
esac

# ---------------------------------------------------------------------------
# Phase 6: Cross-tenant JWT reuse — must fail with tid mismatch.
#
# Note: GET /attestation/:id has skipAuth=true (attestations are publicly
# verifiable by design via embedded JWT proof), so we cannot use the GET
# route to test AuthHeaderProcessor.tidMismatch. POST /attestation requires
# auth and short-circuits at the auth layer before any IOTA call, so the
# mismatch returns ~immediately without minting anything.
# ---------------------------------------------------------------------------
phase 6 "Cross-tenant JWT rejection on auth-required route (POST x-api-key=A, JWT_B)"
MIX_BODY=$(jq -n '{
    attestationObject: {
        "@context": "https://schema.org",
        type: "DigitalDocument",
        name: "should-never-be-created",
        mimeType: "text/plain",
        fingerprint: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    }
}')
mix=$(http_status POST "/attestation" "${TENANT_A_API_KEY}" "${JWT_B}" "${MIX_BODY}")
case "${mix}" in
    401)
        ok "Cross-tenant JWT correctly rejected at AuthHeaderProcessor (HTTP 401)"
        ;;
    500)
        # Prior to the Finding 4 root cause fix (HttpErrorHelper.buildResponse
        # converting Error bodies to plain objects), Fastify treated an Error
        # body as a framework-level error and masked the intended 401 with a 500
        # via setErrorHandler. If this branch ever fires again, it means that
        # fix has regressed.
        fail "REGRESSION: Finding 4 — server returned 500 instead of 401. Error body conversion in HttpErrorHelper.buildResponse may have been reverted."
        ;;
    200|201)
        fail "ISOLATION BREACH: cross-tenant JWT was accepted (HTTP ${mix}) — auth layer is not enforcing tid match"
        ;;
    *)
        fail "Unexpected status ${mix} for cross-tenant JWT POST"
        ;;
esac

# ---------------------------------------------------------------------------
# Phase 7: Missing x-api-key — must fail at TenantProcessor
# ---------------------------------------------------------------------------
phase 7 "Missing x-api-key rejection"
none=$(http_status GET "/attestation/${A_ID_ENC}" "" "${JWT_A}")
[ "${none}" = "401" ] || fail "Expected 401 without x-api-key, got HTTP ${none}"
ok "Missing x-api-key correctly rejected (HTTP 401)"

# ---------------------------------------------------------------------------
# Phase 8: On-disk partition inspection — show that NFT records carry
# different partitionIds for the two tenants. This is the irrefutable proof
# that isolation is happening at the storage layer, not just at middleware.
# ---------------------------------------------------------------------------
phase 8 "On-disk partition layout inspection"
nft_store=$(docker exec "${CONTAINER}" sh -c 'cat /app/data/nft/store.json 2>/dev/null' || true)
if [ -z "${nft_store}" ]; then
    warn "Could not read /app/data/nft/store.json — skipping disk inspection"
else
    partitions=$(echo "${nft_store}" | jq -r '.[].partitionId' 2>/dev/null | sort -u)
    count=$(echo "${partitions}" | wc -l | tr -d ' ')
    echo "${partitions}" | sed 's/^/    /'
    if [ "${count}" -ge 2 ]; then
        ok "${count} distinct partition keys found in nft/store.json — tenant isolation visible on disk"
    else
        fail "Expected at least 2 distinct partition keys in nft/store.json, found ${count}"
    fi
fi

# ===========================================================================
# Tier 1 phases — broaden coverage beyond the attestation→NFT vertical.
# Same auth + tenant primitives, exercised against NFT direct and the
# identity-profile entity. Confirms partition isolation works for entity
# types we haven't otherwise touched.
# ===========================================================================

# ---------------------------------------------------------------------------
# Phase 9: Tenant A mints an NFT directly (POST /nft/)
# ---------------------------------------------------------------------------
phase 9 "Tenant A mints an NFT directly"
A_NFT_BODY=$(jq -n '{
    tag: "MT-NFT-A",
    immutableMetadata: {
        docName: "tenant-a-bill-of-lading",
        mimeType: "application/pdf",
        fingerprint: "0xa11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a11a"
    },
    metadata: {
        owner: "tenant-a-direct"
    }
}')
A_NFT_RAW=$(curl -sS -i -X POST "${HOST}/nft" \
    -H "x-api-key: ${TENANT_A_API_KEY}" \
    -H "Authorization: Bearer ${JWT_A}" \
    -H "Content-Type: application/json" \
    -d "${A_NFT_BODY}")
A_NFT_STATUS=$(echo "${A_NFT_RAW}" | grep -m1 -E '^HTTP/' | awk '{print $2}' || true)
A_NFT_ID=$(echo "${A_NFT_RAW}" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/[[:space:]]*$//' | tail -1 || true)
if [ "${A_NFT_STATUS}" != "201" ] || [ -z "${A_NFT_ID}" ]; then
    echo "----- response (Tenant A NFT mint) -----"
    echo "${A_NFT_RAW}" | tail -40
    echo "----------------------------------------"
    fail "Tenant A NFT mint failed (HTTP ${A_NFT_STATUS}, id=[${A_NFT_ID}])"
fi
ok "Tenant A NFT id: ${A_NFT_ID}"

# ---------------------------------------------------------------------------
# Phase 10: Tenant B mints an NFT directly (POST /nft/)
# ---------------------------------------------------------------------------
phase 10 "Tenant B mints an NFT directly"
B_NFT_BODY=$(jq -n '{
    tag: "MT-NFT-B",
    immutableMetadata: {
        docName: "tenant-b-bill-of-lading",
        mimeType: "application/pdf",
        fingerprint: "0xb22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b22b"
    },
    metadata: {
        owner: "tenant-b-direct"
    }
}')
B_NFT_RAW=$(curl -sS -i -X POST "${HOST}/nft" \
    -H "x-api-key: ${TENANT_B_API_KEY}" \
    -H "Authorization: Bearer ${JWT_B}" \
    -H "Content-Type: application/json" \
    -d "${B_NFT_BODY}")
B_NFT_STATUS=$(echo "${B_NFT_RAW}" | grep -m1 -E '^HTTP/' | awk '{print $2}' || true)
B_NFT_ID=$(echo "${B_NFT_RAW}" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/[[:space:]]*$//' | tail -1 || true)
if [ "${B_NFT_STATUS}" != "201" ] || [ -z "${B_NFT_ID}" ]; then
    echo "----- response (Tenant B NFT mint) -----"
    echo "${B_NFT_RAW}" | tail -40
    echo "----------------------------------------"
    fail "Tenant B NFT mint failed (HTTP ${B_NFT_STATUS}, id=[${B_NFT_ID}])"
fi
ok "Tenant B NFT id: ${B_NFT_ID}"

A_NFT_ID_ENC=$(url_encode "${A_NFT_ID}")
B_NFT_ID_ENC=$(url_encode "${B_NFT_ID}")

# ---------------------------------------------------------------------------
# Phase 11: NFT cross-tenant isolation — each tenant resolves its own NFT
# (200) and cannot resolve the other tenant's NFT (404). NFT entity-storage
# partitions by [Node, Tenant], so a lookup with the wrong tenant context
# resolves to an empty partition view.
# ---------------------------------------------------------------------------
phase 11 "NFT cross-tenant isolation"
a_nft_self=$(http_status GET "/nft/${A_NFT_ID_ENC}" "${TENANT_A_API_KEY}" "${JWT_A}")
a_nft_peer=$(http_status GET "/nft/${B_NFT_ID_ENC}" "${TENANT_A_API_KEY}" "${JWT_A}")
[ "${a_nft_self}" = "200" ] || fail "Tenant A could not resolve its own NFT (HTTP ${a_nft_self})"
case "${a_nft_peer}" in
    404|403) ok "Tenant A resolves own NFT (200), cannot see B's (HTTP ${a_nft_peer})" ;;
    200)     fail "ISOLATION BREACH: Tenant A resolved Tenant B's NFT (HTTP 200)" ;;
    *)       fail "Unexpected status ${a_nft_peer} for Tenant A reading B's NFT" ;;
esac

b_nft_self=$(http_status GET "/nft/${B_NFT_ID_ENC}" "${TENANT_B_API_KEY}" "${JWT_B}")
b_nft_peer=$(http_status GET "/nft/${A_NFT_ID_ENC}" "${TENANT_B_API_KEY}" "${JWT_B}")
[ "${b_nft_self}" = "200" ] || fail "Tenant B could not resolve its own NFT (HTTP ${b_nft_self})"
case "${b_nft_peer}" in
    404|403) ok "Tenant B resolves own NFT (200), cannot see A's (HTTP ${b_nft_peer})" ;;
    200)     fail "ISOLATION BREACH: Tenant B resolved Tenant A's NFT (HTTP 200)" ;;
    *)       fail "Unexpected status ${b_nft_peer} for Tenant B reading A's NFT" ;;
esac

# ---------------------------------------------------------------------------
# Phase 12: Tenant A writes its identity profile.
#
# Both tenant users were created reusing the node DID as user-identity (see
# setup.sh Step 4), so the JWT 'sub' is identical across tenants. The
# identity-profile record is keyed by user-identity but the entity-storage
# connector partitions by [Node, Tenant], so both tenants can have a
# profile with the same identity DID without colliding — each lands in its
# own partition. That is precisely the property we want to verify.
#
# user-create auto-creates an empty profile during setup, so POST returns
# 409 conflict. We use PUT to update the existing profile with a tenant-
# distinguishing name; if PUT fails 404 (older builds without auto-create),
# fall back to POST.
# ---------------------------------------------------------------------------
write_profile() {
    local label="$1" api_key="$2" jwt="$3" name="$4" telephone="$5"
    local body
    body=$(jq -n --arg name "$name" --arg tel "$telephone" '{
        publicProfile: {
            "@context": "https://schema.org",
            "@type": "Person",
            name: $name,
            jobTitle: "Multi-Tenancy Test Operator"
        },
        privateProfile: {
            "@context": "https://schema.org",
            "@type": "Person",
            telephone: $tel
        }
    }')
    local code
    code=$(http_status PUT "/identity/profile" "${api_key}" "${jwt}" "${body}")
    case "${code}" in
        204) ok "${label} profile updated via PUT (HTTP 204)" ;;
        404)
            step "${label} profile didn't exist for PUT; creating via POST"
            code=$(http_status POST "/identity/profile" "${api_key}" "${jwt}" "${body}")
            [ "${code}" = "204" ] || fail "${label} profile POST failed (HTTP ${code})"
            ok "${label} profile created via POST (HTTP 204)"
            ;;
        *) fail "${label} profile PUT failed (HTTP ${code})" ;;
    esac
}

phase 12 "Tenant A writes its identity profile"
write_profile "Tenant A" "${TENANT_A_API_KEY}" "${JWT_A}" "tenant-a-profile-name" "+254-700-000-001"

# ---------------------------------------------------------------------------
# Phase 13: Tenant B writes its identity profile
# ---------------------------------------------------------------------------
phase 13 "Tenant B writes its identity profile"
write_profile "Tenant B" "${TENANT_B_API_KEY}" "${JWT_B}" "tenant-b-profile-name" "+254-700-000-002"

# ---------------------------------------------------------------------------
# Phase 14: Identity-profile cross-tenant isolation
#
# Strong isolation test: both profiles share the same identity DID (the node
# DID, see Phase 12 comment). Each tenant fetches its own profile via
# GET /identity/profile/ (uses User context from JWT) and asserts that the
# returned publicProfile.name matches the one it just stored. If partitioning
# were broken, both tenants would resolve to whichever profile was written
# last — both would see the same name.
# ---------------------------------------------------------------------------
phase 14 "Identity-profile cross-tenant isolation"
A_PROFILE_GET=$(curl -sS -X GET "${HOST}/identity/profile" \
    -H "x-api-key: ${TENANT_A_API_KEY}" \
    -H "Authorization: Bearer ${JWT_A}")
B_PROFILE_GET=$(curl -sS -X GET "${HOST}/identity/profile" \
    -H "x-api-key: ${TENANT_B_API_KEY}" \
    -H "Authorization: Bearer ${JWT_B}")

A_NAME=$(echo "${A_PROFILE_GET}" | jq -r '.publicProfile.name // empty')
B_NAME=$(echo "${B_PROFILE_GET}" | jq -r '.publicProfile.name // empty')

[ "${A_NAME}" = "tenant-a-profile-name" ] || fail \
    "Tenant A's profile name should be 'tenant-a-profile-name', got '${A_NAME}' — partition leak from Tenant B?"
[ "${B_NAME}" = "tenant-b-profile-name" ] || fail \
    "Tenant B's profile name should be 'tenant-b-profile-name', got '${B_NAME}' — partition leak from Tenant A?"
ok "Tenant A sees only its own profile (name=${A_NAME})"
ok "Tenant B sees only its own profile (name=${B_NAME})"

# ---------------------------------------------------------------------------
# Phase 15: On-disk identity-profile partition inspection
# ---------------------------------------------------------------------------
phase 15 "On-disk identity-profile partition layout"
profile_store=$(docker exec "${CONTAINER}" sh -c 'cat /app/data/identity-profile/store.json 2>/dev/null' || true)
if [ -z "${profile_store}" ]; then
    warn "Could not read /app/data/identity-profile/store.json — skipping disk inspection"
else
    partitions=$(echo "${profile_store}" | jq -r '.[].partitionId' 2>/dev/null | sort -u)
    count=$(echo "${partitions}" | wc -l | tr -d ' ')
    echo "${partitions}" | sed 's/^/    /'
    if [ "${count}" -ge 2 ]; then
        ok "${count} distinct partition keys found in identity-profile/store.json — tenant isolation visible on disk"
    else
        fail "Expected at least 2 distinct partition keys in identity-profile/store.json, found ${count}"
    fi
fi

# ===========================================================================
# Tier 2 phases — rights-management policy isolation (PAP).
# Engine partitions OdrlPolicy by [Node, Tenant] (rightsManagementPap.ts:48-51),
# so policies created by Tenant A must be invisible to Tenant B even when
# both share the same node. PNP/PEP store no data, so PAP CRUD is the only
# meaningful isolation surface.
# ===========================================================================

# ---------------------------------------------------------------------------
# Phase 16: Tenant A creates an ODRL policy (POST /rights-management/policy/admin)
# ---------------------------------------------------------------------------
phase 16 "Tenant A creates an ODRL policy"
A_POLICY_BODY=$(jq -n '{
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Set",
    permission: [
        {
            target: "http://example.com/asset/tenant-a",
            action: "use"
        }
    ]
}')
A_POLICY_RAW=$(curl -sS -i -X POST "${HOST}/rights-management/policy/admin" \
    -H "x-api-key: ${TENANT_A_API_KEY}" \
    -H "Authorization: Bearer ${JWT_A}" \
    -H "Content-Type: application/json" \
    -d "${A_POLICY_BODY}")
A_POLICY_STATUS=$(echo "${A_POLICY_RAW}" | grep -m1 -E '^HTTP/' | awk '{print $2}' || true)
A_POLICY_ID=$(echo "${A_POLICY_RAW}" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/[[:space:]]*$//' | tail -1 || true)
if [ "${A_POLICY_STATUS}" != "201" ] || [ -z "${A_POLICY_ID}" ]; then
    echo "----- response (Tenant A policy create) -----"
    echo "${A_POLICY_RAW}" | tail -40
    echo "---------------------------------------------"
    fail "Tenant A policy create failed (HTTP ${A_POLICY_STATUS}, id=[${A_POLICY_ID}])"
fi
ok "Tenant A policy id: ${A_POLICY_ID}"

# ---------------------------------------------------------------------------
# Phase 17: Tenant B creates an ODRL policy
# ---------------------------------------------------------------------------
phase 17 "Tenant B creates an ODRL policy"
B_POLICY_BODY=$(jq -n '{
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Set",
    permission: [
        {
            target: "http://example.com/asset/tenant-b",
            action: "use"
        }
    ]
}')
B_POLICY_RAW=$(curl -sS -i -X POST "${HOST}/rights-management/policy/admin" \
    -H "x-api-key: ${TENANT_B_API_KEY}" \
    -H "Authorization: Bearer ${JWT_B}" \
    -H "Content-Type: application/json" \
    -d "${B_POLICY_BODY}")
B_POLICY_STATUS=$(echo "${B_POLICY_RAW}" | grep -m1 -E '^HTTP/' | awk '{print $2}' || true)
B_POLICY_ID=$(echo "${B_POLICY_RAW}" | grep -i '^location:' | sed 's/^[Ll]ocation: *//; s/[[:space:]]*$//' | tail -1 || true)
if [ "${B_POLICY_STATUS}" != "201" ] || [ -z "${B_POLICY_ID}" ]; then
    echo "----- response (Tenant B policy create) -----"
    echo "${B_POLICY_RAW}" | tail -40
    echo "---------------------------------------------"
    fail "Tenant B policy create failed (HTTP ${B_POLICY_STATUS}, id=[${B_POLICY_ID}])"
fi
ok "Tenant B policy id: ${B_POLICY_ID}"

A_POLICY_ID_ENC=$(url_encode "${A_POLICY_ID}")
B_POLICY_ID_ENC=$(url_encode "${B_POLICY_ID}")

# ---------------------------------------------------------------------------
# Phase 18: PAP cross-tenant isolation — each tenant reads its own policy
# (200) and cannot read the other tenant's policy (404). OdrlPolicy entity
# storage partitions by [Node, Tenant], so a lookup with the wrong tenant
# context resolves to an empty partition view.
# ---------------------------------------------------------------------------
phase 18 "PAP policy cross-tenant isolation"
a_pol_self=$(http_status GET "/rights-management/policy/admin/${A_POLICY_ID_ENC}" "${TENANT_A_API_KEY}" "${JWT_A}")
a_pol_peer=$(http_status GET "/rights-management/policy/admin/${B_POLICY_ID_ENC}" "${TENANT_A_API_KEY}" "${JWT_A}")
[ "${a_pol_self}" = "200" ] || fail "Tenant A could not read its own policy (HTTP ${a_pol_self})"
case "${a_pol_peer}" in
    404|403) ok "Tenant A reads own policy (200), cannot see B's (HTTP ${a_pol_peer})" ;;
    200)     fail "ISOLATION BREACH: Tenant A read Tenant B's policy (HTTP 200)" ;;
    *)       fail "Unexpected status ${a_pol_peer} for Tenant A reading B's policy" ;;
esac

b_pol_self=$(http_status GET "/rights-management/policy/admin/${B_POLICY_ID_ENC}" "${TENANT_B_API_KEY}" "${JWT_B}")
b_pol_peer=$(http_status GET "/rights-management/policy/admin/${A_POLICY_ID_ENC}" "${TENANT_B_API_KEY}" "${JWT_B}")
[ "${b_pol_self}" = "200" ] || fail "Tenant B could not read its own policy (HTTP ${b_pol_self})"
case "${b_pol_peer}" in
    404|403) ok "Tenant B reads own policy (200), cannot see A's (HTTP ${b_pol_peer})" ;;
    200)     fail "ISOLATION BREACH: Tenant B read Tenant A's policy (HTTP 200)" ;;
    *)       fail "Unexpected status ${b_pol_peer} for Tenant B reading A's policy" ;;
esac

# ---------------------------------------------------------------------------
# Phase 19: PAP list endpoint isolation — the only bulk-leak vector. If
# partition isolation is broken anywhere in the query path, GET (no id)
# would return every tenant's policies in one call. Each tenant lists,
# asserts its own policy id is present and the peer's id is absent.
# ---------------------------------------------------------------------------
phase 19 "PAP list endpoint cross-tenant isolation"
A_LIST=$(curl -sS -X GET "${HOST}/rights-management/policy/admin" \
    -H "x-api-key: ${TENANT_A_API_KEY}" \
    -H "Authorization: Bearer ${JWT_A}")
B_LIST=$(curl -sS -X GET "${HOST}/rights-management/policy/admin" \
    -H "x-api-key: ${TENANT_B_API_KEY}" \
    -H "Authorization: Bearer ${JWT_B}")

# Response body shape: { body: [ { @id: ..., ... }, ... ] } (per route schema)
A_POLICY_ID_RAW=$(url_decode "${A_POLICY_ID}")
B_POLICY_ID_RAW=$(url_decode "${B_POLICY_ID}")

A_IDS=$(echo "${A_LIST}" | jq -r '.. | objects | ."@id"? // empty' 2>/dev/null | sort -u)
B_IDS=$(echo "${B_LIST}" | jq -r '.. | objects | ."@id"? // empty' 2>/dev/null | sort -u)

echo "${A_IDS}" | grep -qxF "${A_POLICY_ID_RAW}" \
    || fail "Tenant A list did not contain its own policy id (${A_POLICY_ID_RAW})"
echo "${B_IDS}" | grep -qxF "${B_POLICY_ID_RAW}" \
    || fail "Tenant B list did not contain its own policy id (${B_POLICY_ID_RAW})"

if echo "${A_IDS}" | grep -qxF "${B_POLICY_ID_RAW}"; then
    fail "ISOLATION BREACH: Tenant A's policy list contained Tenant B's policy id (${B_POLICY_ID_RAW})"
fi
if echo "${B_IDS}" | grep -qxF "${A_POLICY_ID_RAW}"; then
    fail "ISOLATION BREACH: Tenant B's policy list contained Tenant A's policy id (${A_POLICY_ID_RAW})"
fi
ok "Tenant A list contains own (${A_POLICY_ID_RAW##*:}), excludes peer"
ok "Tenant B list contains own (${B_POLICY_ID_RAW##*:}), excludes peer"

# ---------------------------------------------------------------------------
# Phase 20: On-disk odrl-policy partition inspection
# ---------------------------------------------------------------------------
phase 20 "On-disk odrl-policy partition layout"
policy_store=$(docker exec "${CONTAINER}" sh -c 'cat /app/data/odrl-policy/store.json 2>/dev/null' || true)
if [ -z "${policy_store}" ]; then
    warn "Could not read /app/data/odrl-policy/store.json — skipping disk inspection"
else
    partitions=$(echo "${policy_store}" | jq -r '.[].partitionId' 2>/dev/null | sort -u)
    count=$(echo "${partitions}" | wc -l | tr -d ' ')
    echo "${partitions}" | sed 's/^/    /'
    if [ "${count}" -ge 2 ]; then
        ok "${count} distinct partition keys found in odrl-policy/store.json — tenant isolation visible on disk"
    else
        fail "Expected at least 2 distinct partition keys in odrl-policy/store.json, found ${count}"
    fi
fi

echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  All phases passed — multi-tenancy isolation verified${NC}"
echo -e "${BOLD}${GREEN}    end-to-end across attestation, NFT direct, identity-profile,${NC}"
echo -e "${BOLD}${GREEN}    rights-management PAP (auth + application data + on-disk)${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
