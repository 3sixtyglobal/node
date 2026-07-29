#!/usr/bin/env bash
# =============================================================================
# exercise-metrics.sh — drive REST endpoints that tick twin-core metric counters
# not covered by provision-storage.sh / kenya-usecase-test.sh, so the Grafana
# dashboard panels (twin-workspace#35) can be verified with live data.
# Tolerant by design: every step logs ok/warn and continues; negative steps
# EXPECT a 4xx. Run after setup + provision + use-case test, node up on :3042.
# Local test tooling only — never run against a shared environment.
# =============================================================================

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  [ok] $1${NC}"; }
warn() { echo -e "${YELLOW}  [warn] $1${NC}"; }
step() { echo -e "${BLUE}== $1${NC}"; }

source .tenants
source .tenant-users
source .tenant-identities
[ -s .publishers ] && source .publishers

HOST="http://localhost:3042"
AIS_CONTEXT='["https://schema.org","https://schema.twindev.org/ais/","https://schema.twindev.org/common/"]'
DSP_CONTEXT="https://w3id.org/dspace/2025/1/context.jsonld"
TRUST_VM_ID="trust-assertion"

urlenc() { jq -rn --arg v "$1" '$v|@uri'; }

login() {
    curl -sS -i -X POST "${HOST}/authentication/login" \
        -H "Content-Type: application/json" -H "x-api-key: $1" \
        -d "$(jq -n --arg e "$2" --arg p "$3" '{email:$e,password:$p}')" \
        | grep -i "^set-cookie:" | grep -oE "access_token=[^;]+" | head -1 | cut -d= -f2-
}

# api METHOD PATH ORG_DID SESSION [BODY] [EXTRA_HEADER] -> sets API_STATUS + API_BODY
API_STATUS=""; API_BODY=""
api() {
    local method="$1" path="$2" org="$3" sess="$4" body="${5-}" extra="${6-}"
    local args=(-sS -o /tmp/exm-body.$$ -w "%{http_code}" -X "${method}" \
        "${HOST}${path}?organization=$(urlenc "${org}")" \
        -H "Cookie: access_token=${sess}")
    [ -n "${body}" ] && args+=(-H "Content-Type: application/json" -d "${body}")
    [ -n "${extra}" ] && args+=(-H "${extra}")
    API_STATUS=$(curl "${args[@]}")
    API_BODY=$(cat /tmp/exm-body.$$ 2>/dev/null); rm -f /tmp/exm-body.$$
}

step "Logins (KRA publisher + Trader consumer)"
KRA_SESS=$(login "${TENANT_KRA_API_KEY}" "${TENANT_KRA_USER_EMAIL}" "${TENANT_KRA_USER_PASSWORD}")
TRADER_SESS=$(login "${TENANT_TRADER_API_KEY}" "${TENANT_TRADER_USER_EMAIL}" "${TENANT_TRADER_USER_PASSWORD}")
[ -n "${KRA_SESS}" ] && ok "KRA logged in" || warn "KRA login failed — publisher steps will fail"
[ -n "${TRADER_SESS}" ] && ok "Trader logged in" || warn "Trader login failed — consumer steps will fail"

step "Fresh trust VC for Trader (identity_vcs_created; input for verify tests)"
api POST "/identity/${TRADER_DID}/verifiable-credential/${TRUST_VM_ID}" "${TRADER_DID}" "${TRADER_SESS}" \
    "$(jq -n --arg s "${TRADER_DID}" '{subject:{id:$s}}')"
TRUST_JWT=$(echo "${API_BODY}" | jq -r '.verifiableCredentialJwt // .jwt // empty' 2>/dev/null)
[ -n "${TRUST_JWT}" ] && ok "trust VC minted (${API_STATUS})" || warn "trust VC mint failed (${API_STATUS}): $(echo "${API_BODY}" | head -c 120)"

step "Federated catalogue query (fc_queries_executed?)"
api POST "/federated-catalogue/request" "${TRADER_DID}" "${TRADER_SESS}" \
    "{\"@context\":[\"${DSP_CONTEXT}\"],\"@type\":\"CatalogRequestMessage\",\"filter\":[]}" \
    "Authorization: Bearer ${TRUST_JWT}"
[ "${API_STATUS}" = "200" ] && ok "catalogue query (${API_STATUS})" || warn "catalogue query (${API_STATUS})"

step "AIS lifecycle as KRA (streams updated/closed/deleted, entries, proofs removed, rejections)"
sid=$(curl -sS -D - -o /dev/null -X POST "${HOST}/ais?organization=$(urlenc "${KRA_DID}")" \
    -H "Content-Type: application/json" -H "Cookie: access_token=${KRA_SESS}" \
    -d "$(jq -cn --argjson ctx "${AIS_CONTEXT}" '{"@context":$ctx,type:"AuditableItemStream"}')" \
    | grep -i '^location:' | tr -d '\r' | sed -E 's/^[Ll]ocation:[[:space:]]*//' | sed -E 's|.*/||')
