"""TicOS e-commerce management SQLAlchemy models.

Separate from the core OneProduct models to avoid naming conflicts with
``ProductRow`` (the onboarded-product concept).
"""
from __future__ import annotations

from datetime import UTC, datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.core.db.engine import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class TicTenantRow(Base):
    """Multi-tenant organization.

    Each tenant has its own isolated product/order/customer data.
    """

    __tablename__ = "tic_tenants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    plan: Mapped[str] = mapped_column(String(16), default="BASIC")
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    products: Mapped[list[TicProductRow]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    orders: Mapped[list[TicOrderRow]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    customers: Mapped[list[TicCustomerRow]] = relationship(back_populates="tenant", cascade="all, delete-orphan")


class TicProductRow(Base):
    """Inventory product with SKU, stock tracking."""

    __tablename__ = "tic_products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tic_tenants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String, default="")
    sku: Mapped[str] = mapped_column(String(64), index=True)
    barcode: Mapped[str] = mapped_column(String(64), default="")
    price: Mapped[float] = mapped_column(Float, default=0.0)
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(100), default="")
    brand: Mapped[str] = mapped_column(String(100), default="")
    images: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(default=True)
    workspace_product_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    tenant: Mapped[TicTenantRow] = relationship(back_populates="products")
    order_items: Mapped[list[TicOrderItemRow]] = relationship(back_populates="product", cascade="all, delete-orphan")


class TicCustomerRow(Base):
    """Customer record with contact details."""

    __tablename__ = "tic_customers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tic_tenants.id", ondelete="CASCADE"), index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(200), default="", index=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    company: Mapped[str] = mapped_column(String(200), default="")
    tax_id: Mapped[str] = mapped_column(String(32), default="")
    address: Mapped[str] = mapped_column(String, default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    district: Mapped[str] = mapped_column(String(100), default="")
    notes: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    tenant: Mapped[TicTenantRow] = relationship(back_populates="customers")
    orders: Mapped[list[TicOrderRow]] = relationship(back_populates="customer", cascade="all, delete-orphan")


class TicOrderRow(Base):
    """Sales order from any platform."""

    __tablename__ = "tic_orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), ForeignKey("tic_tenants.id", ondelete="CASCADE"), index=True)
    order_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    platform: Mapped[str] = mapped_column(String(32), default="MANUAL")
    platform_order_id: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(32), default="PENDING", index=True)
    customer_id: Mapped[str] = mapped_column(String(64), ForeignKey("tic_customers.id"), index=True)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    shipping_amount: Mapped[float] = mapped_column(Float, default=0.0)
    payment_method: Mapped[str] = mapped_column(String(64), default="")
    notes: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    tenant: Mapped[TicTenantRow] = relationship(back_populates="orders")
    customer: Mapped[TicCustomerRow] = relationship(back_populates="orders")
    items: Mapped[list[TicOrderItemRow]] = relationship(back_populates="order", cascade="all, delete-orphan")


class TicOrderItemRow(Base):
    """Line item within a sales order."""

    __tablename__ = "tic_order_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    order_id: Mapped[str] = mapped_column(String(64), ForeignKey("tic_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(String(64), ForeignKey("tic_products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    total_price: Mapped[float] = mapped_column(Float, default=0.0)

    order: Mapped[TicOrderRow] = relationship(back_populates="items")
    product: Mapped[TicProductRow] = relationship(back_populates="order_items")
