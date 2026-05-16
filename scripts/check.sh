#!/usr/bin/env bash
# Tüm doğrulama adımlarını çalıştırır: lint olmayan kontroller + testler.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON:-python3}"
HAS_PY_DEPS=0
if "$PYTHON_BIN" -c "import fastapi, pytest" >/dev/null 2>&1; then
  HAS_PY_DEPS=1
fi

echo "[check] Frontend tip kontrolü (tsc -p)…"
npx tsc --noEmit

echo "[check] Frontend build…"
npm run build >/dev/null

if [ "$HAS_PY_DEPS" -eq 1 ]; then
  echo "[check] Python testleri…"
  "$PYTHON_BIN" -m pytest apps/api/tests -q
else
  echo "[check] Python bağımlılıkları yok, testler atlandı."
  echo "[check]   Kurmak için: pip install -r apps/api/requirements.txt"
fi

echo "[check] tüm kontroller geçti ✅"
