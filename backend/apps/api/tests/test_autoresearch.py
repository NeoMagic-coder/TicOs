from __future__ import annotations

import json
from pathlib import Path
import uuid
import pytest
from fastapi import HTTPException

from sqlalchemy import select
from apps.api.core.config import get_settings
from apps.api.core.db import init_db
from apps.api.core.autoresearch.engine import AutoResearchEngine
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AutoResearchRunRow
from apps.api.core.hermes.orchestrator import HermesOrchestrator, OrchestrationResult
from apps.api.core.hermes.router import RoutingDecision
from apps.api.core.llm.provider import LLMProvider, LLMResponse
from apps.api.routes.autoresearch import _resolve_program_path


class MockAutoResearchLLM(LLMProvider):
    def __init__(self) -> None:
        self.suggest_call_count = 0
        self.extract_call_count = 0

    async def generate(self, *, system, messages, temperature=0.7, max_tokens=1024, grounding=None) -> LLMResponse:
        last_user = next((m.content for m in reversed(messages) if m.role != "model"), "")

        # Mock Parameter Suggestion
        if "JSON formatında çıktı ver" in last_user:
            self.suggest_call_count += 1
            # Return increasing epsilon value per cycle for testing maximization
            eps = 0.05 * (self.suggest_call_count + 1)
            return LLMResponse(
                text=json.dumps({"epsilon": eps, "max_price_change_pct": 3.0}),
                model="mock-autoresearch-llm",
                tokens_used=10,
            )

        # Mock Metric Extraction
        if "sayısal değeri çıkar" in last_user:
            self.extract_call_count += 1
            # Return an increasing metric value (to simulate improvement)
            val = 2.5 * self.extract_call_count
            return LLMResponse(
                text=str(val),
                model="mock-autoresearch-llm",
                tokens_used=10,
            )

        # Fallback
        return LLMResponse(
            text="Default mock response",
            model="mock-autoresearch-llm",
            tokens_used=10,
        )


class MockOrchestrator(HermesOrchestrator):
    async def handle(self, *, message, history=None, product_context=None, event_sink=None) -> OrchestrationResult:
        # Mock successful run result
        return OrchestrationResult(
            task_id="task_mock_autoresearch",
            summary="İyileştirme yapıldı. expected_revenue_lift_pct degeri 15.0 olarak öngörülmektedir.",
            routing=RoutingDecision(
                primary_agent="dynamic_pricing_agent",
                supporting=[],
                rationale="Test rationale",
                urgency="medium",
            ),
            graph={},
            agent_outputs=[],
            confidence=0.9,
            tools_used=["dynamic_price_engine"],
        )


def test_parse_program():
    markdown_content = """# AutoResearch Recipe: Pricing Optimization Test

## Goal & Metrics
- Target Metric: `expected_revenue_lift_pct`
- Mode: `maximize`
- Base Prompt: "Dynamic Pricing Agent: Run pricing optimization."

## Instructions
1. Baseline test: run defaults.
2. Trial epsilon: change parameters.
"""
    engine = AutoResearchEngine()
    recipe = engine.parse_program(markdown_content)

    assert recipe["recipe_name"] == "Pricing Optimization Test"
    assert recipe["metric_name"] == "expected_revenue_lift_pct"
    assert recipe["mode"] == "maximize"
    assert recipe["base_prompt"] == "Dynamic Pricing Agent: Run pricing optimization."
    assert len(recipe["steps"]) == 2
    assert recipe["steps"][0] == "Baseline test: run defaults."


@pytest.mark.asyncio
async def test_extract_metric_value(monkeypatch):
    mock_llm = MockAutoResearchLLM()
    engine = AutoResearchEngine()
    monkeypatch.setattr(engine, "llm", mock_llm)

    val = await engine._extract_metric_value("expected_revenue_lift_pct degeri 15.0", "expected_revenue_lift_pct")
    # First call will return 2.5 from the mock extract logic
    assert val == 2.5


@pytest.mark.asyncio
async def test_run_loop(tmp_path, monkeypatch):
    program_file = tmp_path / "program.md"
    program_file.write_text(
        """# AutoResearch Recipe: Dynamic Pricing Test

## Goal & Metrics
- Target Metric: `expected_revenue_lift_pct`
- Mode: `maximize`
- Base Prompt: "Optimize pricing."

## Instructions
1. Run step 1.
2. Run step 2.
""",
        encoding="utf-8",
    )

    mock_llm = MockAutoResearchLLM()
    mock_orch = MockOrchestrator()
    engine = AutoResearchEngine(orchestrator=mock_orch, report_dir=tmp_path / "reports")
    monkeypatch.setattr(engine, "llm", mock_llm)

    init_db()
    goal_id = f"goal_test_autoresearch_{uuid.uuid4().hex[:8]}"
    res = await engine.run_loop(goal_id=goal_id, program_path=str(program_file), max_cycles=2)

    assert res["status"] == "completed"
    assert res["recipe_name"] == "Dynamic Pricing Test"
    assert res["metric_name"] == "expected_revenue_lift_pct"
    # Cycle 1 suggestion uses baseline ({"epsilon": 0.1, ...})
    # Cycle 2 suggestion uses mock_llm generate ({"epsilon": 0.1, ...})
    assert res["trials_count"] == 2
    assert Path(res["report_path"]).exists()

    # Query DB to make sure it was logged
    with session_scope() as db:
        stmt = select(AutoResearchRunRow).where(AutoResearchRunRow.goal_id == goal_id)
        rows = db.execute(stmt).scalars().all()
        assert len(rows) == 2
        assert rows[0].recipe_name == "Dynamic Pricing Test"
        assert rows[0].metric_name == "expected_revenue_lift_pct"


def test_program_path_is_restricted_to_allowlisted_directory(tmp_path, monkeypatch):
    program_file = tmp_path / "approved.md"
    program_file.write_text("# Approved", encoding="utf-8")
    monkeypatch.setenv("AUTORESEARCH_PROGRAM_DIR", str(tmp_path))
    get_settings.cache_clear()

    try:
        assert _resolve_program_path("approved.md") == program_file.resolve()
        with pytest.raises(HTTPException) as exc:
            _resolve_program_path("../../etc/passwd.md")
        assert exc.value.status_code == 400
    finally:
        get_settings.cache_clear()
