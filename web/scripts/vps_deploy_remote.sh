#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/ticosclaw/web
DOMAIN=ticosclaw.neomagic.org
ACME_EMAIL=admin@neomagic.org

echo "==> Preparing $APP_DIR"
mkdir -p "$APP_DIR"
tar -xzf /tmp/ticosclaw_web.tar.gz -C "$APP_DIR"
cd "$APP_DIR"

echo "==> Setting deploy env vars in .env.local (authoritative)"
touch .env.local
# Drop any previous deploy-managed values, then set the current ones.
sed -i '/^APP_DOMAIN=/d;/^ACME_EMAIL=/d' .env.local
echo "APP_DOMAIN=$DOMAIN" >> .env.local
echo "ACME_EMAIL=$ACME_EMAIL" >> .env.local

echo "==> .env.local domain config:"
grep -E '^(APP_DOMAIN|ACME_EMAIL)=' .env.local

echo "==> Building and starting containers (this may take several minutes)"
docker compose --env-file .env.local up -d --build

echo "==> Pruning old images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Container status:"
docker compose --env-file .env.local ps
