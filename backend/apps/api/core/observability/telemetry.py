"""OpenTelemetry + Prometheus wiring.

Tracing: OTLP/HTTP exporter (Tempo via OTel Collector by default).
Logs:    structlog already emits JSON to stdout; Promtail/Loki scrapes it.
Metrics: Prometheus client, exposed at /metrics (multiprocess-safe via the
default REGISTRY — the API runs uvicorn workers single-process by default).

Everything degrades gracefully when OTel deps aren't installed or
``otel_enabled`` is false in settings; in that case ``setup_telemetry`` is a
no-op and ``get_tracer`` returns a no-op tracer.
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    REGISTRY,
    Counter,
    Histogram,
    generate_latest,
)

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Prometheus instruments
# ---------------------------------------------------------------------------
# Latency buckets tuned for an LLM-heavy backend: sub-second for cached/mock
# paths, multi-second for Gemini, up to 60s for full multi-agent runs.
_LATENCY_BUCKETS = (
    0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 20.0, 30.0, 60.0,
)
_COST_BUCKETS = (
    0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0,
)


def _counter(name: str, doc: str, labels: tuple[str, ...]) -> Counter:
    try:
        return Counter(name, doc, labels)
    except ValueError:
        # Already registered (e.g. uvicorn --reload). Reuse existing.
        return REGISTRY._names_to_collectors[name]  # type: ignore[attr-defined,return-value]


def _histogram(
    name: str, doc: str, labels: tuple[str, ...], buckets: tuple[float, ...]
) -> Histogram:
    try:
        return Histogram(name, doc, labels, buckets=buckets)
    except ValueError:
        return REGISTRY._names_to_collectors[name]  # type: ignore[attr-defined,return-value]


REQUEST_DURATION = _histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds.",
    ("method", "route", "status"),
    _LATENCY_BUCKETS,
)
REQUEST_ERRORS = _counter(
    "http_request_errors_total",
    "HTTP requests with 5xx status.",
    ("method", "route", "status"),
)

TOOL_INVOCATIONS = _counter(
    "openclaw_tool_invocations_total",
    "OpenClaw tool invocations by tool/agent/status.",
    ("tool_id", "agent_id", "status"),
)
TOOL_DURATION = _histogram(
    "openclaw_tool_duration_seconds",
    "OpenClaw tool execution duration.",
    ("tool_id", "status"),
    _LATENCY_BUCKETS,
)
TOOL_COST_USD = _histogram(
    "openclaw_tool_cost_usd",
    "Per-invocation tool cost in USD.",
    ("tool_id",),
    _COST_BUCKETS,
)

LLM_REQUESTS = _counter(
    "llm_requests_total",
    "LLM provider requests by provider/model/status.",
    ("provider", "model", "status"),
)
LLM_TOKENS = _counter(
    "llm_tokens_total",
    "LLM tokens used by provider/model.",
    ("provider", "model"),
)

TASK_DURATION = _histogram(
    "hermes_task_duration_seconds",
    "Hermes end-to-end task duration.",
    ("status",),
    _LATENCY_BUCKETS,
)
TASK_CONFIDENCE = _histogram(
    "hermes_task_confidence",
    "Final orchestrator confidence score.",
    ("escalated",),
    (0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
)
AGENT_DURATION = _histogram(
    "hermes_agent_duration_seconds",
    "Per-agent run duration.",
    ("agent_id", "status"),
    _LATENCY_BUCKETS,
)


# ---------------------------------------------------------------------------
# Tracing
# ---------------------------------------------------------------------------
_tracer: Any = None
_otel_ready: bool = False


def get_tracer() -> Any:
    """Return an OTel tracer if available; else a no-op shim."""
    global _tracer
    if _tracer is not None:
        return _tracer
    try:
        from opentelemetry import trace

        _tracer = trace.get_tracer("oneproduct.api")
    except Exception:
        _tracer = _NoopTracer()
    return _tracer


class _NoopSpan:
    def __enter__(self) -> "_NoopSpan":
        return self

    def __exit__(self, *exc: Any) -> None:
        return None

    def set_attribute(self, *_: Any, **__: Any) -> None:
        return None

    def record_exception(self, *_: Any, **__: Any) -> None:
        return None


class _NoopTracer:
    def start_as_current_span(self, *_: Any, **__: Any) -> _NoopSpan:
        return _NoopSpan()


def setup_telemetry(app: FastAPI) -> None:
    """Install OTel tracing + FastAPI instrumentation. Safe to call once."""
    global _otel_ready
    if _otel_ready:
        return
    settings = get_settings()
    if not settings.otel_enabled:
        log.info("otel.disabled")
        _otel_ready = True
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except Exception as exc:
        log.warning("otel.import_failed", error=str(exc)[:200])
        _otel_ready = True
        return

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.version": "0.1.0",
            "deployment.environment": settings.environment,
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls="/metrics,/health",
    )

    # Optional: httpx instrumentation if available (covers Gemini SDK transport).
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except Exception:
        pass

    _otel_ready = True
    log.info(
        "otel.ready",
        endpoint=settings.otel_exporter_otlp_endpoint,
        service=settings.otel_service_name,
    )


# ---------------------------------------------------------------------------
# /metrics endpoint
# ---------------------------------------------------------------------------
def metrics_endpoint() -> Response:
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
