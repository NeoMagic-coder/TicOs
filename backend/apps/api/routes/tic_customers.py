"""TicOS customer management.

Endpoints:
- GET    /api/v1/tic/customers          list customers
- POST   /api/v1/tic/customers          create customer
- GET    /api/v1/tic/customers/{id}     get customer detail
- PUT    /api/v1/tic/customers/{id}     update customer
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from apps.api.core.db import session_scope
from apps.api.core.db.tic_models import TicCustomerRow, TicOrderRow, TicTenantRow
from apps.api.models.tic_schemas import TicCustomer, TicCustomerIn

router = APIRouter(prefix="/tic/customers", tags=["tic"])

_DEFAULT_TENANT_ID = "tenant_default"


def _row_to_customer(row: TicCustomerRow) -> TicCustomer:
    return TicCustomer(
        id=row.id,
        first_name=row.first_name,
        last_name=row.last_name,
        email=row.email or "",
        phone=row.phone or "",
        company=row.company or "",
        tax_id=row.tax_id or "",
        address=row.address or "",
        city=row.city or "",
        district=row.district or "",
        notes=row.notes or "",
        order_count=0,
        total_spent=0,
        created_at=row.created_at.isoformat() if row.created_at else datetime.now(UTC).isoformat(),
        updated_at=row.updated_at.isoformat() if row.updated_at else datetime.now(UTC).isoformat(),
    )


@router.get("", response_model=dict[str, Any])
async def list_customers(
    search: str = Query("", max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    with session_scope() as s:
        base = select(TicCustomerRow).where(TicCustomerRow.tenant_id == _DEFAULT_TENANT_ID)

        if search:
            like = f"%{search}%"
            base = base.where(
                TicCustomerRow.first_name.ilike(like)
                | TicCustomerRow.last_name.ilike(like)
                | TicCustomerRow.email.ilike(like)
                | TicCustomerRow.phone.ilike(like)
            )

        total = s.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
        rows = (
            s.execute(
                base.order_by(TicCustomerRow.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            .scalars()
            .all()
        )

        customers = [_row_to_customer(r) for r in rows]
        return {
            "data": [c.model_dump() for c in customers],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            },
        }


@router.post("", response_model=TicCustomer, status_code=201)
async def create_customer(body: TicCustomerIn) -> TicCustomer:
    with session_scope() as s:
        row = TicCustomerRow(
            id=f"tic_c_{uuid.uuid4().hex[:12]}",
            tenant_id=_DEFAULT_TENANT_ID,
            first_name=body.first_name,
            last_name=body.last_name,
            email=body.email,
            phone=body.phone,
            company=body.company,
            tax_id=body.tax_id,
            address=body.address,
            city=body.city,
            district=body.district,
            notes=body.notes,
        )
        s.add(row)
        s.flush()
        return _row_to_customer(row)


@router.get("/{customer_id}", response_model=TicCustomer)
async def get_customer(customer_id: str) -> TicCustomer:
    with session_scope() as s:
        row = s.get(TicCustomerRow, customer_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Customer not found")
        return _row_to_customer(row)


@router.put("/{customer_id}", response_model=TicCustomer)
async def update_customer(customer_id: str, body: TicCustomerIn) -> TicCustomer:
    with session_scope() as s:
        row = s.get(TicCustomerRow, customer_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        row.first_name = body.first_name
        row.last_name = body.last_name
        row.email = body.email
        row.phone = body.phone
        row.company = body.company
        row.tax_id = body.tax_id
        row.address = body.address
        row.city = body.city
        row.district = body.district
        row.notes = body.notes
        row.updated_at = datetime.now(UTC)
        s.flush()
        return _row_to_customer(row)
