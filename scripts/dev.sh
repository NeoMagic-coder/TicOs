#!/usr/bin/env bash
# Run frontend + API in parallel for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f "frontend/.env.local" ] && [ ! -f "env/.env.local" ]; then
  cat >&2 <<EOF
[dev] .env.local bulunamadi. Backend mock yanitlarla calisabilir.
[dev] Bedrock icin:
    cp backend/.env.example backend/.env.local   # veya AWS_BEARER_TOKEN_BEDROCK ekle
EOF
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "[dev] npm install calistiriliyor..."
  (cd frontend && npm install)
fi

API_PID=""
WEB_PID=""

cleanup() {
  echo
  echo "[dev] durduruluyor..."
  if [ -n "$API_PID" ]; then kill "$API_PID" 2>/dev/null || true; fi
  if [ -n "$WEB_PID" ]; then kill "$WEB_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

PYTHON_BIN="${PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  if [ -x "$ROOT/backend/.venv/bin/python3" ]; then
    PYTHON_BIN="$ROOT/backend/.venv/bin/python3"
  elif command -v python3.12 >/dev/null 2>&1; then
    PYTHON_BIN="python3.12"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    PYTHON_BIN="python"
  fi
fi

if ! "$PYTHON_BIN" -c "import fastapi" >/dev/null 2>&1; then
  echo "[dev] Python venv kuruluyor (backend/.venv, python3.12)..."
  python3.12 -m venv "$ROOT/backend/.venv"
  PYTHON_BIN="$ROOT/backend/.venv/bin/python3"
  "$PYTHON_BIN" -m pip install -r "$ROOT/backend/apps/api/requirements.txt" -q
fi

if "$PYTHON_BIN" -c "import fastapi" >/dev/null 2>&1; then
  echo "[dev] API baslatiliyor -> http://localhost:8000"
  cd backend && "$PYTHON_BIN" -m uvicorn apps.api.main:app --reload --port 8000 &
  API_PID=$!
  cd "$ROOT"
else
  echo "[dev] FastAPI kurulu degil — API baslatilmadi."
  echo "[dev]   Kurmak icin: cd backend && python3 -m venv .venv && .venv/bin/pip install -r apps/api/requirements.txt"
fi

echo "[dev] Vite dev server baslatiliyor -> http://localhost:5173"
(cd frontend && npm run dev) &
WEB_PID=$!

wait