if [ -n "${sid}" ]; then
    ok "stream created ${sid} (ais_streams_created)"
    api PUT "/ais/${sid}" "${KRA_DID}" "${KRA_SESS}" \
        "$(jq -cn --argjson ctx "${AIS_CONTEXT}" '{"@context":$ctx,type:"AuditableItemStream",annotationObject:{"@context":"https://schema.org",type:"Note",name:"exerciser-update"}}')"
    [ "${API_STATUS}" = "204" ] || [ "${API_STATUS}" = "200" ] && ok "stream updated (ais_streams_updated, ${API_STATUS})" || warn "stream update (${API_STATUS})"

    eid=$(curl -sS -D - -o /dev/null -X POST "${HOST}/ais/${sid}/entries?organization=$(urlenc "${KRA_DID}")" \
        -H "Content-Type: application/json" -H "Cookie: access_token=${KRA_SESS}" \
        -d '{"entryObject":{"@context":"https://schema.org","type":"Note","name":"exerciser-entry"}}' \
        | grep -i '^location:' | tr -d '\r' | sed -E 's/^[Ll]ocation:[[:space:]]*//' | sed -E 's|.*/||')
    if [ -n "${eid}" ]; then
        ok "entry created ${eid} (ais_entries_created)"
        api PUT "/ais/${sid}/entries/${eid}" "${KRA_DID}" "${KRA_SESS}" \
            '{"entryObject":{"@context":"https://schema.org","type":"Note","name":"exerciser-entry-v2"}}'
        [ "${API_STATUS}" = "204" ] || [ "${API_STATUS}" = "200" ] && ok "entry updated (ais_entries_updated, ${API_STATUS})" || warn "entry update (${API_STATUS})"
        api DELETE "/ais/${sid}/entries/${eid}" "${KRA_DID}" "${KRA_SESS}"
        [ "${API_STATUS}" = "204" ] && ok "entry deleted (ais_entries_deleted)" || warn "entry delete (${API_STATUS})"
    else
        warn "entry create returned no id"
    fi

    api DELETE "/ais/${sid}/proof" "${KRA_DID}" "${KRA_SESS}"
    [ "${API_STATUS}" = "204" ] && ok "stream proof removed (ais_proofs_removed_stream)" || warn "proof remove (${API_STATUS})"

    api PUT "/ais/${sid}/close" "${KRA_DID}" "${KRA_SESS}"
    [ "${API_STATUS}" = "204" ] && ok "stream closed (ais_streams_closed)" || warn "stream close (${API_STATUS})"

    api POST "/ais/${sid}/entries" "${KRA_DID}" "${KRA_SESS}" \
        '{"entryObject":{"@context":"https://schema.org","type":"Note","name":"should-reject"}}'
    if [ "${API_STATUS}" -ge 400 ] && [ "${API_STATUS}" != "404" ]; then ok "append to closed stream rejected ${API_STATUS} (ais_closed_stream_rejections)"; else warn "closed-stream append gave ${API_STATUS} (404 = wrong path, no rejection counted)"; fi

    api DELETE "/ais/${sid}" "${KRA_DID}" "${KRA_SESS}"
    [ "${API_STATUS}" = "204" ] && ok "stream deleted (ais_streams_deleted)" || warn "stream delete (${API_STATUS})"
else
    warn "AIS stream create returned no Location id — AIS steps skipped"
fi

step "Identity verification failures + revocation (vcs/vps counters)"
api GET "/identity/verifiable-credential/verify?jwt=$(urlenc "${TRUST_JWT}corrupt")" "${TRADER_DID}" "${TRADER_SESS}"
ok "tampered VC verify -> ${API_STATUS} (identity_vcs_verification_failed)"
api GET "/identity/verifiable-presentation/verify?jwt=$(urlenc "not.a.vp")" "${TRADER_DID}" "${TRADER_SESS}"
ok "garbage VP verify -> ${API_STATUS} (identity_vps_verification_failed)"
api GET "/identity/${KRA_DID}/verifiable-credential/revoke/990" "${KRA_DID}" "${KRA_SESS}"
[ "${API_STATUS}" -lt 400 ] && ok "VC index 990 revoked (identity_vcs_revoked)" || warn "revoke (${API_STATUS}) — on-chain op, may need gas"
api GET "/identity/${KRA_DID}/verifiable-credential/unrevoke/990" "${KRA_DID}" "${KRA_SESS}"
[ "${API_STATUS}" -lt 400 ] && ok "VC index 990 unrevoked (identity_vcs_unrevoked)" || warn "unrevoke (${API_STATUS})"

