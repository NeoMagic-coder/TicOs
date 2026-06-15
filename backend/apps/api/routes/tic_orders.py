"""TicOS order management — multi-platform sales order tracking.

Endpoints:
- GET    /api/v1/tic/orders            list/search orders
- POST   /api/v1/tic/orders            create order
- GET    /api/v1/tic/orders/{id}       get order detail
- PATCH  /api/v1/tic/orders/{id}/status  update order status
- GET    /api/v1/tic/orders/stats      quick stats
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from apps.api.core.db import session_scope
from apps.api.core.db.tic_models import TicCustomerRow, TicOrderItemRow, TicOrderRow, TicProductRow, TicTenantRow
from apps.api.models.tic_schemas import TicOrder, TicOrderIn, TicOrderItem, TicOrderStatusUpdate, TicSimpleOrderIn

router = APIRouter(prefix="/tic/orders", tags=["tic"])

_DEFAULT_TENANT_ID = "tenant_default"


def _ensure_tenant() -> str:
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


def _split_customer_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(maxsplit=1)
    if not parts:
        return "Müşteri", "-"
    if len(parts) == 1:
        return parts[0], "-"
    return parts[0], parts[1]


def _generate_order_number() -> str:
    now = datetime.now(UTC)
    y = str(now.year)[-2:]
    m = f"{now.month:02d}"
    d = f"{now.day:02d}"
    rand = uuid.uuid4().hex[:4].upper()
    return f"TIC-{y}{m}{d}-{rand}"


def _row_to_order(row: TicOrderRow) -> TicOrder:
    customer_name = ""
    if row.customer:
        customer_name = f"{row.customer.first_name} {row.customer.last_name}"

    items: list[TicOrderItem] = []
    for item in row.items or []:
        items.append(
            TicOrderItem(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else "",
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item.total_price,
            )
        )

    return TicOrder(
        id=row.id,
        order_number=row.order_number,
        platform=row.platform,
        platform_order_id=row.platform_order_id or "",
        status=row.status,
        customer_id=row.customer_id,
        customer_name=customer_name,
        items=items,
        total_amount=row.total_amount,
        discount_amount=row.discount_amount or 0,
        shipping_amount=row.shipping_amount or 0,
        payment_method=row.payment_method or "",
        notes=row.notes or "",
        created_at=row.created_at.isoformat() if row.created_at else datetime.now(UTC).isoformat(),
        updated_at=row.updated_at.isoformat() if row.updated_at else datetime.now(UTC).isoformat(),
    )


@router.get("", response_model=dict[str, Any])
async def list_orders(
    status: str = Query("", max_length=32),
    platform: str = Query("", max_length=32),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    with session_scope() as s:
        base = select(TicOrderRow).where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)

        if status:
            base = base.where(TicOrderRow.status == status)
        if platform:
            base = base.where(TicOrderRow.platform == platform)

        total = s.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
        rows = (
            s.execute(
                base.order_by(TicOrderRow.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            .scalars()
            .all()
        )

        # Eager-load relationships
        for row in rows:
            s.execute(select(TicCustomerRow).where(TicCustomerRow.id == row.customer_id))

        orders = [_row_to_order(r) for r in rows]
        return {
            "data": [o.model_dump() for o in orders],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            },
        }


@router.get("/stats", response_model=dict[str, Any])
async def order_stats() -> dict[str, Any]:
    _ensure_tenant()
    with session_scope() as s:
        base = select(TicOrderRow).where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
        total = s.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
        pending = (
            s.execute(
                select(func.count()).select_from(
                    base.where(TicOrderRow.status == "PENDING").subquery()
                )
            ).scalar()
            or 0
        )
        revenue = (
            s.execute(select(func.coalesce(func.sum(TicOrderRow.total_amount), 0)).where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)).scalar()
            or 0
        )
        return {
            "total_orders": total,
            "pending_orders": pending,
            "total_revenue": round(float(revenue), 2),
        }


@router.post("/quick", response_model=TicOrder, status_code=201)
async def create_simple_order(body: TicSimpleOrderIn) -> TicOrder:
    """Manuel sipariş — müşteri otomatik oluşturulur, tek ürün satırı."""
    _ensure_tenant()
    with session_scope() as s:
        first_name, last_name = _split_customer_name(body.customer_name)

        product: TicProductRow | None = None
        if body.product_id:
            product = s.get(TicProductRow, body.product_id)
            if product is None or product.tenant_id != _DEFAULT_TENANT_ID:
                raise HTTPException(status_code=404, detail="Product not found")
        else:
            product = (
                s.execute(
                    select(TicProductRow)
                    .where(TicProductRow.tenant_id == _DEFAULT_TENANT_ID)
                    .where(TicProductRow.is_active.is_(True))
                    .order_by(TicProductRow.created_at.desc())
                    .limit(1)
                )
                .scalars()
                .first()
            )
        if product is None:
            raise HTTPException(status_code=400, detail="Önce en az bir ürün ekleyin.")

        unit_price = body.unit_price if body.unit_price is not None else float(product.price)
        if unit_price <= 0:
            raise HTTPException(status_code=400, detail="Geçerli bir fiyat girin.")

        customer = TicCustomerRow(
            id=f"tic_c_{uuid.uuid4().hex[:12]}",
            tenant_id=_DEFAULT_TENANT_ID,
            first_name=first_name,
            last_name=last_name,
            phone=body.phone,
            notes=body.notes,
        )
        s.add(customer)
        s.flush()

        line_total = round(body.quantity * unit_price, 2)
        order = TicOrderRow(
            id=f"tic_o_{uuid.uuid4().hex[:12]}",
            tenant_id=_DEFAULT_TENANT_ID,
            order_number=_generate_order_number(),
            platform=body.platform,
            status="PENDING",
            customer_id=customer.id,
            total_amount=line_total,
            payment_method="MANUAL",
            notes=body.notes,
        )
        s.add(order)
        s.flush()

        s.add(
            TicOrderItemRow(
                id=f"tic_oi_{uuid.uuid4().hex[:12]}",
                order_id=order.id,
                product_id=product.id,
                quantity=body.quantity,
                unit_price=unit_price,
                total_price=line_total,
            )
        )
        s.flush()
        s.refresh(order)
        result = _row_to_order(order)
        if not result.customer_name.strip():
            result = result.model_copy(update={"customer_name": f"{first_name} {last_name}".strip()})
        return result


@router.post("", response_model=TicOrder, status_code=201)
async def create_order(body: TicOrderIn) -> TicOrder:
    _ensure_tenant()
    with session_scope() as s:
        customer = s.get(TicCustomerRow, body.customer_id)
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        items_data = []
        total = 0.0
        for item_in in body.items:
            product = s.get(TicProductRow, item_in.product_id)
            if product is None:
                raise HTTPException(status_code=404, detail=f"Product '{item_in.product_id}' not found")
            line_total = round(item_in.quantity * item_in.unit_price, 2)
            total += line_total
            items_data.append({
                "product": product,
                "quantity": item_in.quantity,
                "unit_price": item_in.unit_price,
                "total_price": line_total,
            })

        order = TicOrderRow(
            id=f"tic_o_{uuid.uuid4().hex[:12]}",
            tenant_id=_DEFAULT_TENANT_ID,
            order_number=_generate_order_number(),
            platform=body.platform,
            platform_order_id=body.platform_order_id,
            status="PENDING",
            customer_id=body.customer_id,
            total_amount=round(total - body.discount_amount + body.shipping_amount, 2),
            discount_amount=body.discount_amount,
            shipping_amount=body.shipping_amount,
            payment_method=body.payment_method,
            notes=body.notes,
        )
        s.add(order)
        s.flush()

        for item in items_data:
            s.add(
                TicOrderItemRow(
                    id=f"tic_oi_{uuid.uuid4().hex[:12]}",
                    order_id=order.id,
                    product_id=item["product"].id,
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    total_price=item["total_price"],
                )
            )

        # Refresh with relationships
        s.refresh(order)
        return _row_to_order(order)


@router.get("/{order_id}", response_model=TicOrder)
async def get_order(order_id: str) -> TicOrder:
    with session_scope() as s:
        row = s.get(TicOrderRow, order_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Order not found")
        return _row_to_order(row)


@router.patch("/{order_id}/status", response_model=TicOrder)
async def update_order_status(order_id: str, body: TicOrderStatusUpdate) -> TicOrder:
    with session_scope() as s:
        row = s.get(TicOrderRow, order_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Order not found")
        row.status = body.status
        row.updated_at = datetime.now(UTC)
        s.flush()
        return _row_to_order(row)

