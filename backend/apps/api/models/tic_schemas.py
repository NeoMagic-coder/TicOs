"""Pydantic schemas for TicOS e-commerce management module."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TicProductIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    sku: str = Field(..., min_length=1, max_length=64)
    barcode: str = ""
    price: float = Field(..., gt=0)
    cost: float | None = None
    stock: int = 0
    category: str = ""
    brand: str = ""
    images: list[str] = Field(default_factory=list)
    is_active: bool = True


class TicProduct(TicProductIn):
    id: str
    order_count: int = 0
    workspace_product_name: str | None = None
    created_at: str
    updated_at: str


class TicCustomerIn(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = ""
    phone: str = ""
    company: str = ""
    tax_id: str = ""
    address: str = ""
    city: str = ""
    district: str = ""
    notes: str = ""


class TicCustomer(TicCustomerIn):
    id: str
    order_count: int = 0
    total_spent: float = 0
    created_at: str
    updated_at: str


class TicOrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)


class TicOrderIn(BaseModel):
    customer_id: str
    platform: Literal["TRENDYOL", "HEPSIBURADA", "AMAZON", "MANUAL"] = "MANUAL"
    platform_order_id: str = ""
    items: list[TicOrderItemIn] = Field(..., min_length=1)
    discount_amount: float = 0
    shipping_amount: float = 0
    payment_method: str = ""
    notes: str = ""


class TicSimpleOrderIn(BaseModel):
    """Tek ekrandan manuel sipariş — müşteri + ürün birlikte."""
    customer_name: str = Field(..., min_length=2, max_length=200)
    phone: str = ""
    product_id: str = ""
    quantity: int = Field(1, ge=1)
    unit_price: float | None = Field(None, gt=0)
    notes: str = ""
    platform: Literal["TRENDYOL", "HEPSIBURADA", "AMAZON", "MANUAL"] = "MANUAL"


class TicOrderItem(TicOrderItemIn):
    id: str
    order_id: str
    total_price: float
    product_name: str


class TicOrder(BaseModel):
    id: str
    order_number: str
    platform: str
    platform_order_id: str = ""
    status: str
    customer_id: str
    customer_name: str = ""
    items: list[TicOrderItem] = Field(default_factory=list)
    total_amount: float
    discount_amount: float = 0
    shipping_amount: float = 0
    payment_method: str = ""
    notes: str = ""
    created_at: str
    updated_at: str


class TicOrderStatusUpdate(BaseModel):
    status: Literal["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]


class TicDashboardStats(BaseModel):
    total_products: int = 0
    total_orders: int = 0
    total_customers: int = 0
    total_revenue: float = 0
    pending_orders: int = 0
    low_stock_count: int = 0
    monthly_revenue: float = 0
    monthly_orders: int = 0
    recent_orders: list[TicOrder] = Field(default_factory=list)


class TicPagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class TicPaginatedResponse(BaseModel):
    data: list[Any]
    pagination: TicPagination
