# Production backend image. Build context: repo root (so apps/ is at /app/apps).
#
#   docker build -f docker/backend.Dockerfile -t oneproduct-api .
#   docker run -p 8000:8000 --env-file .env.local oneproduct-api
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --chown=appuser:appuser backend/apps/api/requirements.txt /app/apps/api/requirements.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ \
    && pip install -r /app/apps/api/requirements.txt \
    && apt-get purge -y gcc g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=appuser:appuser backend/apps /app/apps
COPY --chown=appuser:appuser docker/cloudrun-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Development SQLite and generated AutoResearch reports need writable paths.
RUN mkdir -p /app/apps/api/data /app/apps/api/autoresearch/reports /tmp \
    && chown -R appuser:appuser /app/apps/api/data /app/apps/api/autoresearch/reports

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request, sys; port=os.environ.get('PORT','8000'); sys.exit(0 if urllib.request.urlopen(f'http://localhost:{port}/health', timeout=3).status == 200 else 1)"

# Cloud Run sets PORT; local docker still defaults to 8000.
ENTRYPOINT ["/entrypoint.sh"]
