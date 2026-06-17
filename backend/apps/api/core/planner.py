"""LLM-based planner that builds an agent DAG from a user request.

Replaces the keyword router (`apps/api/core/hermes/router.py`) when richer
planning is needed: the planner reads the user message + product context, asks
the LLM to choose agents, declare dependencies between them, and emit a JSON
DAG that the orchestrator can feed into `TaskGraph`.

Output contract (JSON):
{
  "rationale": "Türkçe kısa açıklama",
  "urgency": "low" | "medium" | "high" | "critical",
  "nodes": [
    {
      "id": "n1",
      "agent_id": "market_research_agent",
      "title": "Rakip analizi",
      "depends_on": [],
      "payload": {"focus": "fiyatlandırma"}
    },
    ...
  ]
}

Nodes whose `depends_on` is empty run in parallel in the first wave; everything
else runs as soon as its dependencies complete. Cycles, unknown agents and
unknown dep ids are filtered out by `_validate_plan`.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from apps.api.core.llm.provider import LLMMessage, LLMProvider, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.models.schemas import AgentSpec

log = get_logger(__name__)


@dataclass
class PlannerNode:
    id: str
    agent_id: str
    title: str
    depends_on: list[str] = field(default_factory=list)
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class PlannerPlan:
    rationale: str
    urgency: str  # low | medium | high | critical
    nodes: list[PlannerNode] = field(default_factory=list)
    source: str = "llm"  # "llm" | "fallback"

    @property
    def primary_agent(self) -> str:
        """First root node — kept for routing-compatibility with RoutingDecision."""
        roots = [n for n in self.nodes if not n.depends_on]
        if roots:
            return roots[0].agent_id
        return self.nodes[0].agent_id if self.nodes else "supervisor"

    @property
    def supporting(self) -> list[str]:
        roots = [n for n in self.nodes if not n.depends_on]
        primary_id = roots[0].id if roots else (self.nodes[0].id if self.nodes else None)
        return [
            n.agent_id
            for n in self.nodes
            if n.id != primary_id and n.agent_id != self.primary_agent
        ]


_URGENCY_LEVELS = {"low", "medium", "high", "critical"}

# Ürün aşamasına göre öncelikli ajan önerileri.
# Planner LLM'e bu öncelikleri ipucu olarak iletir; mesaj bağlamı
# her zaman bu öncelikleri geçersiz kılabilir.
_STAGE_PRIORITY: dict[str, list[str]] = {
    "idea": [
        "market_research_agent",
        "brand_identity_agent",
        "product_development_agent",
    ],
    "product_no_store": [
        "store_setup_agent",
        "brand_identity_agent",
        "legal_compliance_agent",
    ],
    "store_growing": [
        "marketing_agent",
        "catalog_agent",
        "growth_agent",
        "pricing_agent",
    ],
    "marketplace_opt": [
        "dynamic_pricing_agent",
        "review_reputation_agent",
        "analytics_agent",
    ],
}


def _stage_priority_hint(product_context: dict[str, Any] | None) -> str:
    """Return a Turkish priority hint for the planner prompt based on product stage."""
    if not product_context:
        return ""
    stage = str(product_context.get("stage", "")).strip()
    priority_agents = _STAGE_PRIORITY.get(stage)
    if not priority_agents:
        return ""
    agents_str = ", ".join(priority_agents)
    return (
        f"AŞAMA İPUCU: Ürün '{stage}' aşamasında. Kullanıcının mesajı belirli "
        f"bir alan gerektirmiyorsa şu ajanları ön plana al: {agents_str}.\n\n"
    )
_MAX_NODES = 8


_SYSTEM_PROMPT = (
    "Sen Hermes orchestrator'ın planlayıcı ajanısın. Kullanıcı mesajını ve ürün "
    "bağlamını okuyup, sadece aşağıda sana verilen ajan kümesinden hangilerinin "
    "hangi sırayla ve paralellikle çalışacağına karar verirsin.\n\n"
    "ÇIKTI KURALLARI:\n"
    "- Yalnızca geçerli JSON döndür. Açıklama, markdown veya kod bloğu EKLEME.\n"
    "- En fazla 6 düğüm seç. Tek bir ajan yetiyorsa tek düğüm yeterli.\n"
    "- 'depends_on' boş olan düğümler ilk dalgada paralel koşar.\n"
    "- Bir düğüm, başka bir düğümün çıktısına ihtiyaç duyuyorsa onu 'depends_on' "
    "listesine ekle. Döngü kurma.\n"
    "- Aynı 'agent_id'yi birden fazla kullanma.\n"
    "- 'urgency' alanı sadece low | medium | high | critical olabilir.\n"
    "- 'rationale' kısa Türkçe gerekçedir (1-2 cümle).\n\n"
    "JSON ŞEMASI:\n"
    "{\n"
    '  "rationale": "...",\n'
    '  "urgency": "medium",\n'
    '  "nodes": [\n'
    '    {"id": "n1", "agent_id": "<allowed>", "title": "...", "depends_on": [], "payload": {}}\n'
    "  ]\n"
    "}"
)


class PlannerAgent:
    """LLM-driven planner. Produces a JSON DAG; falls back to a single
    supervisor node on parse/validation failure."""

    def __init__(self, llm: LLMProvider | None = None) -> None:
        self.llm = llm or get_llm_provider()

    async def plan(
        self,
        *,
        message: str,
        product_context: dict[str, Any] | None,
        available_agents: list[AgentSpec],
    ) -> PlannerPlan:
        if not available_agents:
            return self._fallback("Hiç aktif ajan yok", agent_id="supervisor")

        allowed_ids = {a.agent_id for a in available_agents}
        prompt = self._build_prompt(message, product_context, available_agents)

        try:
            resp = await self.llm.generate(
                system=_SYSTEM_PROMPT,
                messages=[LLMMessage(role="user", content=prompt)],
                temperature=0.3,
                max_tokens=900,
            )
        except Exception as exc:
            log.warning("planner.llm.exception", error=str(exc))
            return self._fallback("LLM hata verdi, fallback planı kullanılıyor", allowed_ids)

        if resp.error or not resp.text:
            log.warning("planner.llm.empty", error=resp.error)
            return self._fallback("LLM boş döndü, fallback planı kullanılıyor", allowed_ids)

        parsed = _parse_json(resp.text)
        if parsed is None:
            log.warning("planner.parse.failed", preview=resp.text[:200])
            return self._fallback("Plan JSON parse edilemedi", allowed_ids)

        plan = _validate_plan(parsed, allowed_ids)
        if plan is None or not plan.nodes:
            log.warning("planner.validate.failed", parsed=str(parsed)[:200])
            return self._fallback("Plan doğrulanamadı", allowed_ids)

        log.info(
            "planner.plan.ready",
            nodes=len(plan.nodes),
            urgency=plan.urgency,
            agents=[n.agent_id for n in plan.nodes],
        )
        return plan

    @staticmethod
    def _build_prompt(
        message: str,
        product_context: dict[str, Any] | None,
        available_agents: list[AgentSpec],
    ) -> str:
        product_block = ""
        if product_context:
            product_block = (
                "AKTİF ÜRÜN:\n"
                f"- İsim: {product_context.get('product_name', '—')}\n"
                f"- Kategori: {product_context.get('category', '—')}\n"
                f"- Aşama: {product_context.get('stage', '—')}\n"
                f"- Fiyat: {product_context.get('price', '—')}\n"
                f"- Notlar: {product_context.get('notes', '—')}\n\n"
            )

        roster = "\n".join(
            f"- {a.agent_id} — {a.role}: {a.goal}" for a in available_agents
        )

        stage_hint = _stage_priority_hint(product_context)

        return (
            f"{product_block}"
            f"KULLANICI MESAJI:\n{message}\n\n"
            f"KULLANILABİLİR AJANLAR (sadece bu listeden seç):\n{roster}\n\n"
            f"{stage_hint}"
            f"Lütfen yukarıdaki şemaya uyan JSON planını döndür."
        )

    @staticmethod
    def _fallback(
        rationale: str,
        allowed_ids: set[str] | None = None,
        *,
        agent_id: str = "supervisor",
    ) -> PlannerPlan:
        chosen = agent_id
        if allowed_ids and agent_id not in allowed_ids:
            chosen = next(iter(allowed_ids))
        return PlannerPlan(
            rationale=rationale,
            urgency="medium",
            nodes=[PlannerNode(id="n1", agent_id=chosen, title="Genel analiz")],
            source="fallback",
        )


_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any] | None:
    """Parse JSON tolerant of ```json fences and surrounding prose."""
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    fence = _JSON_FENCE.search(text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass
    # Last resort: grab the outermost {...} block.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


def _validate_plan(data: dict[str, Any], allowed_ids: set[str]) -> PlannerPlan | None:
    if not isinstance(data, dict):
        return None

    rationale = str(data.get("rationale", "")).strip() or "Plan üretildi."
    urgency_raw = str(data.get("urgency", "medium")).strip().lower()
    urgency = urgency_raw if urgency_raw in _URGENCY_LEVELS else "medium"

    raw_nodes = data.get("nodes")
    if not isinstance(raw_nodes, list) or not raw_nodes:
        return None

    nodes: list[PlannerNode] = []
    seen_ids: set[str] = set()
    seen_agents: set[str] = set()

    for idx, raw in enumerate(raw_nodes):
        if not isinstance(raw, dict) or len(nodes) >= _MAX_NODES:
            continue
        agent_id = str(raw.get("agent_id", "")).strip()
        if agent_id not in allowed_ids or agent_id in seen_agents:
            continue
        node_id = str(raw.get("id") or f"n{idx + 1}").strip() or f"n{idx + 1}"
        if node_id in seen_ids:
            node_id = f"n{idx + 1}_{agent_id[:6]}"
        title = str(raw.get("title") or f"{agent_id} görevi").strip()
        deps_raw = raw.get("depends_on") or []
        deps = [str(d).strip() for d in deps_raw if isinstance(d, (str, int))]
        payload_raw = raw.get("payload") or {}
        payload = payload_raw if isinstance(payload_raw, dict) else {}

        nodes.append(
            PlannerNode(
                id=node_id,
                agent_id=agent_id,
                title=title,
                depends_on=deps,
                payload=payload,
            )
        )
        seen_ids.add(node_id)
        seen_agents.add(agent_id)

    if not nodes:
        return None

    # Drop dependencies that point to unknown nodes (filters out cycles by
    # iterating in declared order and only allowing deps to earlier nodes).
    valid_ids: set[str] = set()
    cleaned: list[PlannerNode] = []
    for node in nodes:
        deps = [d for d in node.depends_on if d in valid_ids]
        cleaned.append(
            PlannerNode(
                id=node.id,
                agent_id=node.agent_id,
                title=node.title,
                depends_on=deps,
                payload=node.payload,
            )
        )
        valid_ids.add(node.id)

    # Guarantee at least one root node.
    if not any(not n.depends_on for n in cleaned):
        cleaned[0] = PlannerNode(
            id=cleaned[0].id,
            agent_id=cleaned[0].agent_id,
            title=cleaned[0].title,
            depends_on=[],
            payload=cleaned[0].payload,
        )

    return PlannerPlan(rationale=rationale, urgency=urgency, nodes=cleaned, source="llm")


_planner: PlannerAgent | None = None


def get_planner() -> PlannerAgent:
    global _planner
    if _planner is None:
        _planner = PlannerAgent()
    return _planner
