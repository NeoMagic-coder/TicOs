"""Ortak ontoloji — multi-agent katmanının paylaşılan kavram sözlüğü.

Her ajan bu Pydantic modellerini referans alır; serileştirme sırasında alan
adları sabit kalır. Bu sayede `negotiation_agent`, `logistics_agent`,
`dynamic_pricing_agent` gibi heterojen ajanlar aynı `Product`, `Order`,
`Offer` kavramı üzerinde konuşur. Yeni alan eklerken default değer ver:
geriye dönük uyumluluk için zorunlu.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, NonNegativeFloat, PositiveInt


class Product(BaseModel):
    sku: str
    name: str
    category: str | None = None
    unit_cost_try: NonNegativeFloat = 0.0
    list_price_try: NonNegativeFloat = 0.0
    weight_kg: NonNegativeFloat = 0.0


class Order(BaseModel):
    order_id: str
    sku: str
    quantity: PositiveInt
    total_try: NonNegativeFloat
    status: Literal["created", "paid", "shipped", "delivered", "cancelled", "returned"] = "created"
    destination_city: str | None = None
    created_at: datetime | None = None


class Offer(BaseModel):
    """Tek bir müzakere teklifi (her iki yöne uygulanabilir)."""

    offer_id: str
    party: Literal["buyer", "seller", "broker"]
    price_try: NonNegativeFloat
    quantity: PositiveInt = 1
    moq: PositiveInt | None = None
    lead_time_days: PositiveInt | None = None
    valid_until: datetime | None = None


class Invoice(BaseModel):
    invoice_id: str
    order_id: str
    total_try: NonNegativeFloat
    issued_at: datetime
    paid: bool = False


class ShipmentQuote(BaseModel):
    carrier: str
    cost_try: NonNegativeFloat
    eta_hours: PositiveInt
    sla_pct: float = Field(ge=0.0, le=1.0, default=0.95)


class PriceSignal(BaseModel):
    sku: str
    current_price_try: NonNegativeFloat
    competitor_avg_try: NonNegativeFloat | None = None
    demand_score: float = Field(ge=0.0, le=1.0, default=0.5)
    stock_days: int = 30
