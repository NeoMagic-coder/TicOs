# Production frontend image. Build context: repo root.
#
#   docker build -f docker/frontend.Dockerfile -t oneproduct-web .
#   docker run -p 8080:80 oneproduct-web
#
# Build-time env vars for the Vite bundle:
#   --build-arg VITE_API_BASE_URL=https://api.example.com
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=""
ARG VITE_GEMINI_MODEL="gemini-2.5-flash-lite"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GEMINI_MODEL=$VITE_GEMINI_MODEL

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# --- Runtime: nginx serving the static dist/ directory ---
FROM nginx:1.27-alpine

# Replace the default Nginx config with the SPA-aware one (try_files →
# index.html). The repo's `frontend/nginx.conf` is the compose-mode reverse
# proxy and doesn't fit a standalone static server.
COPY docker/nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
