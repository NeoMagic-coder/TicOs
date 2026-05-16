"""Generates plausible mock outputs for tools when running in 'mock' mode.

Outputs are deterministic-seeded by tool_id so the demo feels stable but varied.
"""
from __future__ import annotations

import hashlib
import random
from typing import Any

from apps.api.models.schemas import ToolManifest

_CATEGORY_TEMPLATES: dict[str, dict[str, Any]] = {
    "research": {
        "trend_pct_12m": "+18%",
        "rivals": 247,
        "monthly_searches": 18_400,
        "niche_score": 78,
    },
    "pricing": {
        "suggested_price": 449,
        "margin_pct": 27.4,
        "competitor_avg": 472,
    },
    "review": {
        "avg_rating": 4.3,
        "negative_pct": 11,
        "top_keyword": "kaliteli ama sap gevşek geliyor",
    },
    "growth": {
        "expected_uplift_pct": 12,
        "confidence": 0.74,
    },
    "email": {
        "open_rate": 0.42,
        "click_rate": 0.08,
    },
    "brand": {
        "candidates": ["GranitPro", "Stonecook", "Bizim Tencere"],
    },
    "legal": {
        "compliant": True,
        "issues": [],
    },
    "influencer": {
        "matches": 5,
        "estimated_reach": 240_000,
    },
    "store": {
        "checklist_length": 14,
        "estimated_setup_hours": 6,
    },
    "catalog": {
        "score": 82,
        "missing_fields": ["meta_description", "alt_text"],
    },
    "marketing": {
        "spend_try": 14_500,
        "roas": 3.2,
        "active_campaigns": 4,
    },
    "content_seo": {
        "keywords_found": 24,
        "avg_volume": 2_400,
        "avg_difficulty": 38,
    },
    "order": {
        "open_orders": 17,
        "avg_processing_hours": 9.4,
    },
    "stock": {
        "low_stock_skus": 3,
        "days_left": 11,
        "reorder_point": 120,
    },
    "support": {
        "open_tickets": 12,
        "avg_first_response_min": 47,
        "sentiment": "neutral",
    },
    "analytics": {
        "revenue_try": 124_800,
        "orders": 312,
        "aov": 400,
        "conversion_rate": 0.024,
    },
    "compliance": {
        "compliant": True,
        "issues": [],
        "marketplace": "trendyol",
    },
    "product": {
        "suppliers_found": 8,
        "best_unit_cost": 38.5,
        "moq": 500,
    },
    "negotiation": {
        "final_price": 36.2,
        "rounds_used": 4,
        "outcome": "agreement",
        "savings_pct": 12.0,
    },
    "logistics": {
        "cheapest_carrier": "Aras Kargo",
        "fastest_carrier": "Yurtiçi Kargo",
        "avg_cost_try": 38.5,
        "eta_hours": 26,
    },
    "dynamic_pricing": {
        "recommended_price": 459,
        "delta_pct": 2.4,
        "expected_revenue_lift_pct": 6.1,
        "demand_score": 0.71,
    },
    "decision": {
        "allowed": True,
        "requires_approval": False,
        "decision_id": "dec_8f3a",
    },
}


def mock_response(tool: ToolManifest, payload: dict[str, Any]) -> dict[str, Any]:
    seed = int(hashlib.sha256((tool.tool_id + str(payload)).encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    base = dict(_CATEGORY_TEMPLATES.get(tool.category, {}))
    base.setdefault("ok", True)
    base["tool_id"] = tool.tool_id
    base["mock"] = True
    base["confidence"] = round(rng.uniform(0.72, 0.96), 2)
    return base
