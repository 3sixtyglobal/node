#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build image, bootstrap the node, create two tenants.
# =============================================================================
# Run from this directory: ./setup.sh [--clean]
#
# Steps:
#   1. Build Docker image
#   2. Bootstrap the node (creates DID on IOTA testnet + node admin user)
#   3. Run tenant-create twice to provision Tenant A and Tenant B
#   4. Write .node-password and .tenants for the test script to consume
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

echo -e "${BOLD}Multi-tenancy Docker Setup (1 node, 2 tenants)${NC}"
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
echo -e "${BOLD}Step 2: Bootstrap node (creates DID on IOTA testnet, ~60s)${NC}"

bootstrap_tmp=$(mktemp)
trap "rm -f ${bootstrap_tmp}" EXIT

existing_state=$(docker compose run --rm -T --no-deps twin-mt-node \
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
    docker compose run --rm -T twin-mt-node node src/index.js bootstrap-legacy 2>&1 | tee "${bootstrap_tmp}"
    exit_code=$?
    set -e
    [ ${exit_code} -eq 0 ] || fail "Bootstrap failed (exit ${exit_code})"

    password=$(grep -i "password" "${bootstrap_tmp}" | grep -oE '[^ ]+$' | tail -1)
    [ -n "${password}" ] || fail "Could not extract admin password from bootstrap output"
    echo "NODE_ADMIN_PASSWORD=${password}" > "${PASSWORD_FILE}"
    ok "Node bootstrapped. Admin password saved to .node-password"
fi

# -------------------------------------------------------------------------
# Step 3: Create two tenants via tenant-create CLI
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Provision Tenant A and Tenant B via tenant-create${NC}"

if [ -s "${TENANTS_FILE}" ] && grep -q "TENANT_A_API_KEY" "${TENANTS_FILE}"; then
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
        docker compose run --rm -T twin-mt-node \
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

        echo "${prefix}_TENANT_ID=${tid}"      >> "${TENANTS_FILE}"
        echo "${prefix}_API_KEY=${key}"        >> "${TENANTS_FILE}"
        echo "${prefix}_LABEL=${label}"        >> "${TENANTS_FILE}"
        echo "${prefix}_PUBLIC_ORIGIN=${origin}" >> "${TENANTS_FILE}"
        ok "${label}  tenantId=${tid}  apiKey=${key}"
    }

    create_tenant "TENANT_A" "mobius-freight"   "http://mobius.mt-test.local"
    create_tenant "TENANT_B" "kenya-trade"      "http://kenya.mt-test.local"
fi

# Source the tenants we just (or previously) created for use in Step 4
# shellcheck disable=SC1090
source "${TENANTS_FILE}"

# -------------------------------------------------------------------------
# Step 4: Create a user inside each non-node tenant.
#
# Why this is awkward: POST /authentication-admin/users enforces tid-match
# between caller JWT and tenant context, and the bootstrap admin's JWT always
# has tid=nodeTenantId. So there is no REST path to write a user into a
# non-node tenant today. The only supported primitive is the CLI workaround
# below: temporarily repoint the node's own tenantId at the target tenant,
# run user-create (which runs in that tenant context), then repoint back.
#
# Both test users reuse the node's own DID as user/organization identity.
# That is fine for isolation testing - the authentication-user table is
# keyed by email + tenant partition, not by DID uniqueness.
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 4: Create users inside Tenant A and Tenant B${NC}"

if [ -s "${USERS_FILE}" ] && grep -q "TENANT_A_USER_EMAIL" "${USERS_FILE}"; then
    ok "Tenant users already provisioned - skipping (delete .tenant-users to recreate)"
