//! Shared ontology — the canonical vocabulary every agent uses.
//!
//! Versioning rule: add new fields with `#[serde(default)]` so older agents
//! can still deserialize. Never reuse a field name with a different type.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Sku(pub String);

impl From<&str> for Sku {
    fn from(s: &str) -> Self { Self(s.to_string()) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub sku: Sku,
    pub name: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub unit_cost_try: Decimal,
    #[serde(default)]
    pub list_price_try: Decimal,
    #[serde(default)]
    pub weight_kg: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Created,
    Paid,
    Shipped,
    Delivered,
    Cancelled,
    Returned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub order_id: String,
    pub sku: Sku,
    pub quantity: u32,
    pub total_try: Decimal,
    pub status: OrderStatus,
    #[serde(default)]
    pub destination_city: Option<String>,
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Party { Buyer, Seller, Broker }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Offer {
    pub offer_id: String,
    pub party: Party,
    pub price_try: Decimal,
    #[serde(default = "default_qty")]
    pub quantity: u32,
    #[serde(default)]
    pub moq: Option<u32>,
    #[serde(default)]
    pub lead_time_days: Option<u32>,
    #[serde(default)]
    pub valid_until: Option<DateTime<Utc>>,
}

fn default_qty() -> u32 { 1 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub invoice_id: String,
    pub order_id: String,
    pub total_try: Decimal,
    pub issued_at: DateTime<Utc>,
    #[serde(default)]
    pub paid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShipmentQuote {
    pub carrier: String,
    pub cost_try: Decimal,
    pub eta_hours: u32,
    #[serde(default = "default_sla")]
    pub sla_pct: f64,
}

fn default_sla() -> f64 { 0.95 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSignal {
    pub sku: Sku,
    pub current_price_try: Decimal,
    #[serde(default)]
    pub competitor_avg_try: Option<Decimal>,
    #[serde(default = "default_demand")]
    pub demand_score: f64,
    #[serde(default = "default_stock_days")]
    pub stock_days: i32,
}

fn default_demand() -> f64 { 0.5 }
fn default_stock_days() -> i32 { 30 }
