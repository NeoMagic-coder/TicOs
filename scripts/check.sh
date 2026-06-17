#!/usr/bin/env bash
# Hackathon ön-uçuş kontrolü.
#
# Servisleri docker-compose ile ayağa kaldırır, health endpoint'lerine
# basar, Playwright smoke + MockProvider fallback testlerini çalıştırır.
# Tüm çıktı `logs/check.log`'a düşer; konsola sadece özet basar.
#
# Önceki "tsc + vite build + pytest" kontrolü için: scripts/check-static.sh
#
# Çalıştırma (repo kökünden):
#   bash scripts/check.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p logs
LOG="$ROOT/logs/check.log"
: > "$LOG"

COMPOSE_FILE="docker/compose.yml"
FAILED=()

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }
run() {
  # run <label> <command...>  — exit code captured, output tee'lenir.
  local label="$1"; shift
  log ">>> $label"
  if "$@" >>"$LOG" 2>&1; then
    log "    ✓ $label"
    return 0
  else
    local rc=$?
    log "    ✗ $label (exit $rc)"
    FAILED+=("$label")
    return $rc
  fi
}

# docker compose hem yeni (`docker compose`) hem eski (`docker-compose`)
# CLI ile uyumlu çalışsın.
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose -f "$COMPOSE_FILE")
elif docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose -f "$COMPOSE_FILE")
else
  log "✗ docker compose CLI bulunamadı — kontrol durduruluyor."
  echo "❌ docker compose yok" | tee -a "$LOG"
  exit 1
fi

# 1) Servisleri ayağa kaldır
run "docker compose up -d" "${COMPOSE[@]}" up -d

# Health-check'ler için kısa bir warmup (servislerin uvicorn/vite'i bootlaması).
log "    servislerin hazır olması için 20s bekleniyor…"
sleep 20

# 2) Backend health
run "backend /health (curl 8000)" \
  curl --silent --show-error --fail --max-time 10 http://localhost:8000/health

# 3) Frontend health (Vite dev server köke 200 döner)
run "frontend / (curl 5173)" \
  curl --silent --show-error --fail --max-time 10 http://localhost:5173

# 4) Playwright smoke — demo senaryosunun kritik adımları
if command -v npx >/dev/null 2>&1; then
  run "playwright smoke" \
    bash -c "cd '$ROOT/frontend' && CI=1 npx playwright test smoke.spec.ts --reporter=list"
else
  log "✗ npx bulunamadı, playwright atlandı"
  FAILED+=("playwright smoke (npx yok)")
fi

# 5) MockProvider fallback testi
PY="${PYTHON:-python3}"
run "MockProvider fallback" "$PY" scripts/test_mock_fallback.py

# ── Sonuç özeti ───────────────────────────────────────────────────────────────
echo "" | tee -a "$LOG"
if [ "${#FAILED[@]}" -eq 0 ]; then
  echo "✅ Hackathon hazır" | tee -a "$LOG"
  exit 0
else
  echo "❌ Kontrol başarısız — düşen adımlar:" | tee -a "$LOG"
  for step in "${FAILED[@]}"; do
    echo "   - $step" | tee -a "$LOG"
  done
  echo "" | tee -a "$LOG"
  echo "Detaylı log: $LOG" | tee -a "$LOG"
  exit 1
fi
