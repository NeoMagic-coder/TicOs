"""LLM-only live adapters.

These tools have no external service dependency — they just need a working
LLM. When ``GEMINI_API_KEY`` is set the calls hit Gemini directly; otherwise
the LLM provider singleton is ``MockProvider`` and each adapter falls through
to a deterministic mock so the tool still returns a valid response shape.

Every adapter:

1. Calls ``get_llm_provider().generate()`` with a tool-specific system prompt
   that constrains the output to a JSON object matching the manifest's
   ``output_schema``.
2. Parses the JSON with the lenient ``_parse_json`` helper (handles fenced
   code blocks).
3. On parse failure or LLM error, returns the per-tool deterministic mock
   marked ``degraded: true`` so the UI badge surfaces the regression.

Wrapped in ``with_breaker`` so repeated failures trip the circuit and the
executor falls through to the registry's mock fallback. The breaker also
keeps the existing live-vs-mock telemetry consistent with Shopify/Trendyol.
"""
from __future__ import annotations

import json
import re
from typing import Any

from apps.api.core.llm.language import language_directive
from apps.api.core.llm.provider import LLMMessage, MockProvider, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)


_JSON_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any] | None:
    """Lenient JSON parser — accepts raw JSON, ```json``` fences, or the
    first balanced object substring. Returns ``None`` when nothing parses."""
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


