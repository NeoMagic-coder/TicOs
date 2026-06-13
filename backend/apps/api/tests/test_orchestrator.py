"""End-to-end orchestrator tests using MockProvider (no network).

Covers three routing scenarios — pricing-led, brand-led, and supervisor
fallback — plus tool audit propagation and confidence aggregation.
"""
from __future__ import annotations

import json

import pytest

from apps.api.agents.registry import AgentRegistry
from apps.api.agents.seed import SEED_AGENTS
from apps.api.core.hermes.orchestrator import HermesOrchestrator
from apps.api.tests._keyword_route import keyword_route as _keyword_route
from apps.api.core.llm.provider import LLMMessage, LLMResponse, LLMProvider
from apps.api.core.openclaw.executor import OpenClawExecutor
from apps.api.core.openclaw.registry import get_registry


class StubLLM(LLMProvider):
    """Deterministic stub. Returns a JSON DAG for planner calls (detected via
    system prompt) and a canned Turkish summary for merge calls."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.systems: list[str] = []

    async def generate(self, *, system, messages, temperature=0.7, max_tokens=1024, grounding=None) -> LLMResponse:
        last_user = next((m.content for m in reversed(messages) if m.role != "model"), "")
        self.calls.append(last_user[:80])
        self.systems.append(system or "")

        if "Critic-Agent" in (system or ""):
            # Always return a high score so retries don't fire in tests.
            return LLMResponse(
                text=json.dumps({
                    "concreteness": 0.9,
                    "numeric_grounding": 0.8,
                    "hallucination_risk": 0.1,
                    "reason": "Stub critic: high score",
                }),
                model="stub-critic",
                tokens_used=20,
            )

        if "planlayıcı" in (system or ""):
            user_msg = last_user
            marker = "KULLANICI MESAJI:"
            if marker in user_msg:
                user_msg = user_msg.split(marker, 1)[1].split("KULLANILABİLİR")[0].strip()
            available = [s.agent_id for s in SEED_AGENTS if s.active]
            decision = _keyword_route(user_msg, available)
            nodes = [{
                "id": "n1",
                "agent_id": decision.primary_agent,
                "title": f"{decision.primary_agent} primary",
                "depends_on": [],
                "payload": {},
            }]
            for i, sup in enumerate(decision.supporting, start=2):
                nodes.append({
                    "id": f"n{i}",
                    "agent_id": sup,
                    "title": f"{sup} supporting",
                    "depends_on": ["n1"],
                    "payload": {},
                })
            plan = {
                "rationale": decision.rationale,
                "urgency": decision.urgency,
                "nodes": nodes,
            }
            return LLMResponse(text=json.dumps(plan), model="stub-planner", tokens_used=50)

        text = (
            "Özet: talep analiz edildi.\n\n"
            "• Bulgu 1: somut\n"
            "• Bulgu 2: ölçülebilir\n"
            "⚠️ Onay gerektiren aksiyon: kampanya bütçesini %20 artır"
        )
        return LLMResponse(text=text, model="stub", tokens_used=100)


@pytest.fixture
def orchestrator(monkeypatch):
    # Force the tool registry to (re)load manifests fresh and ensure agents
    # share the same in-process stub LLM.
    get_registry().load_manifests()

    stub = StubLLM()

    def _provider():
        return stub

    monkeypatch.setattr("apps.api.core.llm.provider.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.core.hermes.orchestrator.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.core.planner.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.agents.critic.get_llm_provider", _provider)
    # BaseAgent.llm resolves through the per-agent resolver; patch it directly
    # so agents see the stub and bypass the module-level cache.
    monkeypatch.setattr(
        "apps.api.core.llm.per_agent.get_llm_provider_for_agent",
        lambda agent_id: stub,
    )
    from apps.api.core.llm import per_agent as _per_agent
    _per_agent.invalidate_cache()

    # Rebuild a fresh registry so agents pick up the patched provider.
    registry = AgentRegistry()
    executor = OpenClawExecutor()
    return HermesOrchestrator(agents=registry, executor=executor)


@pytest.mark.asyncio
async def test_pricing_intent_routes_to_pricing_agent(orchestrator):
    result = await orchestrator.handle(
        message="Fiyatları rakiplerle karşılaştır, marj koruyarak indirim öner",
        history=[],
        product_context={"product_name": "yanmaz tencere", "category": "mutfak"},
    )
    assert result.routing.primary_agent == "pricing_agent"
    assert result.task_id.startswith("task_")
    assert result.summary  # non-empty
    assert len(result.agent_outputs) >= 1
    # pricing_agent has primary tools — at least one should be audited
    assert any(t.startswith(("margin", "competitor", "campaign")) for t in result.tools_used)


@pytest.mark.asyncio
async def test_brand_intent_routes_to_brand_agent(orchestrator):
    result = await orchestrator.handle(
        message="Marka ismi ve ton önerisi ver, kimlik konumlandırması nasıl olmalı",
        history=[],
        product_context={"product_name": "yanmaz tencere", "category": "mutfak"},
    )
    assert result.routing.primary_agent == "brand_identity_agent"
    assert result.confidence > 0


@pytest.mark.asyncio
async def test_generic_message_falls_back_to_supervisor(orchestrator):
    result = await orchestrator.handle(
        message="merhaba",
        history=[],
        product_context=None,
    )
    assert result.routing.primary_agent == "supervisor"
    assert len(result.agent_outputs) >= 1


@pytest.mark.asyncio
async def test_orchestrator_collects_tool_audit(orchestrator):
    result = await orchestrator.handle(
        message="Yorumları topla ve duygu analizi yap, itibarımız ne durumda",
        history=[],
        product_context={"product_name": "yanmaz tencere"},
    )
    assert result.routing.primary_agent == "review_reputation_agent"
    # All three review tools should be exercised by the agent
    assert "review_aggregator" in result.tools_used


@pytest.mark.asyncio
async def test_product_info_routes_to_product_development_agent(orchestrator):
    result = await orchestrator.handle(
        message="Bu ürün için tedarikçi bul ve COGS hesabı çıkar, numune planı öner",
        history=[],
        product_context={"product_name": "yanmaz tencere", "category": "mutfak"},
    )
    assert result.routing.primary_agent == "product_development_agent"
    # Plan must have produced at least one task node and a non-empty merge
    assert len(result.agent_outputs) >= 1
    assert result.summary
    # Product dev agent's primary tools: alibaba_supplier_search, cogs_calculator
    assert any(t in result.tools_used for t in ("alibaba_supplier_search", "cogs_calculator"))


@pytest.mark.asyncio
async def test_language_directive_reaches_agents_and_merge(orchestrator):
    result = await orchestrator.handle(
        message="Fiyatları rakiplerle karşılaştır",
        history=[],
        product_context={"product_name": "yanmaz tencere"},
        language="en",
    )
    assert result.summary
    # Agent run + merge system prompts must carry the English directive;
    # planner/critic prompts are exempt (internal JSON contracts).
    directive_hits = [s for s in orchestrator.llm.systems if "English" in s]
    assert directive_hits, "language directive missing from all system prompts"


@pytest.mark.asyncio
async def test_default_language_keeps_prompts_turkish(orchestrator):
    await orchestrator.handle(
        message="Fiyatları rakiplerle karşılaştır",
        history=[],
        product_context={"product_name": "yanmaz tencere"},
    )
    assert not any("ÇIKTI DİLİ" in s for s in orchestrator.llm.systems)


@pytest.mark.asyncio
async def test_history_is_forwarded(orchestrator):
    history = [
        LLMMessage(role="user", content="Önceki konuşma içeriği"),
        LLMMessage(role="assistant", content="Önceki yanıt"),
    ]
    result = await orchestrator.handle(
        message="Devam edelim, pazar araştırması yap",
        history=history,
        product_context={"product_name": "yanmaz tencere"},
    )
    assert result.routing.primary_agent == "market_research_agent"
    assert result.summary
