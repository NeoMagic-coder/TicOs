"""Critic agent — self-evaluation pass after each agent output.

Scores an agent's response between 0.0 and 1.0 on three axes (concrete content,
numeric grounding, hallucination risk) and produces a single composite score.
Used by :class:`HermesOrchestrator` to retry low-quality outputs and to mark
the run as ``escalated`` when retries can't lift the score.

Score thresholds (configurable via :class:`Settings`):
- ``score >= critic_min_score``: accept as-is
- ``score < critic_min_score``: retry once, then escalate if still low
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from apps.api.core.llm.provider import LLMMessage, LLMProvider, get_llm_provider
from apps.api.core.logging import get_logger

log = get_logger(__name__)


@dataclass
class CriticScore:
    score: float          # composite 0.0-1.0
    concreteness: float
    numeric_grounding: float
    hallucination_risk: float  # 0 = none, 1 = severe
    reason: str
    parsed: bool = True   # False when fallback heuristic was used


_SYSTEM_PROMPT = (
    "Sen bir Critic-Agent'sın. Bir ajanın ürettiği yanıtı 3 eksende 0.0-1.0 "
    "arasında değerlendirirsin. Çıktın YALNIZCA JSON olur, açıklama ekleme.\n\n"
    "EKSENLER:\n"
    "- concreteness: somut isim, marka, ürün, kanal, aksiyon var mı?\n"
    "- numeric_grounding: ölçülebilir sayı/oran/aralık var mı?\n"
    "- hallucination_risk: uydurma veya kontrol edilemez iddia var mı? (0 = yok, 1 = yüksek)\n\n"
    "JSON ŞEMA:\n"
    '{"concreteness": 0.0, "numeric_grounding": 0.0, "hallucination_risk": 0.0, "reason": "kısa Türkçe gerekçe"}'
)


class CriticAgent:
    """Self-evaluator. LLM-based with a deterministic heuristic fallback."""

    def __init__(self, llm: LLMProvider | None = None) -> None:
        self.llm = llm or get_llm_provider()

    async def evaluate(
        self, *, message: str, output_text: str, agent_id: str
    ) -> CriticScore:
        text = (output_text or "").strip()
        if not text:
            return CriticScore(0.0, 0.0, 0.0, 1.0, "Boş çıktı.", parsed=False)

        prompt = (
            f"KULLANICI MESAJI: {message[:400]}\n\n"
            f"AJAN ({agent_id}) ÇIKTISI:\n{text[:2000]}\n\n"
            "Bu çıktıyı yukarıdaki JSON şemasına göre puanla."
        )
        try:
            resp = await self.llm.generate(
                system=_SYSTEM_PROMPT,
                messages=[LLMMessage(role="user", content=prompt)],
                temperature=0.0,
                max_tokens=300,
            )
        except Exception as exc:
            log.warning("critic.llm.exception", error=str(exc)[:200])
            return _heuristic_score(text, reason=f"LLM hatası: {exc}")

        if resp.error or not resp.text:
            return _heuristic_score(text, reason=resp.error or "LLM boş döndü")

        parsed = _parse_json(resp.text)
        if not parsed:
            return _heuristic_score(text, reason="JSON parse edilemedi")

        concreteness = _clip(parsed.get("concreteness", 0.5))
        numeric = _clip(parsed.get("numeric_grounding", 0.5))
        hallucination = _clip(parsed.get("hallucination_risk", 0.0))
        reason = str(parsed.get("reason", "") or "")[:280]

        # Composite: positive axes − hallucination penalty (weighted).
        composite = 0.45 * concreteness + 0.35 * numeric + 0.20 * (1.0 - hallucination)
        return CriticScore(
            score=round(composite, 3),
            concreteness=concreteness,
            numeric_grounding=numeric,
            hallucination_risk=hallucination,
            reason=reason or "JSON puanı kabul edildi.",
        )


_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)
_NUMBER_RE = re.compile(r"\b\d+([.,]\d+)?\s*(%|tl|₺|gün|adet|kg|usd)?", re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any] | None:
    text = (text or "").strip()
    if not text:
        return None
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    fence = _JSON_FENCE.search(text)
    if fence:
        try:
            data = json.loads(fence.group(1))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(text[start : end + 1])
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _clip(x: Any, lo: float = 0.0, hi: float = 1.0) -> float:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return 0.5
    return max(lo, min(hi, v))


def _heuristic_score(text: str, *, reason: str) -> CriticScore:
    """Deterministic fallback when the LLM can't or won't produce JSON.

    Rewards length, bullets, numbers; penalises hedging language.
    """
    length = len(text)
    bullets = sum(1 for ln in text.splitlines() if ln.lstrip().startswith(("-", "•", "*")))
    numbers = len(_NUMBER_RE.findall(text))
    hedging = sum(
        text.lower().count(w)
        for w in ("olabilir", "belki", "sanırım", "tahminen", "olası")
    )

    concreteness = min(1.0, bullets / 5.0 + (length / 1200.0))
    numeric = min(1.0, numbers / 5.0)
    hallucination = min(1.0, hedging / 4.0)
    composite = 0.45 * concreteness + 0.35 * numeric + 0.20 * (1.0 - hallucination)
    return CriticScore(
        score=round(composite, 3),
        concreteness=round(concreteness, 3),
        numeric_grounding=round(numeric, 3),
        hallucination_risk=round(hallucination, 3),
        reason=f"Heuristic fallback: {reason}",
        parsed=False,
    )


_critic: CriticAgent | None = None


def get_critic() -> CriticAgent:
    global _critic
    if _critic is None:
        _critic = CriticAgent()
    return _critic
