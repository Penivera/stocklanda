#!/usr/bin/env bash
# Reset and start a local Solana validator for StockForge, then fund the CLI
# wallet. Run from anywhere:  bash stockforge/setup/start_localnet.sh
set -euo pipefail

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"

LEDGER="${STOCKFORGE_LEDGER:-$HOME/stockforge-ledger}"
LOG="${STOCKFORGE_VALIDATOR_LOG:-$HOME/stockforge-validator.log}"
RPC="http://127.0.0.1:8899"

echo "== stopping any existing validator =="
pkill -f solana-test-validator 2>/dev/null || true
sleep 2

echo "== starting validator (ledger: $LEDGER) =="
rm -rf "$LEDGER"
setsid nohup solana-test-validator --ledger "$LEDGER" --reset --quiet > "$LOG" 2>&1 &

echo "== waiting for RPC =="
for _ in $(seq 1 30); do
  if solana --url "$RPC" cluster-version >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

solana config set --url "$RPC" >/dev/null 2>&1
echo "== funding CLI wallet =="
solana airdrop 100 >/dev/null 2>&1 || true
solana balance