step "DID create/remove (identity_dids_created/removed — on-chain, may fail without gas)"
api POST "/identity" "${KRA_DID}" "${KRA_SESS}" '{}'
new_did=$(echo "${API_BODY}" | jq -r '.id // .identity // empty' 2>/dev/null)
if [ -n "${new_did}" ]; then
    ok "DID created ${new_did} (identity_dids_created)"
    api DELETE "/identity/$(urlenc "${new_did}")" "${KRA_DID}" "${KRA_SESS}"
    [ "${API_STATUS}" -lt 400 ] && ok "DID removed (identity_dids_removed)" || warn "DID remove (${API_STATUS})"
else
    warn "DID create failed (${API_STATUS})"
fi

step "Dataspace app-datasets (dcp_app_datasets_updated/deleted)"
api GET "/dataspace/app-datasets" "${KRA_DID}" "${KRA_SESS}"
ds_body=$(echo "${API_BODY}" | jq -c '(.entities // [])[0] // empty' 2>/dev/null)
if [ -n "${ds_body}" ]; then
    ds_id=$(echo "${ds_body}" | jq -r '.["@id"] // .id // empty')
    tmp_body=$(echo "${ds_body}" | jq -c '.id="https://twin.example.org/metrics-exerciser-throwaway"')
    new_ds=$(curl -sS -D - -o /dev/null -X POST "${HOST}/dataspace/app-datasets?organization=$(urlenc "${KRA_DID}")" \
        -H "Content-Type: application/json" -H "Cookie: access_token=${KRA_SESS}" -d "${tmp_body}" \
        | grep -i '^location:' | tr -d '\r' | sed -E 's/^[Ll]ocation:[[:space:]]*//' | sed -E 's|.*/||')
    if [ -n "${new_ds}" ]; then
        ok "throwaway app-dataset ${new_ds} created (dcp_app_datasets_created)"
        api PUT "/dataspace/app-datasets/${new_ds}" "${KRA_DID}" "${KRA_SESS}" "${tmp_body}"
        [ "${API_STATUS}" -lt 400 ] && ok "app-dataset updated (dcp_app_datasets_updated)" || warn "app-dataset update (${API_STATUS})"
        api DELETE "/dataspace/app-datasets/${new_ds}" "${KRA_DID}" "${KRA_SESS}"
        [ "${API_STATUS}" -lt 400 ] && ok "app-dataset deleted (dcp_app_datasets_deleted)" || warn "app-dataset delete (${API_STATUS})"
    else
        warn "throwaway app-dataset create returned no id; trying update on existing ${ds_id}"
        api PUT "/dataspace/app-datasets/$(urlenc "${ds_id}")" "${KRA_DID}" "${KRA_SESS}" "${ds_body}"
        [ "${API_STATUS}" -lt 400 ] && ok "app-dataset updated (dcp_app_datasets_updated)" || warn "app-dataset update (${API_STATUS})"
    fi
else
    warn "no app-datasets listed (${API_STATUS})"
fi

step "Data-plane entity query (ddp_data_assets_queried)"
api POST "/dataspace/entities/query" "${TRADER_DID}" "${TRADER_SESS}" '{}'
st1=${API_STATUS}
[ "${st1}" = "200" ] && ok "entities query (${st1})" || {
    api POST "/dataspace/entities/query" "${TRADER_DID}" "${TRADER_SESS}" '{"query":{}}' "x-api-key: ${TENANT_TRADER_API_KEY}"
    [ "${API_STATUS}" = "200" ] && ok "entities query (${API_STATUS})" || warn "entities query (${st1}/${API_STATUS}): $(echo "${API_BODY}" | head -c 120)"
}

step "FC dataset removal (fc_datasets_removed) — removes AFA's offer; rerun provision-storage.sh to restore"
if [ -n "${AFA_DATASET_ID-}" ]; then
    api DELETE "/federated-catalogue/datasets/$(urlenc "${AFA_DATASET_ID}")" "${AFA_DID}" \
        "$(login "${TENANT_AFA_API_KEY}" "${TENANT_AFA_USER_EMAIL}" "${TENANT_AFA_USER_PASSWORD}")"
    [ "${API_STATUS}" -lt 400 ] && ok "AFA dataset removed (fc_datasets_removed)" || warn "dataset remove (${API_STATUS}): $(echo "${API_BODY}" | head -c 150)"
else
    warn "AFA_DATASET_ID not in .publishers — skipped"
fi

echo
echo "Done. Wait one scrape interval (~15s), then check http://localhost:4000/d/twin-core-metrics (Node = kenya-node)."
