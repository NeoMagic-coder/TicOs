"""API router registration.

Keeping the route inventory here leaves the application factory focused on
application-wide middleware, static files, and system endpoints.
"""
from __future__ import annotations

from fastapi import FastAPI

from apps.api.routes import agents
from apps.api.routes import autoresearch
from apps.api.routes import approvals
from apps.api.routes import auth
from apps.api.routes import automations
from apps.api.routes import brand
from apps.api.routes import chat
from apps.api.routes import commerce_control
from apps.api.routes import dashboard
from apps.api.routes import demo
from apps.api.routes import dolap
from apps.api.routes import goals
from apps.api.routes import graph
from apps.api.routes import grounding
from apps.api.routes import growth
from apps.api.routes import integrations
from apps.api.routes import knowledge
from apps.api.routes import llm
from apps.api.routes import org
from apps.api.routes import policies
from apps.api.routes import pricing
from apps.api.routes import products
from apps.api.routes import research
from apps.api.routes import rpc
from apps.api.routes import scheduler
from apps.api.routes import skills
from apps.api.routes import tasks
from apps.api.routes import ticosclaw
from apps.api.routes import tools
from apps.api.routes import voice
from apps.api.routes import tic_customers
from apps.api.routes import tic_dashboard
from apps.api.routes import tic_inventory
from apps.api.routes import tic_orders
from apps.api.routes import webhooks
from apps.api.routes import workspace
from apps.api.shopping.api.routes import router as shopping_router

API_PREFIX = "/api/v1"

API_ROUTERS = (
    auth.router,
    tasks.router,
    ticosclaw.router,
    approvals.router,
    knowledge.router,
    scheduler.router,
    automations.router,
    rpc.router,
    research.router,
    skills.router,
    brand.router,
    pricing.router,
    grounding.router,
    products.router,
    workspace.router,
    commerce_control.router,
    growth.router,
    policies.router,
    policies.autonomy_router,
    dashboard.router,
    demo.router,
    graph.router,
    integrations.router,
    dolap.router,
    org.router,
    goals.router,
    llm.router,
    autoresearch.router,
)

ROOT_ROUTERS = (
    webhooks.router,
    voice.router,
)

TICOSCLAW_ROUTERS = (
    chat.router,
    agents.router,
    tools.router,
    tic_inventory.router,
    tic_orders.router,
    tic_customers.router,
    tic_dashboard.router,
    shopping_router,
)


def register_routes(app: FastAPI) -> None:
    """Attach versioned HTTP routes and root-level webhook/websocket routes."""
    for router in API_ROUTERS:
        app.include_router(router, prefix=API_PREFIX)
    for router in TICOSCLAW_ROUTERS:
        app.include_router(router, prefix=f"{API_PREFIX}/ticosclaw")
        app.include_router(router, prefix=API_PREFIX, include_in_schema=False)
    for router in ROOT_ROUTERS:
        app.include_router(router)
