#!/usr/bin/env bash
# =============================================================================
# option3-test.sh — twin-dataspace #362 reproduction on the running scaffold node
# =============================================================================
# Run from this directory after ./kenya-usecase-test.sh (Phase 3 leaves one real
# KRA agreement in the Trader's PAP): ./option3-test.sh
#
# Phases:
#   13. Consumer agreement reuse picks the NEWEST agreement across PAP pages:
#       seed more than one page of fake agreements for the KRA offer triple in the
#       Trader's PAP, mint a fresh real agreement (newest), then call the in-process
#       negotiateAgreement (probe) and expect the real one back.
#   14. An agreement the provider reports unknown is pruned and reuse recovers:
#       seed one more fake (now the newest), prepareTransfer with it, expect the
#       provider rejection, the local prune (agreementSwept/unknownAtProvider), the
#       PAP 404, then reuse returning the real agreement and a successful prepare.
#
# negotiateAgreement/prepareTransfer are in-process only, so each call runs the
# probe extension in a one-shot node process sharing the scaffold's data volume
# (docker compose run), against the running node as provider (KRA tenant).
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "${BLUE}  -> $1${NC}"; }
ok()   { echo -e "${GREEN}  [OK] $1${NC}"; }
fail() { echo -e "${RED}  [FAIL] $1${NC}"; exit 1; }
info() { echo -e "${BLUE}  $1${NC}"; }
phase() { echo ""; echo "================================================================"; echo -e "${BOLD}  Phase $1: $2${NC}"; echo "================================================================"; }

HOST="http://localhost:3042"
INTERNAL_URL="http://twin-kenya-defaultarb-node:3000"
FAKES="${OPTION3_FAKES:-45}"
eval "$(grep -E '^(DSP_CONTEXT|ODRL_CONTEXT|TRUST_VM_ID)=' provision-storage.sh)"

for f in .tenants .tenant-users .tenant-identities .publishers; do
    [ -s "$f" ] || fail "Missing $f — run ./setup.sh and ./provision-storage.sh first"
    # shellcheck disable=SC1090
    source "$f"
done

urlenc() { jq -rn --arg v "$1" '$v|@uri'; }
login_session() {
    curl -sS -i -X POST "${HOST}/authentication/login" -H "Content-Type: application/json" -H "x-api-key: $1" \
        -d "$(jq -n --arg e "$2" --arg p "$3" '{email:$e,password:$p}')" \
        | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-
}
generate_trust_jwt() {
    curl -sS -X POST "${HOST}/identity/$2/verifiable-credential/${TRUST_VM_ID}?organization=$(urlenc "$2")" \
        -H "Content-Type: application/json" -H "Cookie: access_token=$1" \
        -d "$(jq -n --arg s "$3" '{subject:{id:$s}}')" | jq -r '.jwt // empty'
}
http_code() { curl -sS -o /dev/null -w "%{http_code}" "$@"; }

TRADER_DID="${TENANT_TRADER_DID}"
TRADER_ORG_ENC=$(urlenc "${TRADER_DID}")
KRA_ORG_ENC=$(urlenc "${KRA_DID}")
PROVIDER_ENDPOINT="${INTERNAL_URL}/?organization=${KRA_ORG_ENC}"
# negotiateAgreement resolves the offer through the catalogue, whose dataset embeds the
# offer as "urn:policy:<dataset slug>-offer" (see provision-storage.sh); the PAP offer id
# in .publishers is only used by the explicit inline negotiation below.
CATALOG_OFFER_ID="urn:policy:${KRA_DATASET_ID#https://twin.example.org/}-offer"
TRADER_SESSION_JWT=$(login_session "${TENANT_TRADER_API_KEY}" "${TENANT_TRADER_USER_EMAIL}" "${TENANT_TRADER_USER_PASSWORD}")
[ -n "${TRADER_SESSION_JWT}" ] || fail "Trader login failed"
KRA_SESSION_JWT=$(login_session "${TENANT_KRA_API_KEY}" "${TENANT_KRA_USER_EMAIL}" "${TENANT_KRA_USER_PASSWORD}")
[ -n "${KRA_SESSION_JWT}" ] || fail "KRA login failed"
TRADER_TRUST_JWT=$(generate_trust_jwt "${TRADER_SESSION_JWT}" "${TRADER_DID}" "urn:trust:trader-kenya-node")
[ -n "${TRADER_TRUST_JWT}" ] || fail "Trader trust JWT generation failed"
ok "Trader + KRA sessions and a fresh Trader trust JWT ready"

