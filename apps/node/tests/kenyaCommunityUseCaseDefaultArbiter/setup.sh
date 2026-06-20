#!/usr/bin/env bash
# =============================================================================
# setup.sh — Build image, bootstrap the node, create 5 tenants:
#   Publishers: KRA, KPA, KENTRADE, AFA   •   Consumer: Trader
# =============================================================================
# Run from this directory: ./setup.sh [--clean]
#
# Steps:
#   1. Build Docker image
#   2. Bootstrap the node (creates node + organization + admin-user DIDs on
#      IOTA testnet; post-#203 the org DID is bound to the node's own tenant)
#   3. Per tenant (x5 — four publisher authorities + one consumer):
#      identity-create (mint the tenant's org DID) →
#      tenant-create --organization-id=<did> (REQUIRED post-#203) →
#      trust-assertion VM → user-create
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

existing_state=$(docker compose run --rm -T --no-deps twin-kenya-defaultarb-node \
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
            twin-kenya-defaultarb-node node src/index.js bootstrap-legacy 2>&1 | tee "${bootstrap_tmp}"
    else
        step "No TWIN_KENYA_NODE_MNEMONIC set — minting fresh node DID via faucet"
        docker compose run --rm -T twin-kenya-defaultarb-node node src/index.js bootstrap-legacy 2>&1 | tee "${bootstrap_tmp}"
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

    # Post-#203: the param-encryption vault key no longer exists by design —
    # encrypted tenant tokens were replaced by the cleartext ?organization=
    # routing param, so the old sanity check for it is gone too.
fi

# -------------------------------------------------------------------------
# Step 3: Per tenant — mint org DID, create the tenant bound to it, add the
# trust-assertion VM, create the tenant-admin user.
#
# Post-#203 (organization identifiers): tenant-create REQUIRES
# --organization-id and the node refuses to start if any tenant lacks one
# ("tenantsWithoutOrganizationId"), so the per-tenant DID (previously minted
# AFTER tenant-create, in the old step 4) is now minted FIRST and becomes the
# tenant's organization id. The same DID remains the admin user's user/org
# identity, and ?organization=<did> is how all non-login REST calls route to
# the tenant (encrypted tenant tokens are gone).
#
# Post-#186 (remove set-tenant): user-create takes --tenant-id directly; the
# node's own tenant is fixed via TWIN_TENANT_ID (env), not engine-state.
# -------------------------------------------------------------------------
echo ""
echo -e "${BOLD}Step 3: Provision 5 tenants (org DID + tenant + VM + admin user each)${NC}"

if [ -s "${TENANTS_FILE}" ] && grep -q "TENANT_KRA_API_KEY" "${TENANTS_FILE}" \
        && [ -s "${USERS_FILE}" ] && grep -q "TENANT_KRA_USER_EMAIL" "${USERS_FILE}" \
        && [ -s "${IDENTITIES_FILE}" ] && grep -q "TENANT_KRA_DID" "${IDENTITIES_FILE}"; then
    ok "Tenants, identities and users already provisioned — skipping (delete .tenants/.tenant-users/.tenant-identities to recreate)"
else
    node_state_json=$(docker compose run --rm -T --no-deps twin-kenya-defaultarb-node \
        sh -c 'cat /app/data/engine-state.json' 2>/dev/null || true)
    NODE_DID=$(echo "${node_state_json}" | jq -r '.nodeId // empty')
    [ -n "${NODE_DID}" ] || fail "Could not read nodeId from engine-state.json"
    step "Node DID: ${NODE_DID}"

    TENANT_USER_PASSWORD="TestUserPass123!"
    : > "${TENANTS_FILE}"
    : > "${USERS_FILE}"
    : > "${IDENTITIES_FILE}"

    # S1 (2026-05-19 stand-up): each tenant gets a DISTINCT DID so the
    # identity-based authorization on transfer-mutation routes can actually
    # distinguish callers (trustInfo.identity differs per tenant). Post-#203
    # that DID is also the tenant's organization id, its proof signer, and its
    # public URL routing token — org-DID uniqueness across tenants is enforced
    # by tenant-create.
    create_tenant_full() {
        local prefix="$1" label="$2" origin="$3" email="$4" tenant_mnemonic="$5"
        local tmp identity_tmp
        tmp=$(mktemp)
        identity_tmp=$(mktemp)
        trap "rm -f ${tmp} ${identity_tmp}" RETURN

        step "Minting org DID for ${prefix} (identity-create on IOTA testnet, ~60s)"
        set +e
        if [ -n "${tenant_mnemonic}" ]; then
            step "  using pre-funded mnemonic for ${prefix} (skips faucet)"
            docker compose run --rm -T twin-kenya-defaultarb-node \
                node src/index.js identity-create \
                    --mnemonic="${tenant_mnemonic}" \
                    --fund-wallet=true 2>&1 | tee "${identity_tmp}"
        else
            step "  no pre-funded mnemonic for ${prefix} — minting fresh wallet via faucet"
            docker compose run --rm -T twin-kenya-defaultarb-node \
                node src/index.js identity-create --fund-wallet=true 2>&1 | tee "${identity_tmp}"
        fi
        local ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "identity-create for ${prefix} failed"

        local tenant_did
        tenant_did=$(grep -oE 'did:iota:[a-z0-9:]+0x[a-f0-9]+' "${identity_tmp}" | head -1)
        [ -n "${tenant_did}" ] || fail "Could not extract org DID for ${prefix} from identity-create output"
        echo "${prefix}_DID=${tenant_did}" >> "${IDENTITIES_FILE}"
        ok "${prefix} org DID: ${tenant_did}"

        # NOTE: --public-origin is intentionally omitted. tenant-create now enforces a
        # uniqueness constraint on publicOrigin (tenantAdminService.publicOriginAlreadyExists),
        # so 5 tenants on the same node cannot all share one origin. Post-#203 routing is by
        # ?organization=<org-did>, not by origin, and the scaffold's callbacks use a hardcoded
        # internal URL, so the per-tenant publicOrigin is unused here. Empty origin is exempt
        # from the uniqueness check.
        step "Creating tenant ${label} (organization-id=${tenant_did})"
        set +e
        docker compose run --rm -T twin-kenya-defaultarb-node \
            node src/index.js tenant-create \
                --label="${label}" \
                --organization-id="${tenant_did}" 2>&1 | tee "${tmp}"
        ec=$?
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

        # Trust JWT-VCs are issued via /identity/:did/verifiable-credential/
        # trust-assertion, which needs an assertionMethod VM on the org DID
        # (bootstrap only adds one to the node DID).
        step "Adding trust-assertion VM to ${prefix} DID"
        docker compose run --rm -T twin-kenya-defaultarb-node \
            node src/index.js identity-verification-method-create \
                --identity="${tenant_did}" \
                --verification-method-type="assertionMethod" \
                --verification-method-id="trust-assertion" 2>&1 | tail -10 \
            || fail "identity-verification-method-create failed for ${prefix}"
        ok "${prefix} trust-assertion VM added"

        step "Creating user ${email} (user-identity + org-identity = ${prefix}_DID)"
        set +e
        docker compose run --rm -T twin-kenya-defaultarb-node \
            node src/index.js user-create \
                --email="${email}" \
                --password="${TENANT_USER_PASSWORD}" \
                --user-identity="${tenant_did}" \
                --organization-identity="${tenant_did}" \
                --tenant-id="${tid}" \
                --scope="tenant-admin" 2>&1 | tee "${tmp}"
        ec=$?
        set -e
        [ ${ec} -eq 0 ] || fail "user-create for ${email} failed"

        echo "${prefix}_USER_EMAIL=${email}"                   >> "${USERS_FILE}"
        echo "${prefix}_USER_PASSWORD=${TENANT_USER_PASSWORD}" >> "${USERS_FILE}"
        ok "User ${email} created in tenant ${tid}"
    }

    # All tenants live on the same node. PUBLIC_ORIGIN points back to the
    # container hostname so callback URLs route to this node.
    # Four publisher authorities + one consumer.
    create_tenant_full "TENANT_KRA"      "kra"      "http://twin-kenya-defaultarb-node:3000" "admin@kra"      "${TWIN_KENYA_KRA_MNEMONIC}"
    create_tenant_full "TENANT_KPA"      "kpa"      "http://twin-kenya-defaultarb-node:3000" "admin@kpa"      "${TWIN_KENYA_KPA_MNEMONIC}"
    create_tenant_full "TENANT_KENTRADE" "kentrade" "http://twin-kenya-defaultarb-node:3000" "admin@kentrade" "${TWIN_KENYA_KENTRADE_MNEMONIC}"
    create_tenant_full "TENANT_AFA"      "afa"      "http://twin-kenya-defaultarb-node:3000" "admin@afa"      "${TWIN_KENYA_AFA_MNEMONIC}"
    create_tenant_full "TENANT_TRADER"   "trader"   "http://twin-kenya-defaultarb-node:3000" "admin@trader"   "${TWIN_KENYA_TRADER_MNEMONIC}"
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
