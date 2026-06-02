#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build image, bootstrap the node, create 5 tenants:
#   Publishers: KRA, KPA, KENTRADE, AFA   •   Consumer: Trader
# =============================================================================
# Run from this directory: ./setup.sh [--clean]
#
# Steps:
#   1. Build Docker image
#   2. Bootstrap the node (creates DID on IOTA testnet + param-encryption
#      vault key + node admin user)
#   3. tenant-create x5 — four publisher authorities + one consumer
#   4. user-create x5 (one admin per tenant, each with its own minted DID)
#      using the "switch node tenant + create user + restore" CLI workaround
#
# This is the multi-publisher Kenya use-case scaffold (publish-and-aggregate):
# the four authorities each publish their own consignment slice; Trader
# discovers all four, negotiates + pulls from each, and aggregates locally.
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

PASSWORD_FILE="${SCRIPT_DIR}/.node-password"
TENANTS_FILE="${SCRIPT_DIR}/.tenants"
USERS_FILE="${SCRIPT_DIR}/.tenant-users"
IDENTITIES_FILE="${SCRIPT_DIR}/.tenant-identities"

# -----------------------------------------------------------------------------
# Pre-funded test mnemonics (override via env vars below to use the faucet)
# -----------------------------------------------------------------------------
# Each identity-create + bootstrap call on IOTA testnet needs gas to publish a
# DID. By default we mint a fresh wallet and request funds from the testnet
# faucet — which is rate-limited and often empty during heavy testing.
#
# These three TWIN test mnemonics already have substantial testnet balances
# (verified 2026-05-19: Primary ~2,149 IOTA, Secondary ~1,219 IOTA, NFT-test
# ~107 IOTA). Each is a public mnemonic checked into multiple `.env.dev` files
# across the workspace (`wallet/`, `identity/`, `nft/`, `dlt/` …). Using them
# here makes setup work even when the faucet is empty AND gives us three
# distinct wallets per scaffold (closer to production shape than sharing one).
#
# To force the faucet path instead, set each variable to the empty string:
#   TWIN_KENYA_NODE_MNEMONIC="" TWIN_KENYA_KRA_MNEMONIC="" TWIN_KENYA_TRADER_MNEMONIC="" ./setup.sh
TWIN_KENYA_NODE_MNEMONIC="${TWIN_KENYA_NODE_MNEMONIC-school left lawn urban oxygen cram unveil alpha space puzzle humble leisure fatigue high width auto deputy beach various style mammal kid cube liar}"
TWIN_KENYA_KRA_MNEMONIC="${TWIN_KENYA_KRA_MNEMONIC-undo boss jewel dog announce mistake cry brass stock debris arrest patrol recipe annual clown honey icon twist modify quarter warm lock anchor cigar}"
TWIN_KENYA_TRADER_MNEMONIC="${TWIN_KENYA_TRADER_MNEMONIC-hunt supply sun write waste imitate device bless heavy solve install basic bar assault invite globe umbrella fury drum diet inform under element banner}"
# The three extra publisher tenants reuse the pre-funded wallets above. Each
# identity-create mints a DISTINCT DID on-chain even when the funding wallet
# repeats (createDocument always mints a fresh doc); the wallets easily cover
# 5 tenant DIDs + 3 bootstrap DIDs. Override any of these to spread gas or use
# the faucet (set to "").
TWIN_KENYA_KPA_MNEMONIC="${TWIN_KENYA_KPA_MNEMONIC-${TWIN_KENYA_NODE_MNEMONIC}}"
TWIN_KENYA_KENTRADE_MNEMONIC="${TWIN_KENYA_KENTRADE_MNEMONIC-${TWIN_KENYA_KRA_MNEMONIC}}"
TWIN_KENYA_AFA_MNEMONIC="${TWIN_KENYA_AFA_MNEMONIC-${TWIN_KENYA_TRADER_MNEMONIC}}"

echo -e "${BOLD}Kenya Community USE-CASE Setup (1 node, 5 tenants: KRA, KPA, KENTRADE, AFA + Trader)${NC}"
echo ""

# -------------------------------------------------------------------------
# Step 0: Cleanup
# -------------------------------------------------------------------------
if [ "${1:-}" = "--clean" ]; then
    echo -e "${BOLD}Step 0: Clean slate (--clean)${NC}"
    docker compose down -v 2>/dev/null || true
    rm -f "${PASSWORD_FILE}" "${TENANTS_FILE}" "${USERS_FILE}" "${IDENTITIES_FILE}"
    ok "Volumes, containers, and saved state removed"
    shift
else
    echo -e "${BOLD}Step 0: Stop previous containers (preserve volumes)${NC}"
    docker compose down 2>/dev/null || true
    ok "Containers stopped"
