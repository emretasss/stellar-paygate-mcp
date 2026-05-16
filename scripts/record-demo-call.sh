#!/usr/bin/env bash
set -euo pipefail

NETWORK="${STELLAR_NETWORK_NAME:-testnet}"
SOURCE="${STELLAR_SOURCE_KEY:-alice}"
CONTRACT_ID="${PAYGATE_CONTRACT_ID:?Set PAYGATE_CONTRACT_ID first}"
GATEWAY="${PAYGATE_GATEWAY_ADDRESS:-$(stellar keys address "$SOURCE")}"
PAYER="${PAYGATE_PAYER_ADDRESS:-$GATEWAY}"

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- record_call \
  --gateway "$GATEWAY" \
  --tool_id "${PAYGATE_TOOL_ID:-1}" \
  --payer "$PAYER" \
  --amount "${PAYGATE_AMOUNT:-100000}" \
  --payment_tx_hash "${PAYGATE_PAYMENT_TX_HASH:-demo-mpp-payment-001}" \
  --request_hash "${PAYGATE_REQUEST_HASH:-sha256:demo-request}" \
  --response_hash "${PAYGATE_RESPONSE_HASH:-sha256:demo-response}"
