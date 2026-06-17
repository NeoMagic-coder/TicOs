"""TicOS inventory management — product CRUD with stock tracking.

Endpoints:
- GET    /api/v1/tic/products          list/search products
- POST   /api/v1/tic/products          create product
- GET    /api/v1/tic/products/{id}     get product detail
- PUT    /api/v1/tic/products/{id}     update product
- DELETE /api/v1/tic/products/{id}     delete product
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select, update

from apps.api.core.db import session_scope
from apps.api.core.db.tic_models import TicProductRow, TicTenantRow
from apps.api.models.tic_schemas import TicProduct, TicProductIn

router = APIRouter(prefix="/tic/products", tags=["tic"])

_DEFAULT_TENANT_ID = "tenant_default"


def _ensure_tenant() -> str:
    """Get or create the default tenant (single-tenant mode for now)."""
    with session_scope() as s:
        row = s.get(TicTenantRow, _DEFAULT_TENANT_ID)
        if row is None:
            row = TicTenantRow(
                id=_DEFAULT_TENANT_ID,
                name="Default Company",
                slug="default",
                plan="PRO",
            )
            s.add(row)
            s.flush()
        return row.id


def _row_to_product(row: TicProductRow) -> TicProduct:
    return TicProduct(
        id=row.id,
        name=row.name,
        description=row.description or "",
        sku=row.sku,
        barcode=row.barcode or "",
        price=row.price,
        cost=row.cost,
        stock=row.stock,
        category=row.category or "",
        brand=row.brand or "",
        images=list(row.images or []),
        is_active=bool(row.is_active),
        workspace_product_name=row.workspace_product_name,
        order_count=0,
        created_at=row.created_at.isoformat() if row.created_at else datetime.now(UTC).isoformat(),
        updated_at=row.updated_at.isoformat() if row.updated_at else datetime.now(UTC).isoformat(),
    )


@router.get("", response_model=dict[str, Any])
async def list_products(
    search: str = Query("", max_length=200),
    category: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    tenant_id = _ensure_tenant()
    with session_scope() as s:
        base = select(TicProductRow).where(TicProductRow.tenant_id == tenant_id)

        if search:
            like = f"%{search}%"
            base = base.where(
                TicProductRow.name.ilike(like) | TicProductRow.sku.ilike(like)
            )
        if category:
            base = base.where(TicProductRow.category == category)

        total = s.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
        rows = (
            s.execute(
                base.order_by(TicProductRow.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            .scalars()
            .all()
        )

        products = [_row_to_product(r) for r in rows]
        return {
            "data": [p.model_dump() for p in products],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            },
        }


@router.post("", response_model=TicProduct, status_code=201)
async def create_product(body: TicProductIn) -> TicProduct:
    tenant_id = _ensure_tenant()
    with session_scope() as s:
        exists = s.execute(
            select(TicProductRow).where(
                TicProductRow.tenant_id == tenant_id,
                TicProductRow.sku == body.sku,
            )
        ).scalar_one_or_none()
        if exists:
            raise HTTPException(status_code=409, detail=f"SKU '{body.sku}' already exists")

        row = TicProductRow(
            id=f"tic_p_{uuid.uuid4().hex[:12]}",
            tenant_id=tenant_id,
            name=body.name,
            description=body.description,
            sku=body.sku,
            barcode=body.barcode,
            price=body.price,
            cost=body.cost,
            stock=body.stock,
            category=body.category,
            brand=body.brand,
            images=list(body.images),
            is_active=body.is_active,
        )
        s.add(row)
        s.flush()
        return _row_to_product(row)


@router.get("/{product_id}", response_model=TicProduct)
async def get_product(product_id: str) -> TicProduct:
    tenant_id = _ensure_tenant()
    with session_scope() as s:
        row = s.get(TicProductRow, product_id)
        if row is None or row.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Product not found")
        return _row_to_product(row)


@router.put("/{product_id}", response_model=TicProduct)
async def update_product(product_id: str, body: TicProductIn) -> TicProduct:
    tenant_id = _ensure_tenant()
    with session_scope() as s:
        row = s.get(TicProductRow, product_id)
        if row is None or row.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Product not found")

        sku_exists = s.execute(
            select(TicProductRow).where(
                TicProductRow.tenant_id == tenant_id,
                TicProductRow.sku == body.sku,
                TicProductRow.id != product_id,
            )
        ).scalar_one_or_none()
        if sku_exists:
            raise HTTPException(status_code=409, detail=f"SKU '{body.sku}' already in use by another product")

        row.name = body.name
        row.description = body.description
        row.sku = body.sku
        row.barcode = body.barcode
        row.price = body.price
        row.cost = body.cost
        row.stock = body.stock
        row.category = body.category
        row.brand = body.brand
        row.images = list(body.images)
        row.is_active = body.is_active
        row.updated_at = datetime.now(UTC)
        s.flush()
        return _row_to_product(row)


@router.delete("/{product_id}")
async def delete_product(product_id: str) -> dict[str, str]:
    tenant_id = _ensure_tenant()
    with session_scope() as s:
        row = s.get(TicProductRow, product_id)
        if row is None or row.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail="Product not found")
        s.delete(row)
    return {"status": "deleted", "id": product_id}
