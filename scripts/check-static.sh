#!/usr/bin/env bash
# Tüm doğrulama adımlarını çalıştırır: lint olmayan kontroller + testler.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON:-}"
if [ -z "$PYTHON_BIN" ]; then
  if [ -x "$ROOT/backend/.venv/bin/python3" ]; then
    PYTHON_BIN="$ROOT/backend/.venv/bin/python3"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    PYTHON_BIN="python"
  fi
fi

if ! "$PYTHON_BIN" -c "import fastapi" >/dev/null 2>&1; then
  if [ ! -x "$ROOT/backend/.venv/bin/python3" ]; then
    echo "[check] Python venv kuruluyor (backend/.venv)…"
    python3 -m venv "$ROOT/backend/.venv"
  fi
  PYTHON_BIN="$ROOT/backend/.venv/bin/python3"
  if ! "$PYTHON_BIN" -c "import fastapi, pytest" >/dev/null 2>&1; then
    "$PYTHON_BIN" -m pip install -r "$ROOT/backend/apps/api/requirements.txt" -q
  fi
fi

if "$PYTHON_BIN" -c "import fastapi, pytest" >/dev/null 2>&1; then
  HAS_PY_DEPS=1
else
  HAS_PY_DEPS=0
fi

echo "[check] Frontend tip kontrolü (tsc -p)…"
(cd frontend && npx tsc --noEmit)

echo "[check] Frontend build…"
(cd frontend && npm run build >/dev/null)

if [ "$HAS_PY_DEPS" -eq 1 ]; then
  echo "[check] Python testleri…"
  (cd backend && "$PYTHON_BIN" -m pytest apps/api/tests -q)
else
  echo "[check] Python bağımlılıkları yok, testler atlandı."
  echo "[check]   Kurmak için: cd backend && pip install -r apps/api/requirements.txt"
fi

echo "[check] tüm kontroller geçti ✅"
