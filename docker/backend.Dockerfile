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
RUN pip install -r /app/apps/api/requirements.txt

COPY --chown=appuser:appuser backend/apps /app/apps

# SQLite DB lives under apps/api/data — give the user write access to that
# path so init_db can create the file.
RUN mkdir -p /app/apps/api/data && chown -R appuser:appuser /app/apps/api/data

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).status == 200 else 1)"

# Production: 2 uvicorn workers, no --reload. Override CMD for dev with
# `--reload --workers 1` when needed.
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
