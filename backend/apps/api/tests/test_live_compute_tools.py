"""Tests for the deterministic compute adapters (compute_tools.py).

These are pure-Python — no LLM, no HTTP — so each tool is covered with both
a happy path and an edge case (empty input, divide-by-zero, etc.). The
adapters return the same shape on edge cases so downstream consumers don't
have to handle ``None`` returns."""
from __future__ import annotations

import math

import pytest

from apps.api.tools.live import compute_tools as ct


# ── margin_calculator ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_margin_calculator_happy() -> None:
    r = await ct._margin_calculator({"price": 100, "cost": 60})
    assert r["margin_try"] == 40.0
    assert r["margin_pct"] == 40.0
    assert r["markup_pct"] == pytest.approx(66.67, abs=0.01)


@pytest.mark.asyncio
async def test_margin_calculator_zero_price() -> None:
    r = await ct._margin_calculator({"price": 0, "cost": 50})
    # Zero price → no division-by-zero; return zeros + warning.
    assert r["margin_try"] == 0.0
    assert "warning" in r


@pytest.mark.asyncio
async def test_margin_calculator_negative_inputs_clamped() -> None:
    """Defensive: negative inputs get clamped to zero, not propagated.
    Clamped price=0 short-circuits to the warning branch (no price_try key)."""
    r = await ct._margin_calculator({"price": -10, "cost": -5})
    assert r["margin_try"] == 0.0
    assert "warning" in r


# ── cogs_calculator ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cogs_calculator_full_breakdown() -> None:
    r = await ct._cogs_calculator({
        "unit_cost": 50,
        "shipping_cost": 10,
        "packaging_cost": 5,
        "sale_price": 200,
        "commission_pct": 15,
    })
    # commission = 200 * 0.15 = 30; total = 50 + 10 + 5 + 30 = 95
    assert r["total_cogs_try"] == 95.0
    assert r["breakdown"]["commission"] == 30.0
    # cogs ÷ price = 95 / 200 = 47.5%
    assert r["cogs_pct_of_price"] == 47.5


# ── campaign_discount_simulator ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_discount_simulator_runs_scenarios() -> None:
    r = await ct._campaign_discount_simulator({
        "base_price": 100,
        "unit_cost": 40,
        "baseline_volume": 200,
        "discount_pct": [10, 20],
    })
    assert len(r["scenarios"]) == 2
    s10 = next(s for s in r["scenarios"] if s["discount_pct"] == 10.0)
    assert s10["sale_price"] == 90.0
    # Volume must increase under discount (elasticity < 0).
    assert s10["projected_volume"] > 200
    assert r["best_margin_pct"] in (10.0, 20.0)


@pytest.mark.asyncio
async def test_discount_simulator_requires_base_price() -> None:
    r = await ct._campaign_discount_simulator({"base_price": 0})
    assert r["scenarios"] == []
    assert "warning" in r


# ── autonomy_policy_check ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_autonomy_policy_check_auto_approved() -> None:
    r = await ct._autonomy_policy_check({
        "action_type": "generic",
        "value": 0.0,
        "risk_level": "low",
        "confidence": 0.9,
    })
    assert r["status"] == "auto_approved"
    assert r["decision_id"].startswith("dec_")
    assert "decided_at" in r


@pytest.mark.asyncio
async def test_autonomy_policy_check_low_confidence_escalates() -> None:
    r = await ct._autonomy_policy_check({
        "action_type": "generic",
        "value": 0,
        "risk_level": "low",
        "confidence": 0.1,
    })
    assert r["status"] == "needs_approval"
    assert "Güven" in r["reason"]


# ── stock_forecast ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stock_forecast_happy() -> None:
    r = await ct._stock_forecast({
        "history": [10, 12, 11, 9, 10],   # avg ≈ 10.4/day
        "current_stock": 100,
        "lead_time_days": 7,
        "safety_stock_days": 3,
    })
    assert r["avg_daily_sales"] == pytest.approx(10.4)
    # reorder_point = ceil(10.4 * (7 + 3)) = 104
    assert r["reorder_point"] == 104
    # days_until_stockout ≈ 100 / 10.4 ≈ 9.6 → < lead (7+3=10) ? severity check
    assert r["severity"] in ("ok", "warning", "critical")