# --- PAP helpers (Trader = consumer PAP, KRA = provider PAP) ------------------
pap_create_agreement() {
    local uid="$1" body
    body=$(jq -n --arg ctx "${ODRL_CONTEXT}" --arg uid "${uid}" --arg assigner "${KRA_DID}" --arg assignee "${TRADER_DID}" --arg target "${KRA_DATASET_ID}" \
        '{ "@context": $ctx, "@type": "Agreement", uid: $uid, assigner: $assigner, assignee: $assignee, target: $target,
           permission: [{ action: "read", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }] }')
    local code
    code=$(http_code -X POST "${HOST}/rights-management/policy/admin?organization=${TRADER_ORG_ENC}" \
        -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_SESSION_JWT}" -d "${body}")
    [ "${code}" = "201" ] || [ "${code}" = "204" ] || fail "PAP create ${uid} failed (HTTP ${code})"
}
pap_delete() { # org_enc jwt id
    http_code -X DELETE "${HOST}/rights-management/policy/admin/$(urlenc "$3")?organization=$1" -H "Authorization: Bearer $2"
}
pap_agreement_status() { # org_enc jwt id
    http_code "${HOST}/rights-management/policy/admin/agreement/$(urlenc "$3")?organization=$1" -H "Authorization: Bearer $2"
}
pap_list_triple_ids() { # org_enc jwt -> ids of the Agreements for (assigner KRA, assignee Trader, target KRA dataset)
    curl -sS "${HOST}/rights-management/policy/admin?organization=$1&type=Agreement&assigner=${KRA_ORG_ENC}&assignee=${TRADER_ORG_ENC}&target=$(urlenc "${KRA_DATASET_ID}")&limit=200" \
        -H "Authorization: Bearer $2" | jq -r '.[] | (.uid // .["@id"])'
}

# --- probe runner --------------------------------------------------------------
PROBE_N=0
PROBE_LOG=""
next_probe() { PROBE_N=$((PROBE_N + 1)); PROBE_LOG=".option3-probe-${PROBE_N}.log"; }
run_probe() { # mode [agreementId] -> prints the PROBE-RETURN json; full output in $PROBE_LOG (set by next_probe in the parent shell)
    # Console-only logging in the probe: a second writer on the file-store log-entry store corrupts it.
    local log="${PROBE_LOG}"
    docker compose run --rm -T --no-deps \
        -v "${SCRIPT_DIR}/probe:/app/probe:ro" \
        -e TWIN_EXTENSIONS="@twin.org/dataspace-test-app,/app/probe/option3-probe.mjs" \
        -e PROBE_MODE="$1" -e PROBE_AGREEMENT_ID="${2:-}" \
        -e PROBE_DATASET_ID="${KRA_DATASET_ID}" -e PROBE_OFFER_ID="${CATALOG_OFFER_ID}" \
        -e PROBE_PROVIDER_ENDPOINT="${PROVIDER_ENDPOINT}" -e PROBE_TRUST_JWT="${TRADER_TRUST_JWT}" \
        -e PROBE_ORG="${TRADER_DID}" -e PROBE_TENANT="${TENANT_TRADER_TENANT_ID}" \
        -e PROBE_PROVIDER_ORG="${KRA_DID}" -e PROBE_PROVIDER_TENANT="${TENANT_KRA_TENANT_ID}" \
        -e TWIN_DATASPACE_AUTO_START_TRANSFERS=true \
        -e TWIN_LOGGING_CONNECTOR=console \
        twin-kenya-defaultarb-node 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' > "${log}" || true
    grep -E "^PROBE-RETURN " "${log}" | tail -1 | sed 's/^PROBE-RETURN //'
}
probe_log() { echo "${PROBE_LOG}"; }