fi

# -------------------------------------------------------------------------
# Step 1: Build image
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 1: Build Docker image${NC}"
docker compose build || fail "Docker build failed"
ok "Image built"

# -------------------------------------------------------------------------
# Step 2: Bootstrap node
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 2: Bootstrap node (creates DID on IOTA testnet + param-encryption key, ~60s)${NC}"

bootstrap_tmp=$(mktemp)
trap "rm -f ${bootstrap_tmp}" EXIT

existing_state=$(docker compose run --rm -T --no-deps twin-kenya-usecase-node \
    sh -c 'cat /app/data/engine-state.json 2>/dev/null' 2>/dev/null || true)

if echo "${existing_state}" | grep -q "nodeId"; then
    node_did=$(echo "${existing_state}" | sed -n 's/.*"nodeId"[^"]*"\([^"]*\)".*/\1/p')
    if [ -s "${PASSWORD_FILE}" ]; then
        ok "Node already bootstrapped (DID: ${node_did}), password cached"
    else
        warn "Node already bootstrapped but password not saved — run ./setup.sh --clean"
        exit 1
    fi
else
    set +e
    if [ -n "${TWIN_KENYA_NODE_MNEMONIC}" ]; then
        # bootstrap-legacy mints THREE identities: node, organization, admin user.
        # Each call goes through identityCreate → generateWallet (because
        # node-wallet feature is enabled), which calls ensureBalance against the
        # mnemonic's derived address. With a pre-funded mnemonic, ensureBalance
        # sees existing balance and skips the faucet entirely. We point all three
        # at the same NFT-test mnemonic so the same wallet pays for all three
        # DID creations (107 IOTA covers them easily; each DID is still distinct
        # on-chain because identityConnector.createDocument mints a fresh doc).
        step "Using pre-funded NFT-test mnemonic for node + org + admin-user DIDs (skips faucet)"
        docker compose run --rm -T \
            -e TWIN_NODE_MNEMONIC="${TWIN_KENYA_NODE_MNEMONIC}" \
            -e TWIN_ORGANIZATION_MNEMONIC="${TWIN_KENYA_NODE_MNEMONIC}" \
            -e TWIN_ADMIN_USER_MNEMONIC="${TWIN_KENYA_NODE_MNEMONIC}" \
            twin-kenya-usecase-node node src/index.js bootstrap-legacy 2>&1 | tee "${bootstrap_tmp}"
    else
        step "No TWIN_KENYA_NODE_MNEMONIC set — minting fresh node DID via faucet"
        docker compose run --rm -T twin-kenya-usecase-node node src/index.js bootstrap-legacy 2>&1 | tee "${bootstrap_tmp}"
    fi
    exit_code=$?
    set -e
    [ ${exit_code} -eq 0 ] || fail "Bootstrap failed (exit ${exit_code})"

    password=$(grep -i "password" "${bootstrap_tmp}" | grep -oE '[^ ]+$' | tail -1)
    [ -n "${password}" ] || fail "Could not extract admin password from bootstrap output"
    # Use printf %q so passwords containing $, `, ', " etc. survive `source` under set -u.
    # Without escaping, a password containing $XE3 expands to an "unbound variable" error
    # when the test script sources this file (latent bug also present in mt-test setup.sh).
    printf 'NODE_ADMIN_PASSWORD=%q\n' "${password}" > "${PASSWORD_FILE}"
    ok "Node bootstrapped. Admin password saved to .node-password"

    # Sanity-check: param-encryption vault key must have been created.
    # Renamed from tenant-token-encryption in Martyn's HostingService refactor —
    # the HostingService now mints/decrypts arbitrary param tokens (not just
    # tenant tokens), so the key carries the more generic name.
    # If missing, the HostingService encrypt/decrypt sites silently fall back
    # to the unencrypted path → invalidates the multi-tenant routing test.
    if grep -q "param-encryption" "${bootstrap_tmp}"; then
        ok "param-encryption vault key created (HostingService key verified)"
    else
        fail "param-encryption vault key NOT created in bootstrap — HostingService wiring is broken"
    fi
fi

# -------------------------------------------------------------------------
# Step 3: Create KRA and Trader tenants
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Provision KRA, KPA, KENTRADE, AFA + Trader via tenant-create${NC}"

if [ -s "${TENANTS_FILE}" ] && grep -q "TENANT_KRA_API_KEY" "${TENANTS_FILE}"; then
    ok "Tenants already provisioned — skipping (delete .tenants to recreate)"
