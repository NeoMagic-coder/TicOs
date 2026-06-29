#!/usr/bin/env bash
# Ticosclaw VPS deploy script.
# Run this ON the VPS, from inside the `web/` directory.
#
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requirements on the VPS:
#   - Docker + Docker Compose plugin (docker compose ...)
#   - A populated .env.local in this directory (Clerk, Supabase, OpenAI keys)
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found in $(pwd)" >&2
  echo "Copy .env.example to .env.local and fill in your keys first." >&2
  exit 1
fi

# Pull latest code if this is a git checkout (ignore failure for non-git copies).
if [ -d ../.git ]; then
  echo "==> Pulling latest code..."
  git -C .. pull --ff-only || echo "WARN: git pull skipped/failed; continuing with local files."
fi

echo "==> Building and starting container..."
# --env-file makes the NEXT_PUBLIC_* build args available for interpolation.
docker compose --env-file .env.local up -d --build

echo "==> Pruning old images..."
docker image prune -f >/dev/null 2>&1 || true

echo "==> Done. Container status:"
docker compose ps
echo
echo "Caddy is serving HTTPS on ports 80/443 for \$APP_DOMAIN (auto Let's Encrypt cert)."
echo "Make sure your domain's DNS A record points to this VPS, and ports 80 + 443 are open."
