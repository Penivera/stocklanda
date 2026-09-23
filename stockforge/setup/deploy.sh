#!/usr/bin/env bash
# Build and deploy the StockForge program to the local validator.
# Run from anywhere:  bash stockforge/setup/deploy.sh
set -euo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

solana config set --url http://127.0.0.1:8899 >/dev/null 2>&1

echo "== anchor build =="
anchor build

echo "== anchor deploy =="
anchor deploy --provider.cluster localnet

PROGRAM_ID="E4t7DUwrLKgxpGb88686DtqrRqnHd5GCKE3ASwR8SCwi"
echo "== program =="
solana program show "$PROGRAM_ID" | head -12
