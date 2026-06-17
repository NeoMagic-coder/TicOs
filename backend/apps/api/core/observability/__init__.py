"""Observability: OpenTelemetry tracing + Prometheus metrics.

Public API:
    setup_telemetry(app)        # call from FastAPI lifespan / create_app
    metrics_endpoint()          # ASGI/HTTP handler exposing /metrics
    REQUEST_DURATION, REQUEST_ERRORS, TOOL_COST_USD, TOOL_DURATION,
    TOOL_INVOCATIONS, LLM_TOKENS, LLM_REQUESTS, TASK_DURATION,
    TASK_CONFIDENCE, AGENT_DURATION  — Prometheus instruments.
    get_tracer()                # returns OTel tracer (no-op when disabled)
"""
from __future__ import annotations

from apps.api.core.observability.telemetry import (
    AGENT_DURATION,
    CRITIC_SCORES,
    LLM_REQUESTS,
    LLM_TOKENS,
    REQUEST_DURATION,
    REQUEST_ERRORS,
    TASK_CONFIDENCE,
    TASK_DURATION,
    TOOL_COST_USD,
    TOOL_DURATION,
    TOOL_INVOCATIONS,
    get_tracer,
    metrics_endpoint,
    setup_telemetry,
)

__all__ = [
    "AGENT_DURATION",
    "CRITIC_SCORES",
    "LLM_REQUESTS",
    "LLM_TOKENS",
    "REQUEST_DURATION",
    "REQUEST_ERRORS",
    "TASK_CONFIDENCE",
    "TASK_DURATION",
    "TOOL_COST_USD",
    "TOOL_DURATION",
    "TOOL_INVOCATIONS",
    "get_tracer",
    "metrics_endpoint",
    "setup_telemetry",
]
