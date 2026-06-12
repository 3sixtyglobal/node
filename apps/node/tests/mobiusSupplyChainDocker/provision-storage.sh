#!/usr/bin/env bash
# =============================================================================
# provision-storage.sh — OBSOLETE (kept as a signpost)
# =============================================================================
# This script used to create the IOTA StorageItem backing the synchronised-
# storage catalogue replication (sync pointers via IPFS + verifiable storage).
#
# Post-#194 ("federated catalogue trust mode") that whole mechanism was REMOVED
# from node-core: there is no verifiable-storage REST surface on the node any
# more (POST /verifiable → routeNotFound) and no TWIN_SYNCHRONISED_STORAGE_*
# wiring. Cross-node discovery now works by pointing each consumer's federated
# catalogue component at the publisher via
#   TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT="http://twin-mobius:3000"
# (see env/*.env), with trust-token auth on the wire.
#
# Flow is now simply:
#   ./setup.sh [--clean]
#   docker compose up -d twin-mobius twin-ashford twin-suffolk twin-mcp
#   ./mobius-test.sh '<mobius-pw>' '<ashford-pw>' '<suffolk-pw>' '<mcp-pw>'
# =============================================================================

echo "provision-storage.sh is obsolete post-#194/#203 — nothing to do."
echo "Consumers reach the publisher's catalogue via TWIN_FEDERATED_CATALOGUE_REMOTE_ENDPOINT."
exit 0
