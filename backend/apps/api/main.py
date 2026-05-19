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
from apps.api.core.llm.provider import get_llm_provider
from apps.api.core.logging import get_logger, setup_logging
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentStatRow
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
from apps.api.core.scheduler import start_scheduler, stop_scheduler
from apps.api.routes import agents as agents_route
from apps.api.routes import approvals as approvals_route
from apps.api.routes import brand as brand_route
from apps.api.routes import chat as chat_route
from apps.api.routes import dashboard as dashboard_route
from apps.api.routes import demo as demo_route
from apps.api.routes import graph as graph_route
from apps.api.routes import grounding as grounding_route
from apps.api.routes import growth as growth_route
from apps.api.routes import integrations as integrations_route
from apps.api.routes import knowledge as knowledge_route
from apps.api.routes import llm as llm_route
from apps.api.routes import automations as automations_route
from apps.api.routes import goals as goals_route
from apps.api.routes import org as org_route
from apps.api.routes import policies as policies_route
from apps.api.routes import pricing as pricing_route
from apps.api.routes import products as products_route
from apps.api.routes import research as research_route
from apps.api.routes import rpc as rpc_route
from apps.api.routes import scheduler as scheduler_route
from apps.api.routes import skills as skills_route
from apps.api.routes import tasks as tasks_route
from apps.api.routes import tools as tools_route
from apps.api.routes import voice as voice_route
from apps.api.routes import webhooks as webhooks_route
from apps.api.tools.live import register_all as register_live_tools


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    setup_logging(debug=settings.debug)
    log = get_logger("oneproduct.boot")

    init_db()

    # Paperclip-style org chart seed (idempotent — only inserts missing rows).
    from apps.api.core.org import seed_default_org

    try:
        seed_default_org()
    except Exception as exc:  # never block boot on seed failure
        log.warning("org.seed.failed", error=str(exc)[:200])

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

    async def _knowledge_search_adapter(payload: dict[str, Any]) -> dict[str, Any]:
        product_id = payload.get("product_id")
        matches = await search_memory(
            query=payload["query"],
            k=int(payload.get("k") or 5),
            kind="doc",
        )
        if product_id:
            matches = [m for m in matches if m.get("metadata", {}).get("product_id") == product_id]
        results = [
            {
                "id": m["id"],
                "text": m["text"],
                "score": m["score"],
                "product_id": m.get("metadata", {}).get("product_id"),
            }
            for m in matches
        ]
        return {"results": results, "total": len(results)}

    register_live_adapter("knowledge_search", _knowledge_search_adapter)

    # Provider-specific live adapters (Phase 1: Shopify; rest are stubs).
    register_live_tools()

    # Phase 3: spawn_subagent live adapter — lets any agent delegate a subtask.
    from apps.api.core.hermes.subagent import get_subagent_runner

    async def _spawn_subagent_adapter(payload: dict[str, Any]) -> dict[str, Any]:
        runner = get_subagent_runner()
        output = await runner.run(
            message=payload["message"],
            agent_id=payload["agent_id"],
            parent_task_id=payload.get("parent_task_id") or "rpc",
            budget_usd=float(payload.get("budget_usd") or 0.05),
            product_context=payload.get("product_context") or {},
        )
        return {
            "child_task_id": f"sub_{id(output):x}",
            "status": output.status,
            "summary": output.summary or "",
            "confidence": output.confidence,
            "cost_usd": 0.0,
        }

    register_live_adapter("spawn_subagent", _spawn_subagent_adapter)

    # Periodic autonomous jobs (hourly ops sweep, daily pricing + reviews).
    start_scheduler(get_orchestrator())

    # Multi-platform gateway adapters (Phase 2-B). Each adapter is a no-op
    # when its credentials are absent, so missing env vars don't break boot.
    from apps.api.gateway.telegram import get_telegram_adapter
    from apps.api.gateway.discord import get_discord_adapter
    from apps.api.gateway.slack import get_slack_adapter
    from apps.api.gateway.whatsapp import get_whatsapp_adapter
    _gw_adapters = [get_telegram_adapter(), get_discord_adapter(), get_slack_adapter(), get_whatsapp_adapter()]
    for _gw in _gw_adapters:
        await _gw.start()

    log.info("boot.complete", tools=len(registry.all()), agents=len(agents.all()))
    yield
    for _gw in _gw_adapters:
        await _gw.stop()
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

    # Optional API key gate. No-op when settings.api_key is empty (local dev).
    if settings.api_key:
        from fastapi import Request
        from fastapi.responses import JSONResponse

        _EXEMPT_PATHS = ("/health", "/metrics", "/docs", "/openapi.json", "/redoc")

        @app.middleware("http")
        async def _api_key_gate(request: Request, call_next):
            path = request.url.path
            if path.startswith(_EXEMPT_PATHS) or request.method == "OPTIONS":
                return await call_next(request)
            if not path.startswith("/api/"):
                return await call_next(request)
            supplied = request.headers.get("x-api-key", "")
            if supplied != settings.api_key:
                return JSONResponse(
                    {"detail": "missing or invalid X-API-Key"}, status_code=401
                )
            return await call_next(request)

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

    @app.get("/api/v1/images", tags=["images"])
    async def list_images() -> list[dict]:
        """Return metadata for every file stored in _images/."""
        items = []
        for p in sorted(IMAGES_DIR.iterdir(), key=lambda f: f.stat().st_mtime, reverse=True):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                stat = p.stat()
                items.append({
                    "filename": p.name,
                    "url": f"/images/{p.name}",
                    "size_bytes": stat.st_size,
                    "created_at": stat.st_mtime,
                })
        return items

    app.include_router(chat_route.router, prefix="/api/v1")
    app.include_router(agents_route.router, prefix="/api/v1")
    app.include_router(tools_route.router, prefix="/api/v1")
    app.include_router(tasks_route.router, prefix="/api/v1")
    app.include_router(approvals_route.router, prefix="/api/v1")
    app.include_router(knowledge_route.router, prefix="/api/v1")
    app.include_router(scheduler_route.router, prefix="/api/v1")
    app.include_router(automations_route.router, prefix="/api/v1")
    app.include_router(rpc_route.router, prefix="/api/v1")
    app.include_router(research_route.router, prefix="/api/v1")
    app.include_router(skills_route.router, prefix="/api/v1")
    app.include_router(brand_route.router, prefix="/api/v1")
    app.include_router(pricing_route.router, prefix="/api/v1")
    app.include_router(grounding_route.router, prefix="/api/v1")
    app.include_router(products_route.router, prefix="/api/v1")
    app.include_router(growth_route.router, prefix="/api/v1")
    app.include_router(policies_route.router, prefix="/api/v1")
    app.include_router(policies_route.autonomy_router, prefix="/api/v1")
    app.include_router(dashboard_route.router, prefix="/api/v1")
    app.include_router(demo_route.router, prefix="/api/v1")
    app.include_router(graph_route.router, prefix="/api/v1")
    app.include_router(integrations_route.router, prefix="/api/v1")
    app.include_router(org_route.router, prefix="/api/v1")
    app.include_router(goals_route.router, prefix="/api/v1")
    app.include_router(llm_route.router, prefix="/api/v1")
    app.include_router(webhooks_route.router)  # /webhooks/*  (no /api/v1 prefix)
    app.include_router(voice_route.router)     # /ws/voice    (websocket, no prefix)

    @app.get("/api/v1/backends", tags=["system"])
    async def list_backends() -> list[dict[str, Any]]:
        """Return all registered execution backends with health status."""
        from apps.api.core.backends.registry import health_check_all
        return await health_check_all()

    @app.get("/api/v1/analytics/costs", tags=["analytics"])
    async def analytics_costs() -> dict[str, Any]:
        """Return cumulative tool cost by agent from AgentStatRow."""
        from sqlalchemy import select as _select
        rows: list[dict[str, Any]] = []
        total = 0.0
        with session_scope() as s:
            for row in s.execute(_select(AgentStatRow)).scalars().all():
                cost = round(row.total_cost_usd or 0.0, 6)
                rows.append({
                    "agent_id": row.agent_id,
                    "total_cost_usd": cost,
                    "tasks_total": row.tasks_total,
                })
                total += cost
        rows.sort(key=lambda r: r["total_cost_usd"], reverse=True)
        return {"agents": rows, "grand_total_usd": round(total, 6)}

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
            "llm": type(get_llm_provider()).__name__.replace("Provider", "").lower(),
            "_dbg_provider_class": type(get_llm_provider()).__name__,
            "_dbg_llm_provider_setting": get_settings().llm_provider,
            "_dbg_gemini_key_set": bool(get_settings().gemini_api_key),
        }

    return app


app = create_app()
