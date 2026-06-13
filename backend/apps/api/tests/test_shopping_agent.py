"""Integration tests for the embedded shopping comparison agent."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.main import create_app
from apps.api.shopping.api import routes as shopping_routes
from apps.api.shopping.db import repo
from apps.api.shopping.db.database import SessionLocal
from apps.api.shopping.db.database import init_db
from apps.api.shopping.schemas import ShoppingGoal


@pytest.mark.asyncio
async def test_shopping_sync_run_returns_a_ranked_recommendation() -> None:
    await init_db()
    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/shopping/runs/sync",
            json={
                "product_query": "iPhone 15",
                "budget_max": 40_000,
                "require_in_stock": True,
                "require_fast_delivery": True,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["best"]["offer"]["price"] <= 40_000
    assert body["best"]["offer"]["in_stock"] is True
    assert body["summary"]
    assert body.get("web_search") is not None
    assert body["web_search"]["query"] == "iPhone 15"
    assert isinstance(body["web_search"]["sources"], list)


@pytest.mark.asyncio
async def test_shopping_rejects_an_inverted_budget_range() -> None:
    await init_db()
    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/shopping/runs/sync",
            json={
                "product_query": "kulaklik",
                "budget_min": 2_000,
                "budget_max": 1_000,
            },
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_shopping_async_run_feedback_and_metrics_flow() -> None:
    await init_db()
    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        created = await client.post(
            "/api/v1/shopping/runs",
            json={"product_query": "kulaklik", "budget_min": 1_000, "budget_max": 2_000},
        )
        assert created.status_code == 202
        run_id = created.json()["run_id"]

        result = await client.get(f"/api/v1/shopping/runs/{run_id}")
        assert result.status_code == 200
        assert result.json()["status"] == "completed"

        feedback = await client.post(
            f"/api/v1/shopping/runs/{run_id}/feedback",
            json={"recommendation_accurate": True, "satisfaction": 5},
        )
        assert feedback.status_code == 201

        metrics = await client.get("/api/v1/shopping/metrics")
        assert metrics.status_code == 200
        assert metrics.json()["feedback_count"] >= 1


@pytest.mark.asyncio
async def test_shopping_failure_does_not_expose_internal_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_run(*args: object, **kwargs: object) -> object:
        raise RuntimeError("secret-provider-token")

    monkeypatch.setattr(shopping_routes, "run_shopping_agent", fail_run)
    await init_db()
    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/shopping/runs/sync",
            json={"product_query": "iPhone 15"},
        )

    assert response.status_code == 502
    assert "secret-provider-token" not in response.text


@pytest.mark.asyncio
async def test_failed_background_run_does_not_expose_internal_error() -> None:
    await init_db()
    run_id = "failed-secure"
    async with SessionLocal() as session:
        existing = await repo.get_run(session, run_id)
        if existing is None:
            await repo.create_run(session, run_id, ShoppingGoal(product_query="iPhone 15"))
        await repo.set_run_failed(session, run_id, "secret-background-token")

    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get(f"/api/v1/shopping/runs/{run_id}")

    assert response.status_code == 200
    assert "secret-background-token" not in response.text
