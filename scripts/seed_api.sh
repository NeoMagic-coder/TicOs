#!/usr/bin/env bash
# Demo amaçlı API'ye birkaç istek atar; kabul kriterlerini el ile gözlemlemek için.
set -euo pipefail

API="${API_URL:-http://localhost:8000}"

echo "[seed] /health"
curl -sS "$API/health" | head -c 200; echo

echo "[seed] /api/v1/agents — kaç ajan?"
curl -sS "$API/api/v1/agents" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'

echo "[seed] /api/v1/tools?category=research"
curl -sS "$API/api/v1/tools?category=research" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'

echo "[seed] /api/v1/chat (örnek istek)"
curl -sS -X POST -H 'Content-Type: application/json' \
  "$API/api/v1/chat" \
  -d '{"message":"Yanmaz tencere kategorisine girmeli miyim?","history":[]}' \
  | python3 -m json.tool | head -20
