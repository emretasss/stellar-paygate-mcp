#!/usr/bin/env bash
set -euo pipefail

NETWORK="${STELLAR_NETWORK_NAME:-testnet}"
SOURCE="${STELLAR_SOURCE_KEY:-alice}"
CONTRACT_ID="${PAYGATE_CONTRACT_ID:?Set PAYGATE_CONTRACT_ID first}"
PROVIDER="${PAYGATE_PROVIDER_ADDRESS:-$(stellar keys address "$SOURCE")}"

register_tool() {
  local name="$1"
  local category="$2"
  local price="$3"
  local metadata_hash="$4"

  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- register_tool \
    --provider "$PROVIDER" \
    --name "$name" \
    --category "$category" \
    --price "$price" \
    --metadata_hash "$metadata_hash" \
    --bond_amount 0
}

register_tool "Invoice Risk Score" "risk" "100000" "sha256:7d10d7f9f17e-invoice-risk"
register_tool "RWA Yield Brief" "rwa" "150000" "sha256:9a53f01d2f4c-rwa-brief"
register_tool "Stellar Grant Fit Check" "grant" "200000" "sha256:36e7f8aa9154-grant-fit"