async def _ask_llm_json(
    *,
    system: str,
    user: str,
    fallback: dict[str, Any],
    max_tokens: int = 700,
    language: str | None = None,
) -> dict[str, Any]:
    """Single LLM round-trip with JSON parsing + mock fallback.

    Returns ``fallback`` (with ``degraded=True``) when the provider is the
    in-process MockProvider, when the call errors out, or when the response
    can't be parsed as JSON. This keeps the tool contract intact for callers
    that always expect a structured object."""
    system = system + language_directive(language)
    provider = get_llm_provider()
    # Short-circuit: no real LLM available → return mock immediately. Skipping
    # the network call keeps mock-mode latency predictable.
    if isinstance(provider, MockProvider):
        return {**fallback, "degraded": True, "degraded_reason": "no_api_key"}

    try:
        resp = await provider.generate(
            system=system,
            messages=[LLMMessage(role="user", content=user)],
            temperature=0.4,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        log.warning("llm_tool.exception", error=str(exc)[:200])
        return {**fallback, "degraded": True, "degraded_reason": "llm_exception"}

    if resp.error or not resp.text:
        return {**fallback, "degraded": True, "degraded_reason": resp.error or "empty_response"}

    parsed = _parse_json(resp.text)
    if not parsed:
        log.warning("llm_tool.json_parse_failed", model=resp.model)
        return {**fallback, "degraded": True, "degraded_reason": "json_parse_failed"}
    return parsed


# ── brand_name_generator ───────────────────────────────────────────────────

_BRAND_NAME_SYS = (
    "Sen bir marka isim danışmanısın. Verilen 'vibe' (marka hissi) için "
    "10 farklı marka ismi öner. Her isim için domain uygunluğu (.com), "
    "telaffuz kolaylığı ve farklılaşma açısından 0-1 arası bir 'score' ver.\n"
    "Yanıtı YALNIZCA JSON döndür: "
    '{"names": [{"name": str, "score": float, "rationale": str}, ...]}\n'
    "İsimleri Türkçe pazara uygun, kısa (≤10 karakter) tut."
)


async def _brand_name_generator_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    vibe = str(payload.get("vibe", "modern, minimal")).strip()[:200]
    return await _ask_llm_json(
        system=_BRAND_NAME_SYS,
        user=f"Marka vibe: {vibe}",
        language=payload.get("language"),
        fallback={
            "names": [
                {"name": "Lumelin", "score": 0.78, "rationale": "Mock — Gemini bağlı değil."},
                {"name": "Yara", "score": 0.72, "rationale": "Mock"},
                {"name": "Tora", "score": 0.68, "rationale": "Mock"},
            ],
        },
    )


# ── color_palette_generator ─────────────────────────────────────────────────

_PALETTE_SYS = (
    "Sen bir marka renk paleti uzmanısın. Verilen 'mood' için 5 hex renk üret: "
    "primary, accent, deep, surface, neutral. Her birinin role'unu ve WCAG "
    "kontrast notunu ekle.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"palette": [{"hex": "#RRGGBB", "role": "primary", "label": "..."}, ...]}'
)


async def _color_palette_generator_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    mood = str(payload.get("mood", "minimal beige")).strip()[:200]
    return await _ask_llm_json(
        system=_PALETTE_SYS,
        user=f"Mood: {mood}",
        fallback={
            "palette": [
                {"hex": "#E8D9C0", "role": "primary", "label": "Mock"},
                {"hex": "#B47C5C", "role": "accent", "label": "Mock"},
                {"hex": "#3D2817", "role": "deep", "label": "Mock"},
                {"hex": "#F2EBDD", "role": "surface", "label": "Mock"},
                {"hex": "#C5946B", "role": "neutral", "label": "Mock"},
            ],
        },
    )


# ── target_persona_builder ─────────────────────────────────────────────────

_PERSONA_SYS = (
    "Sen bir kullanıcı araştırması uzmanısın. Verilen ürün için 3 alıcı "
    "persona oluştur. Her persona: name, age, goal, objection, channel.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"personas": [{"name": str, "age": str, "goal": str, "objection": str, "channel": str}, ...]}'
)


async def _target_persona_builder_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    product = str(payload.get("product", "")).strip()[:400]
    return await _ask_llm_json(
        system=_PERSONA_SYS,
        user=f"Ürün: {product}",
        language=payload.get("language"),
        fallback={
            "personas": [
                {"name": "Mock Persona", "age": "30-40", "goal": "—", "objection": "—", "channel": "—"},
            ],
        },
    )


# ── sentiment_analyzer ─────────────────────────────────────────────────────

_SENTIMENT_SYS = (
    "Sen bir duygu sınıflandırıcısın. Verilen metni şu şemada analiz et: "
    "polarity (pos/neg/neu), confidence (0-1), key_phrases (max 5).\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"polarity": "pos|neg|neu", "confidence": float, "key_phrases": [str, ...]}'
)


async def _sentiment_analyzer_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    text = str(payload.get("text", "")).strip()[:1200]
    return await _ask_llm_json(
        system=_SENTIMENT_SYS,
        user=f"Metin: {text}",
        fallback={"polarity": "neu", "confidence": 0.5, "key_phrases": []},
    )


# ── draft_reply_generator ──────────────────────────────────────────────────

_DRAFT_REPLY_SYS = (
    "Sen müşteri hizmetleri yazarısın. Verilen müşteri mesajına yanıt taslağı "
    "yaz. Türkçe, profesyonel, max 3 paragraf. Eğer iade/şikayet ise empati "
    "kur ve net bir sonraki adım ver.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"reply": str, "tone": "empathetic|neutral|firm", "next_step": str}'
)


async def _draft_reply_generator_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    text = str(payload.get("text", "")).strip()[:1200]
    return await _ask_llm_json(
        system=_DRAFT_REPLY_SYS,
        user=f"Müşteri mesajı: {text}",
        language=payload.get("language"),
        fallback={
            "reply": "Mesajınız için teşekkür ederiz, kısa süre içinde dönüş yapacağız. (mock)",
            "tone": "neutral",
            "next_step": "Manuel inceleme bekleniyor",
        },
    )


# ── review_response_generator ──────────────────────────────────────────────

_REVIEW_RESPONSE_SYS = (
    "Sen pazaryeri yorum yanıtlayıcısısın (Trendyol/Shopify). Yoruma kısa, "
    "saygılı, marka sesine uygun yanıt yaz. Negatif yorumda iade/iletişim "
    "kanalı öner; pozitifte teşekkür et.\n"
    "Yanıtı YALNIZCA JSON döndür: "
    '{"response": str, "sentiment": "pos|neg|neu", "requires_followup": bool}'
)


async def _review_response_generator_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    text = str(payload.get("text", "")).strip()[:1200]
    return await _ask_llm_json(
        system=_REVIEW_RESPONSE_SYS,
        user=f"Yorum: {text}",
        language=payload.get("language"),
        fallback={
            "response": "Geri bildiriminiz için teşekkür ederiz. (mock)",
            "sentiment": "neu",
            "requires_followup": False,
        },
    )


# ── email_sequence_writer ──────────────────────────────────────────────────

_EMAIL_SEQ_SYS = (
    "Sen bir email pazarlama yazarısın. Verilen 'trigger' için 5-adımlık "
    "email sequence yaz. Her adım: day (T+N), subject, preview, body.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"emails": [{"day": "T+0", "subject": str, "preview": str, "body": str}, ...]}'
)


async def _email_sequence_writer_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    trigger = str(payload.get("trigger", "abandoned_cart")).strip()[:200]
    return await _ask_llm_json(
        system=_EMAIL_SEQ_SYS,
        user=f"Trigger: {trigger}",
        language=payload.get("language"),
        fallback={
            "emails": [
                {"day": "T+0", "subject": "Mock email", "preview": "—", "body": "Mock body."},
            ],
        },
        max_tokens=1400,
    )


# ── listing_compliance_check ───────────────────────────────────────────────

_COMPLIANCE_SYS = (
    "Sen Trendyol/Shopify listing uyum denetçisisin. Verilen listing'i Türk "
    "tüketici yasası + pazaryeri kurallarına göre denetle. issues array'i "
    "ver: severity (low/med/high), rule, hint.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"issues": [{"severity": str, "rule": str, "hint": str}, ...], "score": float}'
)


async def _listing_compliance_check_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    title = str(payload.get("title", "")).strip()[:400]
    desc = str(payload.get("description", "")).strip()[:1600]
    return await _ask_llm_json(
        system=_COMPLIANCE_SYS,
        user=f"Başlık: {title}\nAçıklama: {desc}",
        fallback={"issues": [], "score": 1.0},
    )


# ── forbidden_word_scanner ─────────────────────────────────────────────────

_FORBIDDEN_SYS = (
    "Sen pazaryeri yasaklı kelime tarayıcısısın. Türk tüketici yasası ve "
    "Trendyol/Shopify kuralları çerçevesinde yasaklı/riskli ifadeler (örn. "
    "tıbbi iddia, garantili sonuç, abartılı vaat) yakala.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"flagged": [{"word": str, "reason": str}, ...], "clean": bool}'
)


async def _forbidden_word_scanner_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    text = str(payload.get("text", "")).strip()[:2000]
    return await _ask_llm_json(
        system=_FORBIDDEN_SYS,
        user=f"Metin: {text}",
        fallback={"flagged": [], "clean": True},
    )


# ── competitor_review_analyzer ─────────────────────────────────────────────

_REVIEW_ANALYZER_SYS = (
    "Sen bir rakip yorum analistisin. Verilen rakip ürün yorumlarını analiz et: "
    "genel duygu, en sık övülen temalar, en sık şikayet edilen temalar ve bizim "
    "ürünümüz için fırsatlar (rakibin zayıf olduğu noktalar).\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"overall_sentiment": "pos|neg|neu", "positive_themes": [str, ...], '
    '"negative_themes": [str, ...], "opportunities": [str, ...], "summary": str}'
)


async def _competitor_review_analyzer_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    reviews = payload.get("reviews") or []
    if isinstance(reviews, list):
        joined = "\n".join(f"- {str(r).strip()[:300]}" for r in reviews[:40])
    else:
        joined = str(reviews)[:4000]
    product = str(payload.get("product", "")).strip()[:200]
    return await _ask_llm_json(
        system=_REVIEW_ANALYZER_SYS,
        user=f"Rakip ürün: {product}\nYorumlar:\n{joined}",
        language=payload.get("language"),
        fallback={
            "overall_sentiment": "neu",
            "positive_themes": [],
            "negative_themes": [],
            "opportunities": [],
            "summary": "Mock — Gemini bağlı değil, yorum analizi yapılamadı.",
        },
        max_tokens=900,
    )


# ── competitor_report_builder ──────────────────────────────────────────────

_COMPETITOR_REPORT_SYS = (
    "Sen bir rekabet istihbaratı analistisin. Sana ürün adı, rakip fiyat verisi "
    "(avg/min/max) ve rakip yorum içgörüleri verilecek. Bunları TEK bir rapora "
    "dönüştür: konumlandırma değerlendirmesi, fiyat önerisi (sayısal aralık ver), "
    "rakiplerin güçlü/zayıf yönleri ve sıralı aksiyon listesi.\n"
    "Veri eksikse uydurma — eksikliği summary içinde belirt.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"positioning": str, "price_recommendation": str, "strengths": [str, ...], '
    '"weaknesses": [str, ...], "actions": [str, ...], "summary": str}'
)


async def _competitor_report_builder_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    product = str(payload.get("product", "")).strip()[:200]
    price_data = payload.get("price_data") or {}
    review_insights = payload.get("review_insights") or {}
    competitors = payload.get("competitors") or []
    user = (
        f"Ürün: {product}\n"
        f"Rakipler: {', '.join(str(c)[:60] for c in competitors[:10]) or '—'}\n"
        f"Fiyat verisi: {json.dumps(price_data, ensure_ascii=False)[:1500]}\n"
        f"Yorum içgörüleri: {json.dumps(review_insights, ensure_ascii=False)[:1500]}"
    )
    return await _ask_llm_json(
        system=_COMPETITOR_REPORT_SYS,
        user=user,
        language=payload.get("language"),
        fallback={
            "positioning": "—",
            "price_recommendation": "—",
            "strengths": [],
            "weaknesses": [],
            "actions": [],
            "summary": "Mock — Gemini bağlı değil, rakip raporu üretilemedi.",
        },
        max_tokens=1200,
    )


# ── social_post_writer ─────────────────────────────────────────────────────

_SOCIAL_POST_SYS = (
    "Sen bir sosyal medya içerik yazarısın. Verilen ürün ve platform için "
    "gönderi üret. Platform kuralları: instagram → 1 ana metin (max 2200 kr), "
    "hashtag listesi ayrı; twitter → max 280 karakter, 1-2 hashtag inline. "
    "Marka sesine uygun, satışa dönük ama spam hissi vermeyen metin yaz. "
    "CTA (harekete geçirici çağrı) ekle.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"platform": "instagram|twitter", "post_text": str, "hashtags": [str, ...], '
    '"cta": str, "best_time_hint": str}'
)


async def _social_post_writer_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    product = str(payload.get("product", "")).strip()[:300]
    platform = str(payload.get("platform", "instagram")).strip().lower()
    if platform not in ("instagram", "twitter"):
        platform = "instagram"
    tone = str(payload.get("tone", "samimi, enerjik")).strip()[:120]
    campaign = str(payload.get("campaign", "")).strip()[:200]
    return await _ask_llm_json(
        system=_SOCIAL_POST_SYS,
        user=(
            f"Ürün: {product}\nPlatform: {platform}\nTon: {tone}\n"
            f"Kampanya bağlamı: {campaign or '—'}"
        ),
        language=payload.get("language"),
        fallback={
            "platform": platform,
            "post_text": "Mock — Gemini bağlı değil, gönderi metni üretilemedi.",
            "hashtags": [],
            "cta": "—",
            "best_time_hint": "—",
        },
        max_tokens=900,
    )


# ── visual_prompt_generator ────────────────────────────────────────────────

_VISUAL_PROMPT_SYS = (
    "Sen bir görsel sanat yönetmenisin. Verilen ürün ve gönderi konsepti için "
    "görüntü üretim modellerine (Gemini Image, Midjourney vb.) verilecek "
    "İngilizce 'image prompt'lar üret. Her prompt: sahne, ışık, kompozisyon, "
    "stil ve ürünün konumu net olsun. 3 varyant ver: hero shot, lifestyle, "
    "flat lay.\n"
    "Yanıtı YALNIZCA JSON döndür:\n"
    '{"prompts": [{"variant": "hero|lifestyle|flat_lay", "prompt": str, '
    '"aspect_ratio": "1:1|4:5|16:9"}, ...], "style_notes": str}'
)


async def _visual_prompt_generator_adapter(payload: dict[str, Any]) -> dict[str, Any]:
    product = str(payload.get("product", "")).strip()[:300]
    concept = str(payload.get("concept", "")).strip()[:400]
    return await _ask_llm_json(
        system=_VISUAL_PROMPT_SYS,
        user=f"Ürün: {product}\nGönderi konsepti: {concept or '—'}",
        language=payload.get("language"),
        fallback={
            "prompts": [],
            "style_notes": "Mock — Gemini bağlı değil, görsel prompt üretilemedi.",
        },
        max_tokens=900,
    )


# ── registry ───────────────────────────────────────────────────────────────

_REGISTRATIONS = [
    ("brand_name_generator", _brand_name_generator_adapter),
    ("color_palette_generator", _color_palette_generator_adapter),
    ("target_persona_builder", _target_persona_builder_adapter),
    ("sentiment_analyzer", _sentiment_analyzer_adapter),
    ("draft_reply_generator", _draft_reply_generator_adapter),
    ("review_response_generator", _review_response_generator_adapter),
    ("email_sequence_writer", _email_sequence_writer_adapter),
    ("listing_compliance_check", _listing_compliance_check_adapter),
    ("forbidden_word_scanner", _forbidden_word_scanner_adapter),
    ("competitor_review_analyzer", _competitor_review_analyzer_adapter),
    ("competitor_report_builder", _competitor_report_builder_adapter),
    ("social_post_writer", _social_post_writer_adapter),
    ("visual_prompt_generator", _visual_prompt_generator_adapter),
]


async def _shared_mock(_payload: dict[str, Any]) -> dict[str, Any]:
    """Generic safety net used by the breaker when the adapter raises before
    its own fallback can run. Each tool returns a tool-specific fallback
    inside _ask_llm_json, so this branch is rarely hit."""
    return {"degraded": True, "degraded_reason": "breaker_open"}


def register() -> None:
    for tool_id, adapter in _REGISTRATIONS:
        register_live_adapter(
            tool_id,
            with_breaker(
                tool_id=tool_id,
                adapter=adapter,
                mock_fallback=_shared_mock,
            ),
        )
    provider = get_llm_provider()
    log.info(
        "live.llm_tools.registered",
        tools=len(_REGISTRATIONS),
        mock_mode=isinstance(provider, MockProvider),
    )
