"""E2E: Rakip fiyat analizi → marj hesabı → Trendyol fiyat güncelleme senaryosu.

Bu test, Hermes orkestratörünün fiyatlandırma mesajını doğru ajana yönlendirdiğini,
araçların çağrıldığını ve Trendyol manifest'inin onay bayrağını taşıdığını doğrular.

Ağa gitmez — StubLLM ve kayıtlı mock Trendyol adaptörleri kullanır.
"""
from __future__ import annotations

import json
import warnings

import pytest

from apps.api.agents.registry import AgentRegistry
from apps.api.agents.seed import SEED_AGENTS
from apps.api.core.hermes.orchestrator import HermesOrchestrator
from apps.api.core.hermes.router import route as _keyword_route
from apps.api.core.llm.provider import LLMResponse, LLMProvider
from apps.api.core.openclaw.executor import (
    ExecutionContext,
    OpenClawExecutor,
    register_live_adapter,
)
from apps.api.core.openclaw.registry import get_registry


class StubLLM(LLMProvider):
    async def generate(self, *, system, messages, temperature=0.7, max_tokens=1024) -> LLMResponse:
        last_user = next((m.content for m in reversed(messages) if m.role != "model"), "")

        if "Critic-Agent" in (system or ""):
            return LLMResponse(
                text=json.dumps({
                    "concreteness": 0.9,
                    "numeric_grounding": 0.85,
                    "hallucination_risk": 0.05,
                    "reason": "Stub critic: high score",
                }),
                model="stub-critic",
                tokens_used=20,
            )

        if "planlayıcı" in (system or ""):
            marker = "KULLANICI MESAJI:"
            user_msg = last_user
            if marker in user_msg:
                user_msg = user_msg.split(marker, 1)[1].split("KULLANILABİLİR")[0].strip()
            available = [s.agent_id for s in SEED_AGENTS if s.active]
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", DeprecationWarning)
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

        return LLMResponse(
            text=(
                "Analiz tamamlandı.\n\n"
                "• Rakip fiyat: ₺349 — mevcut fiyatımızdan %8 düşük.\n"
                "• Marj analizi: %29 → %24 (kabul edilebilir eşiğin üstünde).\n"
                "⚠️ Onay gerektiren aksiyon: Trendyol fiyatını ₺339 olarak güncelle."
            ),
            model="stub",
            tokens_used=90,
        )


@pytest.fixture
def orchestrator_with_trendyol(monkeypatch):
    """Orkestratör + Trendyol araçları için kayıtlı mock adaptörler."""
    get_registry().load_manifests()

    # Trendyol araçları için hızlı mock adaptörler kaydet.
    async def _mock_get_products(payload):
        return {
            "products": [
                {"product_id": "T-001", "title": "Test Ürünü", "price": 349.0, "stock": 50}
            ],
            "total": 1,
        }

    async def _mock_get_orders(payload):
        return {"orders": [], "total": 0}

    async def _mock_update_price(payload):
        return {
            "updated": True,
            "product_id": payload.get("product_id", "unknown"),
            "new_price": payload.get("price", 0),
        }

    register_live_adapter("trendyol_get_products", _mock_get_products)
    register_live_adapter("trendyol_get_orders", _mock_get_orders)
    register_live_adapter("trendyol_update_price", _mock_update_price)

    stub = StubLLM()

    def _provider():
        return stub

    monkeypatch.setattr("apps.api.core.llm.provider.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.agents.base.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.core.hermes.orchestrator.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.core.planner.get_llm_provider", _provider)
    monkeypatch.setattr("apps.api.agents.critic.get_llm_provider", _provider)

    registry = AgentRegistry()
    executor = OpenClawExecutor()
    return HermesOrchestrator(agents=registry, executor=executor)


@pytest.mark.asyncio
async def test_pricing_flow_uses_tools(orchestrator_with_trendyol):
    """Fiyatlandırma mesajı → en az 1 araç çağrılır ve özet dönülür."""
    result = await orchestrator_with_trendyol.handle(
        message="Trendyol'daki ürün fiyatını rakip analizine göre güncelle",
        history=[],
        product_context={"product_name": "test-ürün", "product_id": "test-sku"},
    )
    assert result.task_id.startswith("task_")
    assert result.summary
    assert len(result.agent_outputs) >= 1
    assert result.tools_used, "Fiyatlandırma senaryosunda en az 1 araç çağrılmış olmalı"


@pytest.mark.asyncio
async def test_pricing_flow_routes_to_pricing_agent(orchestrator_with_trendyol):
    """Fiyat güncelleme mesajı pricing/dynamic_pricing ajanına yönlenmeli."""
    result = await orchestrator_with_trendyol.handle(
        message="Rakip fiyat analizi yap ve Trendyol fiyatını güncelle",
        history=[],
        product_context={"product_name": "test-ürün"},
    )
    pricing_agents = {"pricing_agent", "dynamic_pricing_agent", "pricing_finance_agent"}
    all_routed = {result.routing.primary_agent} | set(result.routing.supporting)
    assert all_routed & pricing_agents, (
        f"Fiyat ajanı routing'de yok — primary={result.routing.primary_agent}, "
        f"supporting={result.routing.supporting}"
    )


@pytest.mark.asyncio
async def test_trendyol_update_price_requires_approval():
    """trendyol_update_price manifesti requires_approval=True olmalı (HITL garantisi)."""
    registry = get_registry()
    registry.load_manifests()
    tool = registry.get("trendyol_update_price")
    assert tool is not None, "trendyol_update_price manifesti yüklenemedi"
    assert tool.requires_approval is True, (
        "trendyol_update_price requires_approval=False — yazma araçları her zaman onay gerektirmeli"
    )
    assert tool.mode.value == "live"


@pytest.mark.asyncio
async def test_trendyol_executor_calls_succeed():
    """Executor, kayıtlı mock Trendyol adaptörlerini doğru çağırıyor."""
    async def _mock_get_products(payload):
        return {"products": [{"product_id": "P1", "price": 299.0}], "total": 1}

    register_live_adapter("trendyol_get_products", _mock_get_products)

    registry = get_registry()
    registry.load_manifests()
    executor = OpenClawExecutor(registry=registry)
    ctx = ExecutionContext(agent_id="dynamic_pricing_agent", task_id="task_test")

    result = await executor.execute(
        tool_id="trendyol_get_products",
        agent_id="dynamic_pricing_agent",
        payload={},
        ctx=ctx,
    )
    assert result.status == "success"
    assert result.output.get("products")
    assert len(ctx.audit) == 1
    assert ctx.audit[0].tool_id == "trendyol_get_products"
