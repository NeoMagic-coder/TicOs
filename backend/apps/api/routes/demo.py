"""Demo endpoints.

``GET  /api/v1/demo/results`` — pre-baked ROI Story KPI data for the
    Dashboard banner.
``POST /api/v1/demo/play``    — Server-Sent Events. Runs a pre-baked 6-step
    "3 saatlik yarış" senaryosunu sıkıştırılmış şekilde oynatır
    (default ``speed_multiplier=60`` → ~3 dakika). Her adımda mevcut
    ``DecisionEngine`` ve ``HybridPricingPolicy`` kullanılır; yeni karar
    mantığı yazılmaz. Sonuç satır-satır ``demo_results`` tablosuna yazılır.

SSE wire format yerel olarak ``chat.py``'deki ile aynı; coupling
oluşturmamak için 3 satırlık ``_sse`` helper'ı burada da bulunur.

Stream events:
    step_started    {idx, name, agent_id}
    step_completed  {idx, name, status, decision_status, result_excerpt}
    summary         {session_id, task_count,
                     auto_decisions_vs_escalations, estimated_roi}
    error           {error}
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from apps.api.core.autonomy.decision_engine import (
    AutonomyPolicy,
    DecisionEngine,
    HybridPricingPolicy,
    PricingSignal,
)
from apps.api.core.autonomy.negotiation import NegotiationProtocol, NegotiationTemplate
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import DemoResultRow

router = APIRouter(prefix="/demo", tags=["demo"])


# ── GET /results — static ROI Story KPI data ─────────────────────────────────


@router.get("/results")
async def demo_results() -> dict:
    """Return pre-baked ROI Story KPI data for the Dashboard banner."""
    return {
        "autonomous_decisions": 47,
        "escalated_to_human": 3,
        "gross_margin_pct": 18.4,
        "gemini_cost_usd": 0.41,
        "cost_per_op_usd": 0.41,
        "time_savings_pct": 80.0,
        "human_equivalent": {"people": 5, "duration": "1 hafta"},
        "profit_margin_timeline": [
            {"hour": 0, "margin": 0},
            {"hour": 1, "margin": 5.2},
            {"hour": 2, "margin": 9.8},
            {"hour": 3, "margin": 14.1},
            {"hour": 4, "margin": 16.7},
            {"hour": 5, "margin": 18.4},
        ],
        "decisions_timeline": [
            {"hour": 0, "decisions": 0, "escalated": 0},
            {"hour": 1, "decisions": 12, "escalated": 1},
            {"hour": 2, "decisions": 28, "escalated": 2},
            {"hour": 3, "decisions": 39, "escalated": 2},
            {"hour": 4, "decisions": 44, "escalated": 3},
            {"hour": 5, "decisions": 47, "escalated": 3},
        ],
    }


# ── POST /play — SSE compressed-demo playback ────────────────────────────────


def _sse(event: str, data: dict[str, Any]) -> str:
    """Format one SSE frame (mirror ``chat.py::_sse``)."""
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


class DemoPlayRequest(BaseModel):
    scenario: Literal["3hour_race"] = "3hour_race"
    speed_multiplier: int = Field(default=60, ge=1, le=600)
    competitor_url: str | None = None


# base_seconds sum ≈ 10800 (3 saat); 60x → ~180s wall time; 600x → ~18s.
# tools — used to surface tool_called events on the Autonomy Console audit
# panel during demo playback. Cost figures are illustrative (mock) so the
# meter shows movement without billing real Gemini calls.
_STEPS: list[dict[str, Any]] = [
    {
        "name": "product_analysis", "agent_id": "market_research_agent", "base_seconds": 1200,
        "tools": [
            {"tool_id": "niche_scorer",           "cost_usd": 0.0008, "duration_ms": 180},
            {"tool_id": "web_search_grounded",    "cost_usd": 0.0042, "duration_ms": 720},
            {"tool_id": "image_analysis",         "cost_usd": 0.0035, "duration_ms": 540},
        ],
    },
    {
        "name": "brand_identity_generation", "agent_id": "brand_identity_agent", "base_seconds": 1500,
        "tools": [
            {"tool_id": "brand_name_generator",   "cost_usd": 0.0021, "duration_ms": 380},
            {"tool_id": "color_palette_generator","cost_usd": 0.0018, "duration_ms": 320},
            {"tool_id": "brand_visual_generator", "cost_usd": 0.0185, "duration_ms": 2400, "generate_image": True},
        ],
    },
    {
        "name": "pricing_optimization", "agent_id": "dynamic_pricing_agent", "base_seconds": 2100,
        "tools": [
            {"tool_id": "margin_calculator",          "cost_usd": 0.0,    "duration_ms": 12},
            {"tool_id": "campaign_discount_simulator","cost_usd": 0.0,    "duration_ms": 18},
            {"tool_id": "autonomy_policy_check",      "cost_usd": 0.0,    "duration_ms": 6},
        ],
    },
    {
        "name": "trendyol_listing", "agent_id": "marketing_agent", "base_seconds": 1800,
        "tools": [
            {"tool_id": "listing_compliance_check", "cost_usd": 0.0024, "duration_ms": 410},
            {"tool_id": "trendyol_create_listing",  "cost_usd": 0.005,  "duration_ms": 820},
            {"tool_id": "trendyol_update_price",    "cost_usd": 0.0,    "duration_ms": 650},
        ],
    },
    {
        "name": "negotiation_with_supplier", "agent_id": "negotiation_agent", "base_seconds": 2700,
        "tools": [
            {"tool_id": "draft_reply_generator", "cost_usd": 0.0028, "duration_ms": 460},
            {"tool_id": "draft_reply_generator", "cost_usd": 0.0027, "duration_ms": 440},
            {"tool_id": "draft_reply_generator", "cost_usd": 0.0029, "duration_ms": 470},
        ],
    },
    {
        "name": "roi_calculation", "agent_id": "analytics_agent", "base_seconds": 1500,
        "tools": [
            {"tool_id": "cogs_calculator",   "cost_usd": 0.0, "duration_ms": 8},
            {"tool_id": "margin_calculator", "cost_usd": 0.0, "duration_ms": 10},
        ],
    },
]


async def _run_product_analysis(
    engine: DecisionEngine, state: dict[str, Any], competitor_url: str | None,
) -> tuple[dict[str, Any], Any]:
    result = {
        "competitor_url": competitor_url or "https://example-competitor.com",
        "niche_score": 0.78,
        "tam_estimate_try": 12_000_000,
        "top_keywords": ["lavanta yağı", "uyku spreyi", "doğal aromaterapi"],
    }
    outcome = engine.evaluate(
        action_type="analysis", value=0.0, risk_level="low", confidence=0.92,
    )
    state["competitor_price"] = 189.0
    return result, outcome


async def _run_brand_identity(
    engine: DecisionEngine, state: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    result = {
        "brand_name": "LunaRest",
        "tagline": "Doğanın huzurlu uykusu",
        "palette": ["#3B2E5A", "#A78BFA", "#F4F0FF"],
        "logo_concept": "Gece açan lavanta",
    }
    outcome = engine.evaluate(
        action_type="analysis", value=0.0, risk_level="low", confidence=0.88,
    )
    return result, outcome


async def _run_pricing_optimization(
    policy: HybridPricingPolicy, state: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    signal = PricingSignal(
        current_price=199.0,
        roas=2.8,
        competitor_price=state.get("competitor_price", 189.0),
        margin_pct=0.32,
        min_margin_pct=0.22,
    )
    decision = policy.decide(signal)
    state["new_price"] = decision.new_price
    return (
        {
            "current_price": signal.current_price,
            "new_price": decision.new_price,
            "change_pct": decision.change_pct,
            "action": decision.action,
            "source": decision.source,
            "reason": decision.reason,
        },
        decision,
    )


async def _run_trendyol_listing(
    engine: DecisionEngine, state: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    result = {
        "marketplace": "trendyol",
        "title": f"{state.get('brand_name', 'LunaRest')} Uyku Spreyi 100ml",
        "compliance_flags": [],
        "ready_to_publish": True,
        "listing_price_try": state.get("new_price", 199.0),
    }
    outcome = engine.evaluate(
        action_type="listing_publish",
        value=0.0,
        risk_level="medium",
        confidence=0.85,
    )
    return result, outcome


async def _run_negotiation(
    engine: DecisionEngine, state: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    tmpl = NegotiationTemplate(
        scenario="supplier_rfq",
        context={"current_cogs": 65.0, "target_cogs": 48.0, "floor_price": 42.0},
        style="moderate",
        max_rounds=3,
    )
    neg_state = NegotiationProtocol().run(tmpl.build_state())
    final_price = neg_state.final_price or neg_state.seller_walk_away
    state["final_cogs"] = final_price
    outcome = engine.evaluate(
        action_type="negotiation_commit_try",
        value=final_price,
        risk_level="medium",
        confidence=0.82,
    )
    return (
        {
            "scenario": "supplier_rfq",
            "rounds": [
                {"round_no": r.round_no, "buyer": r.buyer_offer, "seller": r.seller_offer, "gap": r.gap}
                for r in neg_state.rounds
            ],
            "outcome": neg_state.outcome,
            "final_price_try": final_price,
            "summary": tmpl.summary(neg_state),
        },
        outcome,
    )


async def _run_roi_calculation(
    engine: DecisionEngine, state: dict[str, Any],
) -> tuple[dict[str, Any], Any]:
    new_price = float(state.get("new_price", 199.0))
    cogs = float(state.get("final_cogs", 55.0))
    units = 1000
    revenue = new_price * units
    cost = cogs * units
    roi = (revenue - cost) / cost if cost > 0 else 0.0
    state["estimated_roi"] = roi
    result = {
        "units_projected": units,
        "revenue_try": revenue,
        "cogs_try": cost,
        "profit_try": revenue - cost,
        "roi": round(roi, 4),
    }
    outcome = engine.evaluate(
        action_type="analysis", value=0.0, risk_level="low", confidence=0.95,
    )
    return result, outcome


def _is_auto(outcome: Any) -> tuple[bool, str | None, str | None]:
    """Normalise both ``DecisionOutcome`` and ``PricingDecision`` to a
    (auto_approved, status_string, decision_id) triple."""
    if hasattr(outcome, "status") and hasattr(outcome, "decision_id"):
        return (outcome.status == "auto_approved", outcome.status, outcome.decision_id)
    if hasattr(outcome, "action"):
        action = outcome.action
        if action == "needs_approval":
            return (False, "needs_approval", None)
        return (True, f"auto:{action}", None)
    return (True, None, None)


def _persist_row(row: DemoResultRow) -> None:
    with session_scope() as s:
        s.add(row)


@router.post("/play")
async def demo_play(req: DemoPlayRequest) -> StreamingResponse:
    session_id = f"demo_{uuid.uuid4().hex[:12]}"
    speed = max(1, min(int(req.speed_multiplier), 600))

    engine = DecisionEngine(AutonomyPolicy())
    pricing_policy = HybridPricingPolicy(seed=42)
    state: dict[str, Any] = {}
    auto_count = 0
    escalated_count = 0

    async def stream():
        nonlocal auto_count, escalated_count

        try:
            for idx, step in enumerate(_STEPS):
                name = step["name"]
                agent_id = step["agent_id"]
                base_seconds = float(step["base_seconds"])
                yield _sse(
                    "step_started",
                    {"session_id": session_id, "idx": idx, "name": name, "agent_id": agent_id},
                )

                # Compressed wall-clock pacing — never less than 50ms so the
                # SSE client can render the start event before the end event.
                total_wait = max(0.05, base_seconds / speed)
                tools_for_step: list[dict[str, Any]] = step.get("tools", []) or []
                if tools_for_step:
                    slice_wait = total_wait / (len(tools_for_step) + 1)
                    for tool in tools_for_step:
                        await asyncio.sleep(slice_wait)
                        # If a tool is flagged for real image generation,
                        # invoke generate_image() so the demo produces an
                        # actual Gemini visual (when GEMINI_API_KEY is set).
                        image_url = None
                        if tool.get("generate_image"):
                            try:
                                from apps.api.core.llm.image import generate_image
                                prompt = (
                                    f"Minimal, premium brand visual for "
                                    f"'{state.get('brand_name', 'LunaRest')}' — "
                                    "lavender + deep violet palette, "
                                    "calming nighttime mood, product packaging close-up."
                                )
                                img = await generate_image(prompt=prompt)
                                if isinstance(img, dict) and img.get("url"):
                                    image_url = img["url"]
                                    state["brand_image_url"] = image_url
                            except Exception as exc:  # noqa: BLE001
                                log_evt = str(exc)[:200]  # noqa: F841
                        yield _sse(
                            "tool_called",
                            {
                                "session_id": session_id,
                                "idx": idx,
                                "agent_id": agent_id,
                                "tool_id": tool["tool_id"],
                                "cost_usd": tool.get("cost_usd", 0.0),
                                "duration_ms": tool.get("duration_ms", 0),
                                "image_url": image_url,
                            },
                        )
                    await asyncio.sleep(slice_wait)
                else:
                    await asyncio.sleep(total_wait)

                if name == "product_analysis":
                    result, outcome = await _run_product_analysis(engine, state, req.competitor_url)
                elif name == "brand_identity_generation":
                    result, outcome = await _run_brand_identity(engine, state)
                    state["brand_name"] = result.get("brand_name")
                elif name == "pricing_optimization":
                    result, outcome = await _run_pricing_optimization(pricing_policy, state)
                elif name == "trendyol_listing":
                    result, outcome = await _run_trendyol_listing(engine, state)
                elif name == "negotiation_with_supplier":
                    result, outcome = await _run_negotiation(engine, state)
                elif name == "roi_calculation":
                    result, outcome = await _run_roi_calculation(engine, state)
                else:
                    result, outcome = ({}, None)

                auto, status, decision_id = _is_auto(outcome)
                if auto:
                    auto_count += 1
                else:
                    escalated_count += 1

                row = DemoResultRow(
                    id=uuid.uuid4().hex,
                    session_id=session_id,
                    scenario=req.scenario,
                    step_index=idx,
                    step_name=name,
                    agent_id=agent_id,
                    decision_status=status,
                    decision_id=decision_id,
                    auto_approved=auto,
                    result_json=json.dumps(result, ensure_ascii=False, default=str),
                    created_at=datetime.utcnow(),
                )
                await asyncio.to_thread(_persist_row, row)

                # Aggregate cost + confidence so the Autonomy Console DAG can
                # render per-node tooltips during demo playback.
                step_cost = float(sum(float(t.get("cost_usd") or 0.0) for t in tools_for_step))
                step_confidence: float | None = None
                if outcome is not None:
                    step_confidence = (
                        getattr(outcome, "confidence", None)
                        if hasattr(outcome, "confidence")
                        else None
                    )
                if step_confidence is None:
                    step_confidence = 0.85 if auto else 0.6

                yield _sse(
                    "step_completed",
                    {
                        "session_id": session_id,
                        "idx": idx,
                        "name": name,
                        "agent_id": agent_id,
                        "status": "completed",
                        "decision_status": status,
                        "auto_approved": auto,
                        "confidence": round(float(step_confidence), 3),
                        "cost_usd": round(step_cost, 6),
                        "result_excerpt": result,
                    },
                )

            summary = {
                "session_id": session_id,
                "task_count": len(_STEPS),
                "auto_decisions_vs_escalations": {
                    "auto": auto_count,
                    "escalated": escalated_count,
                },
                "estimated_roi": round(float(state.get("estimated_roi", 0.0)), 4),
            }
            yield _sse("summary", summary)

            # Simulated Trendyol order so the demo viewer sees the post-launch
            # outcome described in the demo scenario. Numbers are deterministic
            # to keep video captures stable.
            yield _sse(
                "order_received",
                {
                    "session_id": session_id,
                    "marketplace": "trendyol",
                    "order_id": f"TR-{session_id[-5:].upper()}",
                    "amount_try": round(float(state.get("new_price", 199.0)), 2),
                    "buyer": "İstanbul · Demo",
                },
            )
        except Exception as exc:  # pragma: no cover — surface via SSE
            yield _sse("error", {"error": str(exc)[:400]})

    return StreamingResponse(stream(), media_type="text/event-stream")
