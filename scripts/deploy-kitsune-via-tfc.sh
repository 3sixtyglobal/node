#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_WORKSPACE_NAME="k8s-staging"
readonly EXPECTED_VARIABLE_KEY="KITSUNE_TWIN_NODE_IMAGE"
readonly EXPECTED_IMAGE_REPOSITORY="twinfoundation/twin-node"

stderr() {
  printf '%s\n' "$*" >&2
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    stderr "ERROR: required environment variable '$name' is not set"
    exit 1
  fi
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    stderr "ERROR: required command '$cmd' is not available"
    exit 1
  fi
}

require_positive_integer_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    stderr "ERROR: required environment variable '$name' must be a positive integer. Received '$value'."
    exit 1
  fi
}

require_tfc_identifier() {
  local label="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ ]]; then
    stderr "ERROR: $label has an invalid format. Received '$value'."
    exit 1
  fi
}

require_tfc_api_url() {
  local value="$1"
  if [[ ! "$value" =~ ^https://app\.terraform\.io/api/v2/?$ ]]; then
    stderr "ERROR: TFC_API_URL must target https://app.terraform.io/api/v2. Received '$value'."
    exit 1
  fi
}

require_kitsune_image_reference() {
  local value="$1"
  if [[ ! "$value" =~ ^twinfoundation/twin-node:[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$ ]]; then
    stderr "ERROR: IMAGE_REFERENCE must be an immutable $EXPECTED_IMAGE_REPOSITORY semantic version tag, not a channel tag. Received '$value'."
    exit 1
  fi
}

to_absolute_tfc_url() {
  local url_path="${1:-}"
  if [[ -n "$url_path" && "$url_path" == /* ]]; then
    printf '%s%s\n' "$TFC_BASE_URL" "$url_path"
  else
    printf '%s\n' "$url_path"
  fi
}

require_command curl
require_command jq

require_env TFC_TOKEN
require_env TFC_WORKSPACE_ID
require_env TFC_VARIABLE_ID
require_env IMAGE_REFERENCE
require_env TARGET_ENVIRONMENT

TFC_API_URL="${TFC_API_URL:-https://app.terraform.io/api/v2}"
DEPLOY_TIMEOUT_SECONDS="${DEPLOY_TIMEOUT_SECONDS:-2700}"
DEPLOY_POLL_INTERVAL_SECONDS="${DEPLOY_POLL_INTERVAL_SECONDS:-15}"

TFC_API_URL="${TFC_API_URL%/}"
TFC_BASE_URL="${TFC_API_URL%/api/v2}"

require_tfc_api_url "$TFC_API_URL"
require_tfc_identifier "TFC_WORKSPACE_ID" "$TFC_WORKSPACE_ID"
require_tfc_identifier "TFC_VARIABLE_ID" "$TFC_VARIABLE_ID"
require_positive_integer_env DEPLOY_TIMEOUT_SECONDS
require_positive_integer_env DEPLOY_POLL_INTERVAL_SECONDS
require_kitsune_image_reference "$IMAGE_REFERENCE"

if [[ "$TARGET_ENVIRONMENT" != "staging" ]]; then
  stderr "ERROR: Kitsune deploys are staging-only. Received TARGET_ENVIRONMENT='$TARGET_ENVIRONMENT'."
  exit 1
fi

RUN_ID=""
RUN_URL=""
FINAL_STATUS="unknown"

write_summary() {
  local note="${1:-}"
  if [[ -z "${GITHUB_STEP_SUMMARY:-}" ]]; then
    return
  fi

  {
    echo "### Kitsune Terraform Deploy"
    echo ""
    echo "- Target environment: \`$TARGET_ENVIRONMENT\`"
    echo "- Image reference: \`$IMAGE_REFERENCE\`"
    echo "- Workspace: \`$EXPECTED_WORKSPACE_NAME\`"
    echo "- Workspace ID: \`$TFC_WORKSPACE_ID\`"
    echo "- Variable key: \`$EXPECTED_VARIABLE_KEY\`"
    echo "- Variable ID: \`$TFC_VARIABLE_ID\`"
    echo "- Run ID: \`${RUN_ID:-n/a}\`"
    echo "- Run URL: ${RUN_URL:-n/a}"
    echo "- Auto-apply: \`true\`"
    echo "- Final status: \`$FINAL_STATUS\`"
    if [[ -n "$note" ]]; then
      echo "- Notes: $note"
    fi
  } >> "$GITHUB_STEP_SUMMARY"
}

fail() {
  local message="$1"
  stderr "ERROR: $message"
  write_summary "$message"
  exit 1
}

tfc_request() (
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response_file header_file status
  local -a curl_args

  response_file="$(mktemp)"
  header_file="$(mktemp)"
  trap 'rm -f "$response_file" "$header_file"' EXIT

  if [[ "$path" != /* || "$path" == *".."* || "$path" =~ [[:space:]] ]]; then
    stderr "ERROR: invalid Terraform Cloud API path '$path'"
    return 1
  fi

  printf 'Authorization: Bearer %s\n' "$TFC_TOKEN" > "$header_file"

  curl_args=(
    -sS
    -o "$response_file"
    -w "%{http_code}"
    -X "$method"
    -H "@$header_file"
    -H "Content-Type: application/vnd.api+json"
  )

  if [[ -n "$body" ]]; then
    curl_args+=(--data "$body")
  fi

  status="$(curl "${curl_args[@]}" "$TFC_API_URL$path")"

  if [[ ! "$status" =~ ^2 ]]; then
    stderr "Terraform Cloud API request failed ($method $path, HTTP $status)"
    cat "$response_file" >&2
    return 1
  fi

  cat "$response_file"
)

echo "Verifying Terraform Cloud staging workspace '$TFC_WORKSPACE_ID'..."
if ! workspace_response="$(tfc_request "GET" "/workspaces/$TFC_WORKSPACE_ID")"; then
  FINAL_STATUS="workspace_verification_failed"
  fail "Unable to read the Terraform Cloud workspace."
fi

workspace_name="$(echo "$workspace_response" | jq -r '.data.attributes.name // ""')"
if [[ "$workspace_name" != "$EXPECTED_WORKSPACE_NAME" ]]; then
  FINAL_STATUS="workspace_mismatch"
  fail "Workspace '$TFC_WORKSPACE_ID' is '$workspace_name', expected '$EXPECTED_WORKSPACE_NAME'."
fi

echo "Verifying Terraform variable '$TFC_VARIABLE_ID' is '$EXPECTED_VARIABLE_KEY' in '$EXPECTED_WORKSPACE_NAME'..."
if ! variables_response="$(tfc_request "GET" "/workspaces/$TFC_WORKSPACE_ID/vars")"; then
  FINAL_STATUS="variable_verification_failed"
  fail "Unable to read Terraform variables for '$EXPECTED_WORKSPACE_NAME'."
fi

variable_match_count="$(echo "$variables_response" | jq -r --arg variable_id "$TFC_VARIABLE_ID" '[.data[] | select(.id == $variable_id)] | length')"
if [[ "$variable_match_count" != "1" ]]; then
  FINAL_STATUS="variable_workspace_mismatch"
  fail "Variable '$TFC_VARIABLE_ID' was not found exactly once in '$EXPECTED_WORKSPACE_NAME'."
fi

variable_key="$(echo "$variables_response" | jq -r --arg variable_id "$TFC_VARIABLE_ID" '.data[] | select(.id == $variable_id) | .attributes.key // ""')"
if [[ "$variable_key" != "$EXPECTED_VARIABLE_KEY" ]]; then
  FINAL_STATUS="variable_key_mismatch"
  fail "Variable '$TFC_VARIABLE_ID' has key '$variable_key', expected '$EXPECTED_VARIABLE_KEY'."
fi

echo "Updating '$EXPECTED_VARIABLE_KEY' to '$IMAGE_REFERENCE'..."
update_var_payload="$(jq -cn \
  --arg variable_id "$TFC_VARIABLE_ID" \
  --arg value "$IMAGE_REFERENCE" \
  '{
    data: {
      id: $variable_id,
      type: "vars",
      attributes: {
        value: $value
      }
    }
  }')"

if ! tfc_request "PATCH" "/workspaces/$TFC_WORKSPACE_ID/vars/$TFC_VARIABLE_ID" "$update_var_payload" >/dev/null; then
  FINAL_STATUS="variable_update_failed"
  fail "Unable to update '$EXPECTED_VARIABLE_KEY'."
fi

echo "Variable updated successfully."
echo "Creating an auto-applied Terraform run for '$EXPECTED_WORKSPACE_NAME'..."
create_run_payload="$(jq -cn \
  --arg workspace_id "$TFC_WORKSPACE_ID" \
  --arg message "Deploy Kitsune $IMAGE_REFERENCE to staging" \
  '{
    data: {
      type: "runs",
      attributes: {
        message: $message,
        "auto-apply": true
      },
      relationships: {
        workspace: {
          data: {
            type: "workspaces",
            id: $workspace_id
          }
        }
      }
    }
  }')"

if ! run_response="$(tfc_request "POST" "/runs" "$create_run_payload")"; then
  FINAL_STATUS="run_create_failed"
  fail "Unable to create the Terraform run."
fi

IFS=$'\t' read -r RUN_ID RUN_URL < <(
  echo "$run_response" | jq -r \
    '[.data.id // "", (.data.links["self-html"] // .data.attributes."web-url" // "")] | @tsv'
)

if [[ -n "$RUN_URL" && "$RUN_URL" == /* ]]; then
  RUN_URL="$(to_absolute_tfc_url "$RUN_URL")"
fi
if [[ -z "$RUN_URL" && -n "$RUN_ID" ]]; then
  RUN_URL="$TFC_API_URL/runs/$RUN_ID"
fi

if [[ -z "$RUN_ID" ]]; then
  FINAL_STATUS="run_create_invalid_response"
  fail "Terraform run ID was not returned by the API."
fi

require_tfc_identifier "RUN_ID" "$RUN_ID"

echo "Terraform run created: $RUN_ID"
echo "Run URL: ${RUN_URL:-unavailable}"
echo "Run auto-apply mode: true"

last_status=""
start_epoch="$(date +%s)"

while true; do
  if ! run_state_json="$(tfc_request "GET" "/runs/$RUN_ID")"; then
    FINAL_STATUS="run_poll_failed"
    fail "Unable to read Terraform run status."
  fi

  IFS=$'\t' read -r status has_changes is_confirmable polled_run_url < <(
    echo "$run_state_json" | jq -r \
      '[.data.attributes.status // "unknown", (.data.attributes."has-changes" // "unknown"), (.data.attributes.actions."is-confirmable" // false | tostring), (.data.links["self-html"] // .data.attributes."web-url" // "")] | @tsv'
  )

  if [[ -z "$RUN_URL" && -n "$polled_run_url" ]]; then
    RUN_URL="$(to_absolute_tfc_url "$polled_run_url")"
  fi

  if [[ "$status" != "$last_status" ]]; then
    echo "Run status: $status (has_changes=$has_changes, is_confirmable=$is_confirmable)"
    last_status="$status"
  fi

  case "$status" in
    planned_and_finished)
      if [[ "$has_changes" == "false" || ( "$has_changes" == "unknown" && "$is_confirmable" != "true" ) ]]; then
        FINAL_STATUS="no_changes"
        echo "Run finished with no infrastructure changes."
        write_summary "No infrastructure changes were detected; apply was not required (has-changes=$has_changes, is-confirmable=$is_confirmable)."
        exit 0
      fi
      if [[ "$is_confirmable" == "true" ]]; then
        FINAL_STATUS="$status"
        fail "Run is awaiting manual confirmation even though auto-apply is enabled."
      fi
      FINAL_STATUS="$status"
      fail "Run planned changes but did not auto-apply (has-changes=$has_changes)."
      ;;
    applied)
      FINAL_STATUS="applied"
      echo "Terraform apply completed successfully."
      write_summary "Terraform run applied successfully."
      exit 0
      ;;
    policy_override)
      FINAL_STATUS="$status"
      fail "Terraform run requires a manual policy override, which is not allowed for this auto-apply deployment."
      ;;
    errored|canceled|force_canceled|discarded|policy_soft_failed|planned_and_erred|apply_errored)
      FINAL_STATUS="$status"
      fail "Terraform run failed with status '$status'."
      ;;
  esac

  now_epoch="$(date +%s)"
  elapsed="$((now_epoch - start_epoch))"
  if (( elapsed > DEPLOY_TIMEOUT_SECONDS )); then
    FINAL_STATUS="timeout"
    fail "Timed out after ${DEPLOY_TIMEOUT_SECONDS}s waiting for run '$RUN_ID'."
  fi

  sleep "$DEPLOY_POLL_INTERVAL_SECONDS"
done
