#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Levantando SAT Escolar (servicio único)..."
echo "App + API: http://127.0.0.1:3000"
echo ""

cd "$ROOT_DIR"

cleanup() {
  echo ""
  echo "Deteniendo servidor..."
  kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

npm --prefix "Sat Escolar Backend" start &
BACKEND_PID=$!

wait