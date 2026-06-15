"""Quick manual order creation."""
from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.main import app


@pytest.mark.asyncio
async def test_quick_order_requires_customer_name():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/v1/ticosclaw/tic/orders/quick",
            json={"customer_name": "A", "quantity": 1},
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_quick_order_with_product():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        sku = f"SKU-Q-{uuid.uuid4().hex[:8]}"
        prod = await client.post(
            "/api/v1/ticosclaw/tic/products",
            json={
                "name": "Test Urun",
                "sku": sku,
                "price": 199.9,
                "stock": 5,
            },
        )
        assert prod.status_code == 201
        product_id = prod.json()["id"]

        res = await client.post(
            "/api/v1/ticosclaw/tic/orders/quick",
            json={
                "customer_name": "Ayşe Yılmaz",
                "phone": "5551234567",
                "product_id": product_id,
                "quantity": 2,
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["customer_name"] == "Ayşe Yılmaz"
        assert body["status"] == "PENDING"
        assert body["total_amount"] == pytest.approx(399.8, rel=0.01)