# --- fresh real negotiation with KRA (copy of Phase 3's negotiation half) -----
negotiate_kra() {
    local consumer_pid="urn:contract-negotiation:trader-KRA-opt3-$(date +%s)-${RANDOM}"
    local pnap_body
    pnap_body=$(jq -n --arg id "${consumer_pid}" --arg dateCreated "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" --arg organizationIdentity "${TRADER_DID}" \
        '{ id: $id, correlationId: "", dateCreated: $dateCreated, state: "REQUESTED", organizationIdentity: $organizationIdentity }')
    local code
    code=$(http_code -X PUT "${HOST}/rights-management/negotiations/admin/${consumer_pid}?organization=${TRADER_ORG_ENC}" \
        -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_SESSION_JWT}" -d "${pnap_body}")
    [ "${code}" = "204" ] || [ "${code}" = "200" ] || fail "PNAP pre-inject failed (HTTP ${code})"
    local offer_json negotiate_body
    offer_json=$(jq -n --arg ctx "${ODRL_CONTEXT}" --arg uid "${KRA_OFFER_ID}" --arg assigner "${KRA_DID}" --arg target "${KRA_DATASET_ID}" \
        '{ "@context": $ctx, "@type": "Offer", uid: $uid, assigner: $assigner, target: $target,
           action: "read", permission: [{ action: "read", target: { "@type": "twin:jsonPath", "twin:jsonPathExpression": "$" } }] }')
    negotiate_body=$(jq -n --arg ctx "${DSP_CONTEXT}" --arg consumerPid "${consumer_pid}" --argjson offer "${offer_json}" \
        --arg callback "${INTERNAL_URL}/rights-management?organization=${TRADER_ORG_ENC}" \
        '{ "@context": [$ctx], "@type": "ContractRequestMessage", consumerPid: $consumerPid, offer: $offer, callbackAddress: $callback }')
    local resp http body provider_pid
    resp=$(curl -sS -w "\n%{http_code}" -X POST "${HOST}/rights-management/negotiations/request?organization=${KRA_ORG_ENC}" \
        -H "Content-Type: application/json" -H "Authorization: Bearer ${TRADER_TRUST_JWT}" -d "${negotiate_body}")
    http=$(echo "${resp}" | tail -1); body=$(echo "${resp}" | sed '$d')
    [ "${http}" = "200" ] || [ "${http}" = "201" ] || { info "Nego body: ${body}"; fail "negotiation request failed (HTTP ${http})"; }
    provider_pid=$(echo "${body}" | jq -r '.providerPid // empty')
    [ -n "${provider_pid}" ] || fail "no providerPid in negotiation response"
    local state=""
    for attempt in $(seq 1 15); do
        state=$(curl -sS "${HOST}/rights-management/negotiations/${provider_pid}?organization=${KRA_ORG_ENC}" \
            -H "Authorization: Bearer ${TRADER_TRUST_JWT}" | jq -r '.state // empty')
        { [ "${state}" = "FINALIZED" ] || [ "${state}" = "VERIFIED" ]; } && break
        [ "${attempt}" -lt 15 ] && sleep 2
    done
    { [ "${state}" = "FINALIZED" ] || [ "${state}" = "VERIFIED" ]; } || fail "negotiation did not reach FINALIZED (last: ${state:-unknown})"
    curl -sS "${HOST}/rights-management/negotiations/admin/${consumer_pid}?organization=${TRADER_ORG_ENC}" \
        -H "Authorization: Bearer ${TRADER_SESSION_JWT}" | jq -r '.agreement["@id"] // .agreement.uid // empty'
}

# =============================================================================
phase 13 "Consumer agreement reuse picks the NEWEST agreement across PAP pages (#362)"
step "baseline: in-process negotiateAgreement with the Phase 3 agreement in place"
next_probe; r=$(run_probe negotiate)
[ -n "${r}" ] || { tail -20 "$(probe_log)"; fail "probe returned nothing (see $(probe_log))"; }
A0=$(echo "${r}" | jq -r '.result.agreementId // empty')
[ -n "${A0}" ] || { info "${r}"; fail "baseline reuse returned no agreementId"; }
[ "$(echo "${r}" | jq -r '.result.negotiationId // "null"')" = "null" ] || fail "baseline started a negotiation instead of reusing"
ok "baseline reuse returned the existing agreement ${A0} (no new negotiation)"

