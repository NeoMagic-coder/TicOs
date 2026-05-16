#!/usr/bin/env bash
# Run frontend + API in parallel for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f ".env.local" ]; then
  cat >&2 <<EOF
[dev] .env.local bulunamadı. Frontend Gemini olmadan çalışır (mock yanıtlar).
[dev] Anahtar eklemek için:
    echo 'VITE_GEMINI_API_KEY=AIza...' > .env.local
EOF
fi

if [ ! -d "node_modules" ]; then
  echo "[dev] npm install çalıştırılıyor..."
  npm install
fi

API_PID=""
WEB_PID=""

cleanup() {
  echo
  echo "[dev] durdurluyor..."
  if [ -n "$API_PID" ]; then kill "$API_PID" 2>/dev/null || true; fi
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

PYTHON_BIN="${PYTHON:-python3}"
if "$PYTHON_BIN" -c "import fastapi" >/dev/null 2>&1; then
  echo "[dev] API başlatılıyor → http://localhost:8000"
  "$PYTHON_BIN" -m uvicorn apps.api.main:app --reload --port 8000 &
  API_PID=$!
else
  echo "[dev] FastAPI kurulu değil — API başlatılmadı."
  echo "[dev]   Kurmak için: pip install -r apps/api/requirements.txt"
fi

echo "[dev] Vite dev server başlatılıyor → http://localhost:5173"
npm run dev &
WEB_PID=$!

wait
