#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/frontend"

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

npm run build
cd "$ROOT"
firebase deploy --only hosting
