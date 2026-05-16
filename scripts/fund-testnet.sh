#!/usr/bin/env bash
set -euo pipefail

SOURCE="${STELLAR_SOURCE_KEY:-alice}"
ADDRESS="$(stellar keys address "$SOURCE")"

curl -s "https://friendbot.stellar.org?addr=$ADDRESS"
printf "\nFunded %s on Stellar Testnet\n" "$ADDRESS"
