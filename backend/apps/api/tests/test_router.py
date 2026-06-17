from __future__ import annotations

from apps.api.tests._keyword_route import keyword_route as route


def test_route_pricing_intent():
    decision = route(
        "Fiyatlarımı rakiplerle karşılaştır, marj korunarak indirim önerisi ver",
        available_agents=["pricing_agent", "marketing_agent", "supervisor"],
    )
    assert decision.primary_agent == "pricing_agent"


def test_route_urgency_critical():
    decision = route(
        "ACİL: müşteri şikayetleri sosyal medyada viral oldu, kriz var",
        available_agents=["support_agent", "review_reputation_agent", "supervisor"],
    )
    assert decision.urgency in {"critical", "high"}


def test_route_fallback_to_supervisor():
    decision = route(
        "merhaba",
        available_agents=["supervisor"],
    )
    assert decision.primary_agent == "supervisor"
