#!/usr/bin/env bash
set -euo pipefail

NETWORK="${STELLAR_NETWORK_NAME:-testnet}"
SOURCE="${STELLAR_SOURCE_KEY:-alice}"
FEE_BPS="${PAYGATE_FEE_BPS:-250}"
TOKEN="${PAYGATE_TOKEN_CONTRACT:-CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA}"
WASM="${PAYGATE_WASM:-target/wasm32v1-none/release/paygate_registry.wasm}"

cargo build --target wasm32v1-none --release -p paygate-registry

ADMIN_ADDRESS="${PAYGATE_ADMIN_ADDRESS:-$(stellar keys address "$SOURCE")}"
GATEWAY_ADDRESS="${PAYGATE_GATEWAY_ADDRESS:-$ADMIN_ADDRESS}"

CONTRACT_ID="$(
  stellar contract deploy \
    --wasm "$WASM" \
    --source "$SOURCE" \
    --network "$NETWORK" \
  | tail -n 1
)"

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- init \
  --admin "$ADMIN_ADDRESS" \
  --token "$TOKEN" \
  --gateway "$GATEWAY_ADDRESS" \
  --fee_bps "$FEE_BPS"

printf "PAYGATE_CONTRACT_ID=%s\n" "$CONTRACT_ID"
printf "PAYGATE_GATEWAY_ADDRESS=%s\n" "$GATEWAY_ADDRESS"
