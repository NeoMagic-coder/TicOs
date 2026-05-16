"""Base agent class. Subclasses provide a system prompt + a curated tool list."""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import ExecutionContext, OpenClawExecutor
from apps.api.models.schemas import AgentOutput, AgentSpec, RecommendedAction

log = get_logger(__name__)


class BaseAgent(ABC):
    spec: AgentSpec
    primary_tools: list[str] = []

    def __init__(self, spec: AgentSpec) -> None:
        self.spec = spec
        self.llm = get_llm_provider()

    @abstractmethod
    def system_prompt(self, product_context: dict[str, Any]) -> str:
        ...

    def _tool_payload(
        self, tool_id: str, message: str, product_context: dict[str, Any]
    ) -> dict[str, Any]:
        """Build payload for a primary tool. Subclasses can override per tool_id."""
        if tool_id == "brand_visual_generator":
            product = product_context.get("product_name") or "ürün"
            category = product_context.get("category") or ""
            prompt = (
                f"{product} ({category}) için profesyonel marka mood görseli. "
                f"Estetik, ışıklı, ürünü öne çıkaran kompozisyon. "
                f"Bağlam: {message[:160]}"
            )
            return {"prompt": prompt}
        return {"_seed": message[:32]}

    async def run(
        self,
        *,
        message: str,
        history: list[LLMMessage],
        product_context: dict[str, Any],
        executor: OpenClawExecutor,
        ctx: ExecutionContext,
    ) -> AgentOutput:
        task_id = ctx.task_id or f"adhoc_{uuid.uuid4().hex[:6]}"
        started = datetime.now(UTC)

        # Side-effect: fire each primary tool so OpenClaw audit, cost tracking and
        # any live adapters (e.g. image generation) are exercised.
        for tool_id in self.primary_tools:
            payload = self._tool_payload(tool_id, message, product_context)
            try:
                await executor.execute(
                    tool_id=tool_id, agent_id=self.spec.agent_id, payload=payload, ctx=ctx
                )
            except Exception as exc:
                log.warning("agent.tool_skip", agent=self.spec.agent_id, tool=tool_id, error=str(exc))

        system = self.system_prompt(product_context) + (
            "\n\nKurallar:\n"
            "- Kullanıcının somut sorusuna doğrudan, eyleme dönük cevap üret. Meta yorum yapma.\n"
            "- Eğer sayı/isim/öneri istendiyse açıkça listele; '...sunulacaktır' gibi söz verme, doğrudan ver.\n"
            "- Önce 1-2 cümle özet, sonra madde işaretli (•) somut bulgular ya da öneriler.\n"
            "- Onay gereken aksiyonları satırın başında ⚠️ ile işaretle."
        )
        resp = await self.llm.generate(
            system=system,
            messages=history + [LLMMessage(role="user", content=message)],
            temperature=0.7,
            max_tokens=1500,
        )

        if resp.error and not (resp.text or "").strip():
            err_lower = resp.error.lower()
            if "429" in resp.error or "resource_exhausted" in err_lower or "quota" in err_lower:
                text = (
                    "⚠️ **Gemini günlük ücretsiz kotası tükendi.**\n\n"
                    "Tüm fallback modelleri (gemini-2.5-flash, 2.0-flash, lite) bugünlük "
                    "limitlerini aştı. Çözümler:\n"
                    "• Yarın UTC 00:00'da kota sıfırlanır.\n"
                    "• Google Cloud üzerinden billing aç (saniyeler içinde sınırsıza yakın kota).\n"
                    "• Yeni bir Google projesi/AI Studio key oluştur (her proje ayrı kota)."
                )
            else:
                text = f"⚠️ Gemini hatası: {resp.error[:200]}"
        else:
            text = (resp.text or "").strip() or "Yanıt üretilemedi."
        confidence = 0.92 if not resp.error else 0.45
        status = "completed" if not resp.error else "failed"

        actions: list[RecommendedAction] = []
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("⚠️"):
                actions.append(RecommendedAction(
                    action=stripped[2:].strip()[:120],
                    requires_approval=True,
                    risk_level="medium",
                    expected_impact="Onay gerektiren aksiyon",
                ))

        first_para = text.split("\n\n", 1)[0]
        return AgentOutput(
            agent_id=self.spec.agent_id,
            task_id=task_id,
            status=status,
            confidence=confidence,
            iterations_used=1,
            tools_called=list(ctx.audit),
            summary=first_para[:240],
            content=text,
            findings=[
                l.lstrip("-•*").strip()
                for l in text.splitlines()
                if l.lstrip().startswith(("-", "•", "*"))
            ][:8],
            recommended_actions=actions,
            next_step=None,
            started_at=started,
            completed_at=datetime.now(UTC),
        )
