"""Competitor analysis LLM tools — offline (MockProvider) behaviour.

Without GEMINI_API_KEY the adapters must short-circuit to their deterministic
fallback with ``degraded=True`` while keeping the manifest output shape.
"""
from __future__ import annotations

import pytest

from apps.api.tools.live.llm_tools import (
    _competitor_report_builder_adapter,
    _competitor_review_analyzer_adapter,
)


@pytest.mark.asyncio
async def test_review_analyzer_degrades_without_llm(monkeypatch):
    from apps.api.core.llm.provider import MockProvider
    monkeypatch.setattr(
        "apps.api.tools.live.llm_tools.get_llm_provider", lambda: MockProvider()
    )
    result = await _competitor_review_analyzer_adapter({
        "product": "granit tencere",
        "reviews": ["Kalitesi iyi ama kargo yavaştı", "Sapı iki ayda gevşedi"],
    })
    assert result["degraded"] is True
    assert result["overall_sentiment"] in ("pos", "neg", "neu")
    assert isinstance(result["opportunities"], list)


@pytest.mark.asyncio
async def test_report_builder_degrades_without_llm(monkeypatch):
    from apps.api.core.llm.provider import MockProvider
    monkeypatch.setattr(
        "apps.api.tools.live.llm_tools.get_llm_provider", lambda: MockProvider()
    )
    result = await _competitor_report_builder_adapter({
        "product": "granit tencere",
        "price_data": {"avg": 450.0, "min": 299.9, "max": 699.0},
        "review_insights": {"negative_themes": ["kargo", "sap kalitesi"]},
        "competitors": ["MarkaX", "MarkaY"],
    })
    assert result["degraded"] is True
    assert "actions" in result and isinstance(result["actions"], list)
    assert "summary" in result


@pytest.mark.asyncio
async def test_executor_runs_review_analyzer_for_research_agent():
    from apps.api.core.openclaw.executor import OpenClawExecutor
    from apps.api.tools.live.llm_tools import register

    register()  # lifespan normally does this; tests run without the app
    executor = OpenClawExecutor()
    result = await executor.execute(
        tool_id="competitor_review_analyzer",
        agent_id="market_research_agent",
        payload={"product": "tencere", "reviews": ["çok iyi"]},
    )
    assert result.status == "success"


@pytest.mark.asyncio
async def test_executor_denies_unauthorized_agent():
    from apps.api.core.openclaw.executor import OpenClawExecutor, PermissionDenied

    executor = OpenClawExecutor()
    with pytest.raises(PermissionDenied):
        await executor.execute(
            tool_id="competitor_report_builder",
            agent_id="support_agent",
            payload={"product": "tencere"},
        )
