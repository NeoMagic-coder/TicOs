"""TicOS dashboard — aggregate stats for the inventory management UI.

Endpoints:
- GET /api/v1/tic/dashboard  aggregate stats (products, orders, revenue)
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select

from apps.api.core.db import session_scope
from apps.api.core.db.tic_models import TicCustomerRow, TicOrderRow, TicProductRow
from apps.api.models.tic_schemas import TicDashboardStats

router = APIRouter(prefix="/tic/dashboard", tags=["tic"])

_DEFAULT_TENANT_ID = "tenant_default"


@router.get("", response_model=TicDashboardStats)
async def dashboard_stats() -> TicDashboardStats:
    now = datetime.now(UTC)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    with session_scope() as s:
        base_product = select(TicProductRow).where(TicProductRow.tenant_id == _DEFAULT_TENANT_ID)
        base_order = select(TicOrderRow).where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)

        total_products = s.execute(select(func.count()).select_from(base_product.subquery())).scalar() or 0
        total_orders = s.execute(select(func.count()).select_from(base_order.subquery())).scalar() or 0
        total_customers = (
            s.execute(
                select(func.count()).select_from(
                    select(TicCustomerRow).where(TicCustomerRow.tenant_id == _DEFAULT_TENANT_ID).subquery()
                )
            ).scalar()
            or 0
        )

        revenue_result = s.execute(
            select(func.coalesce(func.sum(TicOrderRow.total_amount), 0)).where(
                TicOrderRow.tenant_id == _DEFAULT_TENANT_ID
            )
        ).scalar() or 0

        pending_result = s.execute(
            select(func.count()).select_from(
                base_order.where(TicOrderRow.status == "PENDING").subquery()
            )
        ).scalar() or 0

        low_stock_result = s.execute(
            select(func.count()).select_from(
                base_product.where(TicProductRow.stock < 10, TicProductRow.is_active.is_(True)).subquery()
            )
        ).scalar() or 0

        monthly_revenue = (
            s.execute(
                select(func.coalesce(func.sum(TicOrderRow.total_amount), 0)).where(
                    TicOrderRow.tenant_id == _DEFAULT_TENANT_ID,
                    TicOrderRow.created_at >= first_of_month,
                )
            ).scalar()
            or 0
        )

        monthly_orders = (
            s.execute(
                select(func.count()).select_from(
                    base_order.where(TicOrderRow.created_at >= first_of_month).subquery()
                )
            ).scalar()
            or 0
        )

        recent = (
            s.execute(
                base_order.order_by(TicOrderRow.created_at.desc()).limit(5)
            )
            .scalars()
            .all()
        )

        return TicDashboardStats(
            total_products=total_products,
            total_orders=total_orders,
            total_customers=total_customers,
            total_revenue=round(float(revenue_result), 2),
            pending_orders=pending_result,
            low_stock_count=low_stock_result,
            monthly_revenue=round(float(monthly_revenue), 2),
            monthly_orders=monthly_orders,
        )
