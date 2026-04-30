#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build image, bootstrap the node, create KRA + Trader tenants.
# =============================================================================
# Run from this directory: ./setup.sh [--clean]
#
# Steps:
#   1. Build Docker image
#   2. Bootstrap the node (creates DID on IOTA testnet + param-encryption
#      vault key + node admin user)
#   3. tenant-create twice to provision KRA and Trader
#   4. user-create twice (one admin per tenant) using the
#      "switch node tenant + create user + restore" CLI workaround
#
# This is a single-node multi-tenant test — there is NO step 5 attestation-VM
# patch (the multiTenancyDocker quirk doesn't apply here because we exercise
# DSP/PNP rather than attestation).
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

echo -e "${BOLD}Kenya Community Node Setup (1 node, 2 tenants: KRA + Trader)${NC}"
echo ""

# -------------------------------------------------------------------------
# Step 0: Cleanup
# -------------------------------------------------------------------------
if [ "${1:-}" = "--clean" ]; then
    echo -e "${BOLD}Step 0: Clean slate (--clean)${NC}"
    docker compose down -v 2>/dev/null || true
    rm -f "${PASSWORD_FILE}" "${TENANTS_FILE}" "${USERS_FILE}"
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

existing_state=$(docker compose run --rm -T --no-deps twin-kenya-node \
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
    docker compose run --rm -T twin-kenya-node node src/index.js bootstrap-legacy 2>&1 | tee "${bootstrap_tmp}"
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
echo -e "${BOLD}Step 3: Provision KRA and Trader via tenant-create${NC}"

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
        docker compose run --rm -T twin-kenya-node \
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

    # Both tenants live on the same node. PUBLIC_ORIGIN points back to the
    # container hostname so encrypted callback URLs route to this node.
    create_tenant "TENANT_KRA"    "kra"    "http://twin-kenya-node:3000"
    create_tenant "TENANT_TRADER" "trader" "http://twin-kenya-node:3000"
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
echo -e "${BOLD}Step 4: Create admin user inside KRA and Trader${NC}"

if [ -s "${USERS_FILE}" ] && grep -q "TENANT_KRA_USER_EMAIL" "${USERS_FILE}"; then
    ok "Tenant users already provisioned — skipping (delete .tenant-users to recreate)"
else
    node_state_json=$(docker compose run --rm -T --no-deps twin-kenya-node \
        sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
    NODE_DID=$(echo "${node_state_json}" | jq -r '.nodeId // empty')
    NODE_TENANT_ID=$(echo "${node_state_json}" | jq -r '.nodeTenantId // empty')

    [ -n "${NODE_DID}" ]       || fail "Could not read nodeId from engine-state.json"
    [ -n "${NODE_TENANT_ID}" ] || fail "Could not read nodeTenantId from engine-state.json"
    step "Node DID:       ${NODE_DID}"
    step "Node tenant id: ${NODE_TENANT_ID}"

    TENANT_USER_PASSWORD="TestUserPass123!"
    : > "${USERS_FILE}"

    create_tenant_user() {
        local prefix="$1" tenant_id="$2" email="$3"
        local tmp
        tmp=$(mktemp)
        trap "rm -f ${tmp}" RETURN

        step "Switching node tenant to ${tenant_id}"
        docker compose run --rm -T twin-kenya-node \
            node src/index.js node-set-tenant --tenant-id="${tenant_id}" 2>&1 | tail -5 \
            || fail "node-set-tenant to ${tenant_id} failed"

        step "Creating user ${email}"
        set +e
        docker compose run --rm -T twin-kenya-node \
            node src/index.js user-create \
                --email="${email}" \
                --password="${TENANT_USER_PASSWORD}" \
                --user-identity="${NODE_DID}" \
                --organization-identity="${NODE_DID}" \
                --scope="tenant-admin" 2>&1 | tee "${tmp}"
        local ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "user-create for ${email} failed"

        echo "${prefix}_USER_EMAIL=${email}"               >> "${USERS_FILE}"
        echo "${prefix}_USER_PASSWORD=${TENANT_USER_PASSWORD}" >> "${USERS_FILE}"
        ok "User ${email} created in tenant ${tenant_id}"
    }

    restore_node_tenant() {
        step "Restoring node tenant (${NODE_TENANT_ID})"
        docker compose run --rm -T twin-kenya-node \
            node src/index.js node-set-tenant --tenant-id="${NODE_TENANT_ID}" 2>&1 | tail -5 \
            || warn "node-set-tenant restore failed — fix manually: docker compose run --rm twin-kenya-node node src/index.js node-set-tenant --tenant-id=${NODE_TENANT_ID}"
    }
    trap restore_node_tenant EXIT

    create_tenant_user "TENANT_KRA"    "${TENANT_KRA_TENANT_ID}"    "admin@kra"
    create_tenant_user "TENANT_TRADER" "${TENANT_TRADER_TENANT_ID}" "admin@trader"

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
cat "${USERS_FILE}"
echo ""
echo -e "${BOLD}Next:${NC}"
echo "  docker compose up -d"
echo "  ./kenya-test.sh"
