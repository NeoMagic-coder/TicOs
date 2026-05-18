"""Deterministic compute tools — pure-Python adapters with no external API
and no LLM call.

These tools used to live in the mock router that returned canned shapes;
they're now genuine computations so the orchestrator's numeric outputs are
reproducible and auditable. Wrapped in ``with_breaker`` for consistency with
the rest of the live registry — the breaker rarely trips since the code is
synchronous and side-effect-free, but the wrapper keeps the telemetry shape
uniform.

Tools wired (10):

- ``margin_calculator``       — selling price + cost → marj
- ``cogs_calculator``         — unit_cost + shipping + packaging + commission
- ``campaign_discount_simulator`` — what-if revenue/margin for discount levels
- ``autonomy_policy_check``   — wraps :class:`DecisionEngine.evaluate`
- ``stock_forecast``          — moving-average daily rate → reorder point + ETA
- ``ab_test_designer``        — two-proportion sample size (z-test)
- ``niche_scorer``            — weighted 4-factor 0-100 composite
- ``trend_detector``          — linear regression slope + r²
- ``anomaly_detector``        — z-score over rolling mean/stdev
- ``return_policy_generator`` — rule-based TR template (mesafeli satış mevzuatı)
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any

from apps.api.core.autonomy.decision_engine import AutonomyPolicy, DecisionEngine
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)


def _clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# ── margin_calculator ─────────────────────────────────────────────────────

async def _margin_calculator(payload: dict[str, Any]) -> dict[str, Any]:
    """Marj = (fiyat - maliyet) / fiyat. Negatif fiyat/maliyet sıfırlanır
    çünkü orkestratör bazen kısmi veriyle çağırır."""
    price = max(0.0, float(payload.get("price", payload.get("selling_price", 0)) or 0))
    cost = max(0.0, float(payload.get("cost", 0) or 0))
    if price <= 0:
        return {"margin_try": 0.0, "margin_pct": 0.0, "markup_pct": 0.0, "warning": "Fiyat sıfır veya eksik."}
    margin_try = price - cost
    margin_pct = (margin_try / price) * 100.0
    markup_pct = (margin_try / cost * 100.0) if cost > 0 else float("inf")
    return {
        "price_try": round(price, 2),
        "cost_try": round(cost, 2),
        "margin_try": round(margin_try, 2),
        "margin_pct": round(margin_pct, 2),
        "markup_pct": round(markup_pct, 2) if math.isfinite(markup_pct) else None,
    }


# ── cogs_calculator ───────────────────────────────────────────────────────

async def _cogs_calculator(payload: dict[str, Any]) -> dict[str, Any]:
    """COGS = unit + shipping + packaging + (sale_price * commission_pct/100)."""
    unit = max(0.0, float(payload.get("unit_cost", 0) or 0))
    shipping = max(0.0, float(payload.get("shipping_cost", 0) or 0))
    packaging = max(0.0, float(payload.get("packaging_cost", 0) or 0))
    sale_price = max(0.0, float(payload.get("sale_price", 0) or 0))
    commission_pct = max(0.0, float(payload.get("commission_pct", 0) or 0))
    commission = sale_price * commission_pct / 100.0
    total = unit + shipping + packaging + commission
    return {
        "total_cogs_try": round(total, 2),
        "breakdown": {
            "unit": round(unit, 2),
            "shipping": round(shipping, 2),
            "packaging": round(packaging, 2),
            "commission": round(commission, 2),
        },
        "cogs_pct_of_price": round((total / sale_price * 100.0), 2) if sale_price > 0 else None,
    }


# ── campaign_discount_simulator ───────────────────────────────────────────

async def _campaign_discount_simulator(payload: dict[str, Any]) -> dict[str, Any]:
    """What-if over a discount ladder. Volume lift uses a simple price-
    elasticity assumption (elasticity defaults to -1.5 — typical for
    discretionary e-commerce categories). Caller can override."""
    base_price = max(0.0, float(payload.get("base_price", 0) or 0))
    unit_cost = max(0.0, float(payload.get("unit_cost", 0) or 0))
    baseline_volume = max(0.0, float(payload.get("baseline_volume", 100) or 100))
    discount_pcts = payload.get("discount_pct") or payload.get("discounts") or [5, 10, 15, 20, 25]
    if isinstance(discount_pcts, (int, float)):
        discount_pcts = [discount_pcts]
    elasticity = float(payload.get("elasticity", -1.5))

    if base_price <= 0:
        return {"scenarios": [], "warning": "base_price gerekli."}

    scenarios = []
    for d in discount_pcts:
        d = float(d)
        sale_price = base_price * (1 - d / 100.0)
        volume_mult = (1 - d / 100.0) ** elasticity  # >1 when d>0, elasticity<0
        volume = baseline_volume * volume_mult
        revenue = volume * sale_price
        margin = volume * (sale_price - unit_cost)
        scenarios.append({
            "discount_pct": round(d, 1),
            "sale_price": round(sale_price, 2),
            "projected_volume": round(volume, 1),
            "revenue_try": round(revenue, 2),
            "margin_try": round(margin, 2),
        })
    # Recommend the scenario with highest margin; mark the gross-revenue winner
    # separately so the agent can weigh tradeoffs.
    best_margin = max(scenarios, key=lambda s: s["margin_try"])
    best_revenue = max(scenarios, key=lambda s: s["revenue_try"])
    return {
        "scenarios": scenarios,
        "best_margin_pct": best_margin["discount_pct"],
        "best_revenue_pct": best_revenue["discount_pct"],
        "elasticity_assumed": elasticity,
    }


# ── autonomy_policy_check ─────────────────────────────────────────────────

# One shared engine — policy is rebuilt per call so settings stay live.
_AUTONOMY_ENGINE = DecisionEngine()


async def _autonomy_policy_check(payload: dict[str, Any]) -> dict[str, Any]:
    """Wraps DecisionEngine.evaluate. The frontend approvals page already
    calls this through the orchestrator; exposing it as a live tool means
    other agents can policy-check their own actions before submitting."""
    outcome = _AUTONOMY_ENGINE.evaluate(
        action_type=str(payload.get("action_type", "generic")),
        value=float(payload.get("value", 0) or 0),
        risk_level=str(payload.get("risk_level", "low")),
        confidence=float(payload.get("confidence", 1.0) or 1.0),
    )
    return {
        "status": outcome.status,
        "reason": outcome.reason,
        "decision_id": outcome.decision_id,
        "decided_at": outcome.decided_at.isoformat(),
    }


# ── stock_forecast ────────────────────────────────────────────────────────

async def _stock_forecast(payload: dict[str, Any]) -> dict[str, Any]:
    """SKU bazlı reorder noktası + stok-tükenme tahmini.

    Inputs:
        history: günlük satış (en az 1 nokta)
        current_stock: mevcut stok
        lead_time_days: yeni stok alımı için bekleme süresi (varsayılan 14)
        safety_stock_days: güvenlik stoğu pencere (varsayılan 7)

    Reorder point = (avg_daily_sales × lead_time) + safety stock.
    Days_until_stockout = current_stock / avg_daily_sales.
    """
    history = payload.get("history") or []
    history = [float(x) for x in history if x is not None]
    if not history:
        # No history → can't forecast; return zeroes with warning instead of
        # raising so the orchestrator gets a structured response.
        return {
            "avg_daily_sales": 0.0,
            "days_until_stockout": None,
            "reorder_point": 0,
            "warning": "Geçmiş veri yok — tahmin üretilemedi.",
        }

    avg_daily = sum(history) / len(history)
    current_stock = max(0.0, float(payload.get("current_stock", 0) or 0))
    lead = max(1, int(payload.get("lead_time_days", 14)))
    safety = max(0, int(payload.get("safety_stock_days", 7)))

    days_until_stockout = (current_stock / avg_daily) if avg_daily > 0 else None
    reorder_point = math.ceil(avg_daily * lead + avg_daily * safety)
    stockout_date = (
        (date.today() + timedelta(days=int(days_until_stockout))).isoformat()
        if days_until_stockout is not None
        else None
    )
    severity = (
        "critical" if days_until_stockout is not None and days_until_stockout < lead
        else "warning" if days_until_stockout is not None and days_until_stockout < (lead + safety)
        else "ok"
    )
    return {
        "avg_daily_sales": round(avg_daily, 2),
        "days_until_stockout": round(days_until_stockout, 1) if days_until_stockout else None,
        "stockout_date": stockout_date,
        "reorder_point": int(reorder_point),
        "severity": severity,
    }


# ── ab_test_designer ──────────────────────────────────────────────────────

# Two-proportion sample size formula (one-sided z-test). Hard-coded z values
# for the most common alpha/power pairs so we don't need scipy at runtime.
_Z = {
    0.05: 1.6449,   # one-sided alpha = 0.05
    0.025: 1.9600,  # two-sided alpha = 0.05
    0.01: 2.3263,
}
_Z_POWER = {0.8: 0.8416, 0.9: 1.2816, 0.95: 1.6449}


async def _ab_test_designer(payload: dict[str, Any]) -> dict[str, Any]:
    """Minimum sample size per arm for a two-proportion test.
    n = (z_a + z_b)^2 * (p1*(1-p1) + p2*(1-p2)) / (p2 - p1)^2"""
    p1 = _clip(float(payload.get("baseline_rate", 0.05)), 0.0001, 0.9999)
    mde = float(payload.get("min_detectable_effect", 0.02))
    p2 = _clip(p1 + mde, 0.0001, 0.9999)
    alpha = float(payload.get("alpha", 0.05))
    power = float(payload.get("power", 0.8))
    hypothesis = str(payload.get("hypothesis", "")).strip()[:200]

    z_a = _Z.get(alpha, 1.96)
    z_b = _Z_POWER.get(power, 0.84)
    denom = (p2 - p1) ** 2
    if denom <= 0:
        return {
            "sample_size_per_arm": None,
            "warning": "MDE çok küçük veya baseline ≥ 1 — sample size hesaplanamadı.",
        }
    n = ((z_a + z_b) ** 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / denom
    n_per_arm = int(math.ceil(n))
    # Daily-visitor input is optional; if given we can estimate run-time.
    daily_visitors = float(payload.get("daily_visitors", 0) or 0)
    duration_days = (
        math.ceil(n_per_arm * 2 / daily_visitors)
        if daily_visitors > 0 else None
    )
    return {
        "hypothesis": hypothesis or "baseline'ı statistically anlamlı geçer",
        "sample_size_per_arm": n_per_arm,
        "total_sample_size": n_per_arm * 2,
        "baseline_rate": round(p1, 4),
        "treatment_rate_target": round(p2, 4),
        "alpha": alpha,
        "power": power,
        "estimated_duration_days": duration_days,
    }


# ── niche_scorer ──────────────────────────────────────────────────────────

async def _niche_scorer(payload: dict[str, Any]) -> dict[str, Any]:
    """Composite 0-100 score from 4 weighted factors. Each factor caller
    provides on a 0-100 scale; we apply the canonical e-commerce weights
    (market 0.30, margin 0.25, demand 0.25, competition 0.20)."""
    market = _clip(float(payload.get("market_size_score", 50)), 0, 100)
    margin = _clip(float(payload.get("margin_score", 50)), 0, 100)
    demand = _clip(float(payload.get("demand_trend_score", 50)), 0, 100)
    competition = _clip(float(payload.get("competition_score", 50)), 0, 100)
    # Higher competition is worse → invert before weighting.
    competition_inverted = 100 - competition
    composite = (
        0.30 * market
        + 0.25 * margin
        + 0.25 * demand
        + 0.20 * competition_inverted
    )
    verdict = (
        "girilebilir" if composite >= 70
        else "değerlendir" if composite >= 50
        else "atla"
    )
    return {
        "composite_score": round(composite, 1),
        "verdict": verdict,
        "factors": {
            "market_size": market,
            "margin": margin,
            "demand_trend": demand,
            "competition": competition,
        },
        "weights": {"market": 0.30, "margin": 0.25, "demand": 0.25, "competition": 0.20},
    }


# ── trend_detector ────────────────────────────────────────────────────────

async def _trend_detector(payload: dict[str, Any]) -> dict[str, Any]:
    """Linear regression over a time series. Returns slope, intercept, r²,
    direction (up/down/flat), and a deltas summary so the agent can describe
    the trend without re-running stats."""
    series = payload.get("timeseries") or payload.get("series") or []
    series = [float(x) for x in series if x is not None]
    if len(series) < 3:
        return {
            "direction": "flat",
            "slope": 0.0,
            "r_squared": 0.0,
            "warning": "En az 3 nokta gerekli.",
        }

    n = len(series)
    x_vals = list(range(n))
    mean_x = sum(x_vals) / n
    mean_y = sum(series) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_vals, series))
    den_x = sum((x - mean_x) ** 2 for x in x_vals)
    slope = num / den_x if den_x else 0.0
    intercept = mean_y - slope * mean_x
    ss_tot = sum((y - mean_y) ** 2 for y in series)
    ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in zip(x_vals, series))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 1.0

    # Direction call uses slope magnitude relative to series mean — tiny
    # slopes on big magnitudes are "flat".
    rel = abs(slope) / abs(mean_y) if mean_y else abs(slope)
    direction = "up" if slope > 0 and rel > 0.01 else "down" if slope < 0 and rel > 0.01 else "flat"
    pct_change = ((series[-1] - series[0]) / series[0] * 100.0) if series[0] else 0.0
    return {
        "direction": direction,
        "slope": round(slope, 4),
        "intercept": round(intercept, 4),
        "r_squared": round(r_squared, 4),
        "first": round(series[0], 2),
        "last": round(series[-1], 2),
        "pct_change": round(pct_change, 2),
    }


# ── anomaly_detector ──────────────────────────────────────────────────────

async def _anomaly_detector(payload: dict[str, Any]) -> dict[str, Any]:
    """Z-score over the full series. Points with |z| >= threshold flagged."""
    series = payload.get("timeseries") or payload.get("series") or []
    series = [float(x) for x in series if x is not None]
    z_threshold = float(payload.get("z_threshold", 2.5))
    if len(series) < 3:
        return {"outliers": [], "warning": "En az 3 nokta gerekli."}

    mean = sum(series) / len(series)
    var = sum((x - mean) ** 2 for x in series) / len(series)
    stdev = math.sqrt(var)
    if stdev <= 0:
        return {"outliers": [], "mean": mean, "stdev": 0.0, "warning": "Varyans sıfır."}

    outliers = []
    for i, x in enumerate(series):
        z = (x - mean) / stdev
        if abs(z) >= z_threshold:
            outliers.append({
                "index": i,
                "value": round(x, 2),
                "z_score": round(z, 2),
                "direction": "high" if z > 0 else "low",
            })
    return {
        "outliers": outliers,
        "mean": round(mean, 2),
        "stdev": round(stdev, 2),
        "z_threshold": z_threshold,
        "outlier_count": len(outliers),
    }


# ── return_policy_generator ───────────────────────────────────────────────

_RETURN_POLICY_TEMPLATE_TR = (
    "## İade ve Cayma Hakkı\n\n"
    "Mesafeli Sözleşmeler Yönetmeliği uyarınca, ürünü teslim aldığınız "
    "tarihten itibaren **{cooling_days} gün** içinde herhangi bir gerekçe "
    "göstermeksizin sözleşmeden cayma hakkınız bulunmaktadır.\n\n"
    "### Koşullar\n"
    "- Ürün, ambalajı ve aksesuarları ile birlikte hasarsız iade edilmelidir.\n"
    "- Hijyen ürünleri, açıldığı ölçüde iade kabul edilmemektedir.\n"
    "- Kişiye özel üretilen ürünler cayma hakkı kapsamı dışındadır.\n\n"
    "### İade Süreci\n"
    "1. {channel} hesabınızdan 'İade Talebi' oluşturun.\n"
    "2. Anlaşmalı kargo ile ücretsiz iade gönderimi sağlanır ({region}).\n"
    "3. Ürün incelendikten sonra **{refund_days} iş günü** içinde "
    "ödemeniz iade edilir.\n\n"
    "### İletişim\n"
    "Sorularınız için: **{contact_email}**"
)


async def _return_policy_generator(payload: dict[str, Any]) -> dict[str, Any]:
    """Templated Turkish return policy that complies with mesafeli satış
    mevzuatı. Inputs let the caller customize cooling period, channel,
    region, contact. Returns markdown body + structured fields so the UI
    can render either."""
    region = str(payload.get("region", "TR")).upper()
    channel = str(payload.get("channel", "Shopify")).strip() or "mağaza"
    cooling_days = int(payload.get("cooling_days", 14))
    refund_days = int(payload.get("refund_days", 10))
    contact_email = str(payload.get("contact_email", "destek@example.com")).strip()
    body = _RETURN_POLICY_TEMPLATE_TR.format(
        cooling_days=cooling_days,
        channel=channel,
        region=region,
        refund_days=refund_days,
        contact_email=contact_email,
    )
    return {
        "title": "İade ve Cayma Hakkı",
        "body_md": body,
        "cooling_days": cooling_days,
        "refund_days": refund_days,
        "region": region,
        "language": "tr",
        "channel": channel,
    }


# ── registry ──────────────────────────────────────────────────────────────

_REGISTRATIONS = [
    ("margin_calculator", _margin_calculator),
    ("cogs_calculator", _cogs_calculator),
    ("campaign_discount_simulator", _campaign_discount_simulator),
    ("autonomy_policy_check", _autonomy_policy_check),
    ("stock_forecast", _stock_forecast),
    ("ab_test_designer", _ab_test_designer),
    ("niche_scorer", _niche_scorer),
    ("trend_detector", _trend_detector),
    ("anomaly_detector", _anomaly_detector),
    ("return_policy_generator", _return_policy_generator),
]


async def _no_op_mock(_payload: dict[str, Any]) -> dict[str, Any]:
    """Breaker safety net — these adapters are pure-Python, so the breaker
    almost never trips, but we still wire a fallback for shape consistency."""
    return {"degraded": True, "degraded_reason": "breaker_open"}


def register() -> None:
    for tool_id, adapter in _REGISTRATIONS:
        register_live_adapter(
            tool_id,
            with_breaker(
                tool_id=tool_id,
                adapter=adapter,
                mock_fallback=_no_op_mock,
            ),
        )
    log.info("live.compute_tools.registered", tools=len(_REGISTRATIONS))