else
    : > "${TENANTS_FILE}"

    create_tenant() {
        local prefix="$1" label="$2" origin="$3"
        local tmp
        tmp=$(mktemp)
        trap "rm -f ${tmp}" RETURN

        step "Creating tenant ${label}"
        set +e
        docker compose run --rm -T twin-kenya-usecase-node \
            node src/index.js tenant-create \
                --label="${label}" \
                --public-origin="${origin}" 2>&1 | tee "${tmp}"
        local ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "tenant-create failed for ${label}"

        local tid key
        tid=$(grep -iE "tenant.?id" "${tmp}" | grep -oE '[0-9a-f]{32}' | head -1)
        key=$(grep -iE "api.?key"   "${tmp}" | grep -oE '[0-9a-f]{32}' | head -1)
        [ -n "${tid}" ] || fail "Could not extract tenantId for ${label}"
        [ -n "${key}" ] || fail "Could not extract apiKey for ${label}"

        echo "${prefix}_TENANT_ID=${tid}"        >> "${TENANTS_FILE}"
        echo "${prefix}_API_KEY=${key}"          >> "${TENANTS_FILE}"
        echo "${prefix}_LABEL=${label}"          >> "${TENANTS_FILE}"
        echo "${prefix}_PUBLIC_ORIGIN=${origin}" >> "${TENANTS_FILE}"
        ok "${label}  tenantId=${tid}  apiKey=${key}"
    }

    # All tenants live on the same node. PUBLIC_ORIGIN points back to the
    # container hostname so encrypted callback URLs route to this node.
    # Four publisher authorities + one consumer.
    create_tenant "TENANT_KRA"      "kra"      "http://twin-kenya-usecase-node:3000"
    create_tenant "TENANT_KPA"      "kpa"      "http://twin-kenya-usecase-node:3000"
    create_tenant "TENANT_KENTRADE" "kentrade" "http://twin-kenya-usecase-node:3000"
    create_tenant "TENANT_AFA"      "afa"      "http://twin-kenya-usecase-node:3000"
    create_tenant "TENANT_TRADER"   "trader"   "http://twin-kenya-usecase-node:3000"
fi

# Source the tenants we just (or previously) created for use in Step 4
# shellcheck disable=SC1090
source "${TENANTS_FILE}"

# -------------------------------------------------------------------------
# Step 4: Create one admin user inside each tenant.
#
# Same CLI workaround as multiTenancyDocker — POST /authentication-admin/users
# enforces tid-match between caller JWT and tenant context. Workaround:
# temporarily repoint the node's own tenantId at the target tenant, run
# user-create, then repoint back.
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Create admin user + minted DID inside each of the 5 tenants${NC}"

if [ -s "${USERS_FILE}" ] && grep -q "TENANT_KRA_USER_EMAIL" "${USERS_FILE}" \
        && [ -s "${IDENTITIES_FILE}" ] && grep -q "TENANT_KRA_DID" "${IDENTITIES_FILE}"; then
    ok "Tenant users + identities already provisioned — skipping (delete .tenant-users and .tenant-identities to recreate)"
