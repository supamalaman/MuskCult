#!/bin/zsh
set -euo pipefail

# Drop this repo at ~/Documents/Apps/MuskCult (same pattern as Four-Panel),
# then double-click this file — or launch via Macro Launch.

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/../package.json" ]]; then
  APP_ROOT="$ROOT/.."
else
  APP_ROOT="$ROOT"
fi

cd "$APP_ROOT"
python3 "$APP_ROOT/macro-launch/app.py"
