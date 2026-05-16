"""FastAPI entrypoint for OneProduct Agent OS.

Run locally:
    uvicorn apps.api.main:app --reload --port 8000

Docs:
    http://localhost:8000/docs
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from apps.api.agents.registry import get_agent_registry
from apps.api.core.config import get_settings
from apps.api.core.db import init_db
from apps.api.core.llm.image import IMAGES_DIR, generate_image
from apps.api.core.logging import get_logger, setup_logging
from apps.api.core.memory.store import search_memory
from apps.api.core.observability import (
    REQUEST_DURATION,
    REQUEST_ERRORS,
    metrics_endpoint,
    setup_telemetry,
)
from apps.api.core.hermes.orchestrator import get_orchestrator
from apps.api.core.openclaw.executor import register_live_adapter
from apps.api.core.openclaw.registry import get_registry
from apps.api.core.scheduler import scheduler_status, start_scheduler, stop_scheduler, trigger_job_now
from apps.api.routes import agents as agents_route
from apps.api.routes import approvals as approvals_route
from apps.api.routes import chat as chat_route
from apps.api.routes import knowledge as knowledge_route
from apps.api.routes import tasks as tasks_route
from apps.api.routes import tools as tools_route
from apps.api.routes import webhooks as webhooks_route
from apps.api.tools.live import register_all as register_live_tools


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    setup_logging(debug=settings.debug)
    log = get_logger("oneproduct.boot")

    init_db()

    registry = get_registry()
    registry.load_manifests()
    agents = get_agent_registry()

    register_live_adapter(
        "brand_visual_generator",
        lambda payload: generate_image(
            prompt=payload["prompt"],
            model=payload.get("model") or "gemini-3-pro-image-preview",
        ),
    )

    async def _memory_search_adapter(payload: dict[str, Any]) -> dict[str, Any]:
        matches = await search_memory(
            query=payload["query"],
            k=int(payload.get("k") or 5),
            kind=payload.get("kind"),
        )
        return {"matches": matches}

    register_live_adapter("memory_search", _memory_search_adapter)

    # Provider-specific live adapters (Phase 1: Shopify; rest are stubs).
    register_live_tools()

    # Periodic autonomous jobs (hourly ops sweep, daily pricing + reviews).
    start_scheduler(get_orchestrator())

    log.info("boot.complete", tools=len(registry.all()), agents=len(agents.all()))
    yield
    stop_scheduler()
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Hermes orchestration + OpenClaw tool-use backend.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    setup_telemetry(app)

    @app.middleware("http")
    async def _prom_request_timing(request, call_next):
        import time

        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or request.url.path
        start = time.monotonic()
        status_code = "500"
        try:
            response = await call_next(request)
            status_code = str(response.status_code)
            return response
        finally:
            dur = time.monotonic() - start
            REQUEST_DURATION.labels(
                method=request.method, route=route_path, status=status_code
            ).observe(dur)
            if status_code.startswith("5"):
                REQUEST_ERRORS.labels(
                    method=request.method, route=route_path, status=status_code
                ).inc()

    @app.get("/metrics", include_in_schema=False)
    async def _metrics():
        return metrics_endpoint()

    app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

    app.include_router(chat_route.router, prefix="/api/v1")
    app.include_router(agents_route.router, prefix="/api/v1")
    app.include_router(tools_route.router, prefix="/api/v1")
    app.include_router(tasks_route.router, prefix="/api/v1")
    app.include_router(approvals_route.router, prefix="/api/v1")
    app.include_router(knowledge_route.router, prefix="/api/v1")
    app.include_router(webhooks_route.router)  # /webhooks/*  (no /api/v1 prefix)

    @app.get("/api/v1/scheduler", tags=["system"])
    async def _scheduler_status() -> dict[str, Any]:
        return scheduler_status()

    @app.post("/api/v1/scheduler/{job_id}/run", tags=["system"])
    async def _scheduler_run(job_id: str) -> dict[str, Any]:
        return await trigger_job_now(job_id)

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, Any]:
        agents = get_agent_registry()
        tools = get_registry()
        return {
            "status": "ok",
            "app": settings.app_name,
            "environment": settings.environment,
            "agents": len(agents.all()),
            "tools": len(tools.all()),
            "llm": "gemini" if settings.gemini_api_key else "mock",
        }

    return app


app = create_app()
