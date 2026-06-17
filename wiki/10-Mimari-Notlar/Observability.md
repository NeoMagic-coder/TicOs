# Observability

**Konum:** `backend/apps/api/core/observability/telemetry.py`

- OpenTelemetry traces + Prometheus metrics.
- Yerel stack opsiyonel: `docker/compose.observability.yml` (Prometheus + Grafana).
- Logging standardı: `apps.api.core.logging.get_logger(__name__)` (structlog). Event isimleri dotted lowercase — örn. `hermes.task.created`, `openclaw.permission_denied`, `agent_budget_exhausted`.
