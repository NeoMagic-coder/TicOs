"""Public identity contract for the unified TicOSClaw backend."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.main import create_app


@pytest.mark.asyncio
async def test_ticosclaw_exposes_one_identity_and_all_capabilities() -> None:
    get_settings.cache_clear()  # type: ignore[attr-defined]
    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        identity = await client.get("/api/v1/ticosclaw")
        health = await client.get("/health")
        openapi = await client.get("/openapi.json")

    assert identity.status_code == 200
    assert identity.json()["name"] == "TicOSClaw"
    assert set(identity.json()["capabilities"]) == {
        "orchestration",
        "tool_execution",
        "commerce_operations",
        "shopping_comparison",
    }
    assert health.json()["app"] == "TicOSClaw"
    assert openapi.json()["info"]["title"] == "TicOSClaw"


@pytest.mark.asyncio
async def test_ticosclaw_namespace_exposes_all_capability_routes() -> None:
    get_settings.cache_clear()  # type: ignore[attr-defined]
    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        tools = await client.get("/api/v1/ticosclaw/tools")
        commerce = await client.get("/api/v1/ticosclaw/tic/dashboard")
        shopping = await client.post(
            "/api/v1/ticosclaw/shopping/runs/sync",
            json={"product_query": "iPhone 15", "budget_max": 40_000},
        )
        openapi = await client.get("/openapi.json")

    assert tools.status_code == 200
    assert commerce.status_code == 200
    assert shopping.status_code == 200
    paths = openapi.json()["paths"]
    assert "/api/v1/ticosclaw/chat" in paths
    assert "/api/v1/ticosclaw/tools/execute" in paths
    assert "/api/v1/ticosclaw/tic/products" in paths
    assert "/api/v1/ticosclaw/shopping/runs/sync" in paths
    assert "/api/v1/chat" not in paths
    assert "/api/v1/tools/execute" not in paths
    assert "/api/v1/tic/products" not in paths
    assert "/api/v1/shopping/runs/sync" not in paths