else
    # Read node DID and node tenant id from engine state (inside container)
    node_state_json=$(docker compose run --rm -T --no-deps twin-mt-node \
        sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
    NODE_DID=$(echo "${node_state_json}" | jq -r '.nodeId // empty')
    NODE_TENANT_ID=$(echo "${node_state_json}" | jq -r '.nodeTenantId // empty')

    [ -n "${NODE_DID}" ]       || fail "Could not read nodeId from engine-state.json"
    [ -n "${NODE_TENANT_ID}" ] || fail "Could not read nodeTenantId from engine-state.json"
    step "Node DID:       ${NODE_DID}"
    step "Node tenant id: ${NODE_TENANT_ID}"

    # Strong-enough password (user-create requires min 16 chars)
    TENANT_USER_PASSWORD="TestUserPass123!"

    : > "${USERS_FILE}"

    create_tenant_user() {
        local prefix="$1" tenant_id="$2" email="$3"
        local tmp
        tmp=$(mktemp)
        trap "rm -f ${tmp}" RETURN

        step "Switching node tenant to ${tenant_id}"
        docker compose run --rm -T twin-mt-node \
            node src/index.js node-set-tenant --tenant-id="${tenant_id}" 2>&1 | tail -5 \
            || fail "node-set-tenant to ${tenant_id} failed"

        step "Creating user ${email}"
        set +e
        docker compose run --rm -T twin-mt-node \
            node src/index.js user-create \
                --email="${email}" \
                --password="${TENANT_USER_PASSWORD}" \
                --user-identity="${NODE_DID}" \
                --organization-identity="${NODE_DID}" \
                --scope="tenant-admin" 2>&1 | tee "${tmp}"
        local ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "user-create for ${email} failed"

        echo "${prefix}_USER_EMAIL=${email}"              >> "${USERS_FILE}"
        echo "${prefix}_USER_PASSWORD=${TENANT_USER_PASSWORD}" >> "${USERS_FILE}"
        ok "User ${email} created in tenant ${tenant_id}"
    }

    # Ensure we always attempt to restore the node tenant even on failure
    restore_node_tenant() {
        step "Restoring node tenant (${NODE_TENANT_ID})"
        docker compose run --rm -T twin-mt-node \
            node src/index.js node-set-tenant --tenant-id="${NODE_TENANT_ID}" 2>&1 | tail -5 \
            || warn "node-set-tenant restore failed - the engine state may still be pointing at a non-node tenant. Manually fix via: docker compose run --rm twin-mt-node node src/index.js node-set-tenant --tenant-id=${NODE_TENANT_ID}"
    }
    trap restore_node_tenant EXIT

    create_tenant_user "TENANT_A" "${TENANT_A_TENANT_ID}" "admin@mobius-freight"
    create_tenant_user "TENANT_B" "${TENANT_B_TENANT_ID}" "admin@kenya-trade"

    restore_node_tenant
    trap - EXIT
fi

# -------------------------------------------------------------------------
# Step 5: Ensure node DID has an "attestation-assertion" verification method.
#
# bootstrap-legacy creates the node DID but does NOT add the verification
# method that the attestation service signs with. Without it, attestation
# creates fail with iotaIdentityConnector.createVerifiableCredentialFailed.
# This step is idempotent (CLI overwrite-mode defaults to "skip").
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 5: Ensure node DID exposes attestation-assertion verification method${NC}"

VM_MARKER="${SCRIPT_DIR}/.attestation-vm-done"
if [ -f "${VM_MARKER}" ]; then
    ok "Attestation verification method already added (marker present, delete .attestation-vm-done to retry)"
else
    # Re-read node DID in case Step 4 was skipped
    node_state_json=$(docker compose run --rm -T --no-deps twin-mt-node \
        sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
    NODE_DID=$(echo "${node_state_json}" | jq -r '.nodeId // empty')
    [ -n "${NODE_DID}" ] || fail "Could not read nodeId from engine-state.json"

    step "Adding attestation-assertion to ${NODE_DID} (~30s on IOTA testnet)"
    set +e
    docker compose run --rm -T twin-mt-node \
        node src/index.js identity-verification-method-create \
            --identity="${NODE_DID}" \
            --verification-method-id="attestation-assertion" 2>&1 | tail -10
    ec=$?
    set -e
    [ ${ec} -eq 0 ] || fail "identity-verification-method-create failed (exit ${ec})"
    touch "${VM_MARKER}"
    ok "attestation-assertion verification method added"
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
echo "  ./mt-test.sh"