step "remove every existing agreement for the triple on both sides (the provider dedupe would otherwise hand an old one back)"
DELETED=""
for side in provider consumer; do
    if [ "${side}" = provider ]; then org="${KRA_ORG_ENC}"; jwt="${KRA_SESSION_JWT}"; else org="${TRADER_ORG_ENC}"; jwt="${TRADER_SESSION_JWT}"; fi
    n=0
    for id in $(pap_list_triple_ids "${org}" "${jwt}"); do
        c=$(pap_delete "${org}" "${jwt}" "${id}")
        [ "${c}" = "204" ] || [ "${c}" = "200" ] || fail "delete ${id} on the ${side} failed (HTTP ${c})"
        DELETED="${DELETED} ${id}"; n=$((n + 1))
    done
    ok "${side}: ${n} agreement(s) for the triple removed"
done
[ -z "$(pap_list_triple_ids "${KRA_ORG_ENC}" "${KRA_SESSION_JWT}")" ] || fail "provider still holds agreements for the triple"

step "seed ${FAKES} fake agreements for (assigner KRA, assignee Trader, target KRA dataset) in the Trader PAP"
STAMP=$(date +%s)
for i in $(seq 1 "${FAKES}"); do pap_create_agreement "urn:policy:opt3-fake-${STAMP}-${i}"; done
LAST_FAKE="urn:policy:opt3-fake-${STAMP}-${FAKES}"
ok "${FAKES} fake agreements created; the newest (${LAST_FAKE}) sits beyond the first PAP page"

step "in-process negotiateAgreement must page past the first PAP page and return the newest"
next_probe; r=$(run_probe negotiate)
GOT=$(echo "${r}" | jq -r '.result.agreementId // empty')
[ "${GOT}" = "${LAST_FAKE}" ] || { info "probe returned: ${r}"; fail "reuse returned ${GOT:-nothing}, expected the newest ${LAST_FAKE} (a first-page-only selection returns an older fake): see $(probe_log)"; }
ok "reuse paged past the first page and returned the newest agreement ${GOT}"

step "fresh real negotiation with KRA (a NEW agreement, now the newest on both sides)"
REAL2=$(negotiate_kra)
[ -n "${REAL2}" ] || fail "fresh negotiation returned no agreement id"
case " ${DELETED} " in *" ${REAL2} "*) fail "provider returned a deleted agreement (${REAL2}) again";; esac
# The consumer copy lands via the finalization callback; poll briefly instead of racing it.
for i in $(seq 1 20); do
    st=$(pap_agreement_status "${TRADER_ORG_ENC}" "${TRADER_SESSION_JWT}" "${REAL2}")
    [ "${st}" = "200" ] && break
    sleep 0.5
done
[ "${st}" = "200" ] || fail "fresh agreement ${REAL2} not in the Trader PAP after 10s (HTTP ${st})"
ok "fresh agreement ${REAL2} minted and stored on the consumer"

step "reuse must now return the fresh real agreement across $((FAKES + 1)) agreements"
next_probe; r=$(run_probe negotiate)
GOT=$(echo "${r}" | jq -r '.result.agreementId // empty')
[ "${GOT}" = "${REAL2}" ] || { info "probe returned: ${r}"; fail "reuse returned ${GOT:-nothing}, expected ${REAL2} (see $(probe_log))"; }
ok "reuse returned the newest real agreement ${REAL2}"

# =============================================================================
phase 14 "An agreement the provider reports unknown is pruned and reuse recovers (#362)"
FAKE_NEWEST="urn:policy:opt3-fake-${STAMP}-newest"
pap_create_agreement "${FAKE_NEWEST}"
ok "seeded ${FAKE_NEWEST} as the newest agreement (unknown at the provider)"

