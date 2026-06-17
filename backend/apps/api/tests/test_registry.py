from __future__ import annotations

import pytest

from apps.api.agents.registry import get_agent_registry
from apps.api.core.openclaw.registry import get_registry


def test_agent_registry_loads_seed():
    reg = get_agent_registry()
    specs = reg.specs()
    assert len(specs) >= 15
    assert any(s.agent_id == "supervisor" for s in specs)
    assert any(s.agent_id == "growth_agent" for s in specs)


def test_tool_registry_loads_manifests():
    reg = get_registry()
    tools = reg.all()
    assert len(tools) >= 10
    assert reg.get("niche_scorer") is not None


def test_permission_scoping():
    reg = get_registry()
    assert reg.is_allowed("niche_scorer", "market_research_agent")
    assert not reg.is_allowed("niche_scorer", "support_agent")


def test_competitor_analysis_tools_registered():
    reg = get_registry()
    analyzer = reg.get("competitor_review_analyzer")
    report = reg.get("competitor_report_builder")
    assert analyzer is not None and analyzer.category == "research"
    assert report is not None and report.category == "research"
    # Permission scoping: research agent yes, support agent no.
    assert reg.is_allowed("competitor_review_analyzer", "market_research_agent")
    assert reg.is_allowed("competitor_report_builder", "pricing_agent")
    assert not reg.is_allowed("competitor_review_analyzer", "support_agent")


@pytest.mark.parametrize("agent_id", ["supervisor", "pricing_agent", "growth_agent"])
def test_known_agents_present(agent_id: str):
    assert get_agent_registry().get(agent_id) is not None
