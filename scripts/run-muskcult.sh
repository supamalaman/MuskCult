#!/usr/bin/env bash
# Start MuskCult (Vite) and open the browser.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-5173}"
URL="http://127.0.0.1:${PORT}/"

if curl -sf -o /dev/null "$URL"; then
  echo "MuskCult already running at $URL"
else
  echo "Starting MuskCult on $URL …"
  npm run dev -- --host 127.0.0.1 --port "$PORT" &
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null "$URL"; then
      break
    fi
    sleep 0.25
  done
fi

if command -v xdg-open >/dev/null; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null; then
  open "$URL" || true
fi

echo "MuskCult → $URL"