step "reuse now selects the stale newest agreement"
next_probe; r=$(run_probe negotiate)
GOT=$(echo "${r}" | jq -r '.result.agreementId // empty')
[ "${GOT}" = "${FAKE_NEWEST}" ] || { info "${r}"; fail "expected ${FAKE_NEWEST}, got ${GOT:-nothing}"; }
ok "reuse returned ${FAKE_NEWEST}"

step "prepareTransfer with the stale agreement: provider rejects, consumer prunes"
next_probe; r=$(run_probe prepare "${FAKE_NEWEST}")
ERR=$(echo "${r}" | jq -r '.error.message // empty')
[ -n "${ERR}" ] || { info "${r}"; fail "prepareTransfer with the stale agreement did not fail"; }
echo "${ERR}" | grep -q "transferRequestRejectedByProvider" || { info "${r}"; fail "unexpected error: ${ERR}"; }
ok "prepareTransfer rejected by the provider (${ERR})"
# The console logging connector renders the agreementSwept message as "Agreement removed (...)".
grep -qE "agreementSwept|Agreement removed" "$(probe_log)" && grep -q "unknownAtProvider" "$(probe_log)" \
    && ok "consumer logged the prune: $(grep -oE '(agreementSwept|Agreement removed) \([^)]*\)' "$(probe_log)" | head -1)" \
    || fail "no agreementSwept/unknownAtProvider log line in $(probe_log)"
st=$(pap_agreement_status "${TRADER_ORG_ENC}" "${TRADER_SESSION_JWT}" "${FAKE_NEWEST}")
[ "${st}" = "404" ] && ok "stale agreement removed from the Trader PAP (HTTP 404)" || fail "stale agreement still present (HTTP ${st})"
st=$(pap_agreement_status "${TRADER_ORG_ENC}" "${TRADER_SESSION_JWT}" "${REAL2}")
[ "${st}" = "200" ] && ok "real agreement ${REAL2} untouched (HTTP 200)" || fail "real agreement missing (HTTP ${st})"

step "reuse recovers to the real agreement and prepareTransfer succeeds"
next_probe; r=$(run_probe negotiate)
GOT=$(echo "${r}" | jq -r '.result.agreementId // empty')
[ "${GOT}" = "${REAL2}" ] || { info "${r}"; fail "expected ${REAL2} after the prune, got ${GOT:-nothing}"; }
ok "reuse returned ${REAL2} again"
next_probe; r=$(run_probe prepare "${REAL2}")
CPID=$(echo "${r}" | jq -r '.result.consumerPid // empty')
[ -n "${CPID}" ] || { info "${r}"; fail "prepareTransfer with the real agreement failed"; }
ok "prepareTransfer accepted by the provider (consumerPid ${CPID})"

# --- twin-api #282: the provider auto-starts an in-process transfer although neither tenant stores a
# publicOrigin (the probe process runs with auto-start on; the main node keeps it off for the phases) ---
step "provider auto-starts the in-process transfer (twin-api #282, tenants without a stored publicOrigin)"
# The console logging connector prints the rendered text, not the message key: match both.
grep -qE "autoStartPublicOriginMissing|public origin could not be resolved" "$(probe_log)" \
    && fail "provider held the transfer in REQUESTED: autoStartPublicOriginMissing (twin-api #282, api-service < 0.9.3?) see $(probe_log)"
PSTATE=$(echo "${r}" | jq -r '.result.providerState // empty')
CSTATE=$(echo "${r}" | jq -r '.result.consumerState // empty')
WAITED=$(echo "${r}" | jq -r '.result.waitedMs // empty')
case "${PSTATE}" in
    STARTED|COMPLETED) ok "provider auto-started the transfer (provider ${PSTATE}, consumer ${CSTATE:-unknown}, ${WAITED:-?} ms)";;
    *) info "${r}"; fail "transfer did not leave REQUESTED on the provider (state ${PSTATE:-none}) see $(probe_log)";;
esac

echo ""
echo "================================================================"
echo -e "${GREEN}  ✓ #362 reproduction complete: paging reuse + stale-agreement prune verified, #282 auto-start verified${NC}"
echo "================================================================"