else
    node_state_json=$(docker compose run --rm -T --no-deps twin-kenya-usecase-node \
        sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
    NODE_DID=$(echo "${node_state_json}" | jq -r '.nodeId // empty')
    NODE_TENANT_ID=$(echo "${node_state_json}" | jq -r '.nodeTenantId // empty')

    [ -n "${NODE_DID}" ]       || fail "Could not read nodeId from engine-state.json"
    [ -n "${NODE_TENANT_ID}" ] || fail "Could not read nodeTenantId from engine-state.json"
    step "Node DID:       ${NODE_DID}"
    step "Node tenant id: ${NODE_TENANT_ID}"

    TENANT_USER_PASSWORD="TestUserPass123!"
    : > "${USERS_FILE}"
    : > "${IDENTITIES_FILE}"

    # S1 (2026-05-19 stand-up): mint a distinct org DID per tenant so the
    # identity-based authorization on transfer-mutation routes can actually
    # distinguish callers. Previously KRA and Trader users were both created
    # with --user-identity=$NODE_DID --organization-identity=$NODE_DID, which
    # made trustInfo.identity identical for both tenants and degenerated the
    # validateCallerIsConsumer / validateCallerIsTransferParty checks.
    create_tenant_identity_and_user() {
        local prefix="$1" tenant_id="$2" email="$3" tenant_mnemonic="$4"
        local tmp identity_tmp
        tmp=$(mktemp)
        identity_tmp=$(mktemp)
        trap "rm -f ${tmp} ${identity_tmp}" RETURN

        step "Switching node tenant to ${tenant_id}"
        docker compose run --rm -T twin-kenya-usecase-node \
            node src/index.js node-set-tenant --tenant-id="${tenant_id}" 2>&1 | tail -5 \
            || fail "node-set-tenant to ${tenant_id} failed"

        step "Minting tenant DID for ${prefix} (identity-create on IOTA testnet, ~60s)"
        set +e
        if [ -n "${tenant_mnemonic}" ]; then
            step "  using pre-funded mnemonic for ${prefix} (skips faucet)"
            docker compose run --rm -T twin-kenya-usecase-node \
                node src/index.js identity-create \
                    --mnemonic="${tenant_mnemonic}" \
                    --fund-wallet=true 2>&1 | tee "${identity_tmp}"
        else
            step "  no pre-funded mnemonic for ${prefix} — minting fresh wallet via faucet"
            docker compose run --rm -T twin-kenya-usecase-node \
                node src/index.js identity-create --fund-wallet=true 2>&1 | tee "${identity_tmp}"
        fi
        local ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "identity-create for ${prefix} failed"

        local tenant_did
        tenant_did=$(grep -oE 'did:iota:[a-z0-9:]+0x[a-f0-9]+' "${identity_tmp}" | head -1)
        [ -n "${tenant_did}" ] || fail "Could not extract tenant DID for ${prefix} from identity-create output"
        echo "${prefix}_DID=${tenant_did}" >> "${IDENTITIES_FILE}"
        ok "${prefix} tenant DID: ${tenant_did}"

        # Bootstrap adds a `trust-assertion` verification method on the node
        # DID so trust JWT-VCs can be issued. Tenant DIDs need the same VM
        # before /identity/:did/verifiable-credential/trust-assertion can sign.
        step "Adding trust-assertion VM to ${prefix} DID"
        docker compose run --rm -T twin-kenya-usecase-node \
            node src/index.js identity-verification-method-create \
                --identity="${tenant_did}" \
                --verification-method-type="assertionMethod" \
                --verification-method-id="trust-assertion" 2>&1 | tail -10 \
            || fail "identity-verification-method-create failed for ${prefix}"
        ok "${prefix} trust-assertion VM added"

        step "Creating user ${email} (user-identity + org-identity = ${prefix}_DID)"
        set +e
        docker compose run --rm -T twin-kenya-usecase-node \
            node src/index.js user-create \
                --email="${email}" \
                --password="${TENANT_USER_PASSWORD}" \
                --user-identity="${tenant_did}" \
                --organization-identity="${tenant_did}" \
                --tenant-id="${tenant_id}" \
                --scope="tenant-admin" 2>&1 | tee "${tmp}"
        ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "user-create for ${email} failed"

        echo "${prefix}_USER_EMAIL=${email}"               >> "${USERS_FILE}"
        echo "${prefix}_USER_PASSWORD=${TENANT_USER_PASSWORD}" >> "${USERS_FILE}"
        ok "User ${email} created in tenant ${tenant_id}"
    }

    restore_node_tenant() {
        step "Restoring node tenant (${NODE_TENANT_ID})"
        docker compose run --rm -T twin-kenya-usecase-node \
            node src/index.js node-set-tenant --tenant-id="${NODE_TENANT_ID}" 2>&1 | tail -5 \
            || warn "node-set-tenant restore failed — fix manually: docker compose run --rm twin-kenya-usecase-node node src/index.js node-set-tenant --tenant-id=${NODE_TENANT_ID}"
    }
    trap restore_node_tenant EXIT

    create_tenant_identity_and_user "TENANT_KRA"      "${TENANT_KRA_TENANT_ID}"      "admin@kra"      "${TWIN_KENYA_KRA_MNEMONIC}"
    create_tenant_identity_and_user "TENANT_KPA"      "${TENANT_KPA_TENANT_ID}"      "admin@kpa"      "${TWIN_KENYA_KPA_MNEMONIC}"
    create_tenant_identity_and_user "TENANT_KENTRADE" "${TENANT_KENTRADE_TENANT_ID}" "admin@kentrade" "${TWIN_KENYA_KENTRADE_MNEMONIC}"
    create_tenant_identity_and_user "TENANT_AFA"      "${TENANT_AFA_TENANT_ID}"      "admin@afa"      "${TWIN_KENYA_AFA_MNEMONIC}"
    create_tenant_identity_and_user "TENANT_TRADER"   "${TENANT_TRADER_TENANT_ID}"   "admin@trader"   "${TWIN_KENYA_TRADER_MNEMONIC}"

    restore_node_tenant
    trap - EXIT
fi

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo -e "${BOLD}${GREEN}  Setup complete${NC}"
echo -e "${BOLD}${GREEN}================================================================${NC}"
echo ""
cat "${PASSWORD_FILE}"
cat "${TENANTS_FILE}"
cat "${IDENTITIES_FILE}"
cat "${USERS_FILE}"
echo ""
echo -e "${BOLD}Next:${NC}"
echo "  docker compose up -d"
echo "  ./provision-storage.sh"
echo "  ./kenya-usecase-test.sh"