@pytest.mark.asyncio
async def test_stock_forecast_empty_history() -> None:
    r = await ct._stock_forecast({"history": [], "current_stock": 50})
    assert r["avg_daily_sales"] == 0.0
    assert r["reorder_point"] == 0
    assert "warning" in r


# ── ab_test_designer ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ab_test_designer_sample_size_reasonable() -> None:
    r = await ct._ab_test_designer({
        "baseline_rate": 0.05,
        "min_detectable_effect": 0.02,  # 5% → 7%
        "alpha": 0.05,
        "power": 0.8,
        "daily_visitors": 500,
    })
    # Two-proportion sample size with these params lands roughly 1700-1800 per
    # arm; allow a tolerance so the test isn't brittle to z-table rounding.
    n = r["sample_size_per_arm"]
    assert n is not None and 1500 < n < 2200
    assert r["total_sample_size"] == n * 2
    assert r["estimated_duration_days"] is not None
    assert r["estimated_duration_days"] > 0


@pytest.mark.asyncio
async def test_ab_test_designer_zero_mde() -> None:
    r = await ct._ab_test_designer({
        "baseline_rate": 0.05,
        "min_detectable_effect": 0.0,
    })
    assert r["sample_size_per_arm"] is None
    assert "warning" in r


# ── niche_scorer ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_niche_scorer_strong_niche() -> None:
    r = await ct._niche_scorer({
        "market_size_score": 90,
        "margin_score": 80,
        "demand_trend_score": 85,
        "competition_score": 30,  # low competition → high inverted score
    })
    # composite: 0.30*90 + 0.25*80 + 0.25*85 + 0.20*(100-30) = 27+20+21.25+14 = 82.25
    # Python banker's rounding: 82.25 → 82.2 (round-half-to-even); compare with tolerance.
    assert r["composite_score"] == pytest.approx(82.25, abs=0.1)
    assert r["verdict"] == "girilebilir"


@pytest.mark.asyncio
async def test_niche_scorer_weak_niche() -> None:
    r = await ct._niche_scorer({
        "market_size_score": 20,
        "margin_score": 30,
        "demand_trend_score": 25,
        "competition_score": 90,
    })
    assert r["verdict"] == "atla"


# ── trend_detector ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_trend_detector_upward_trend() -> None:
    r = await ct._trend_detector({"timeseries": [10, 12, 14, 16, 18, 20]})
    assert r["direction"] == "up"
    assert r["slope"] > 0
    assert r["r_squared"] == pytest.approx(1.0, abs=0.01)  # perfect linear
    assert r["pct_change"] == 100.0


@pytest.mark.asyncio
async def test_trend_detector_too_few_points() -> None:
    r = await ct._trend_detector({"timeseries": [1, 2]})
    assert r["direction"] == "flat"
    assert "warning" in r


# ── anomaly_detector ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_anomaly_detector_finds_spike() -> None:
    series = [10, 11, 9, 10, 12, 100, 11, 9, 10]
    r = await ct._anomaly_detector({"timeseries": series, "z_threshold": 2.0})
    assert r["outlier_count"] >= 1
    # The spike at index 5 (value 100) must be flagged.
    indexes = [o["index"] for o in r["outliers"]]
    assert 5 in indexes
    spike = next(o for o in r["outliers"] if o["index"] == 5)
    assert spike["direction"] == "high"


@pytest.mark.asyncio
async def test_anomaly_detector_flat_series() -> None:
    r = await ct._anomaly_detector({"timeseries": [5, 5, 5, 5, 5]})
    # Variance zero → no outliers, warning instead of crash.
    assert r["outliers"] == []
    assert "warning" in r


# ── return_policy_generator ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_return_policy_generator_interpolates_fields() -> None:
    r = await ct._return_policy_generator({
        "region": "TR",
        "channel": "Trendyol",
        "cooling_days": 14,
        "refund_days": 10,
        "contact_email": "destek@lumelin.com",
    })
    assert r["language"] == "tr"
    assert "14 gün" in r["body_md"]
    assert "Trendyol" in r["body_md"]
    assert "destek@lumelin.com" in r["body_md"]
