"""Brand studio endpoints — generate visuals and refresh brand identity.

POST /api/v1/brand/generate-image
    Wraps the `brand_visual_generator` tool (Gemini image) so the frontend
    Brand page can request a render without crafting a full RPC payload.

POST /api/v1/brand/regenerate-identity
    Phase 4 — runs the JSON-mode Gemini prompt **server-side** so the browser
    no longer needs `VITE_GEMINI_API_KEY`. Returns the parsed BrandIdentity.
"""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import ExecutionContext, ToolNotFound, get_executor

log = get_logger(__name__)
router = APIRouter(prefix="/brand", tags=["brand"])


class GenerateImageRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)
    variations: int = Field(default=1, ge=1, le=4)
    product_name: str | None = None
    model: str | None = None
    agent_id: str = "brand_identity_agent"


@router.post("/generate-image", response_model=dict[str, Any])
async def generate_image(body: GenerateImageRequest) -> dict[str, Any]:
    executor = get_executor()
    ctx = ExecutionContext(agent_id=body.agent_id, task_id=None, budget_usd=0.10)

    # Guard against generic prompts producing off-brand stock imagery on
    # non-Gemini providers (fal.ai/flux etc.) — if the caller forgot to
    # mention the product name in the prompt, prepend it explicitly.
    final_prompt = body.prompt.strip()
    if body.product_name and body.product_name.lower() not in final_prompt.lower():
        final_prompt = f'"{body.product_name}" ürünü: {final_prompt}'

    results: list[dict[str, Any]] = []
    for i in range(body.variations):
        try:
            payload: dict[str, Any] = {
                "prompt": final_prompt,
                "variation_index": i,
            }
            if body.model:
                payload["model"] = body.model
            if body.product_name:
                payload["product_name"] = body.product_name
            result = await executor.execute(
                tool_id="brand_visual_generator",
                agent_id=body.agent_id,
                payload=payload,
                ctx=ctx,
            )
        except ToolNotFound as exc:
            raise HTTPException(status_code=404, detail=str(exc))
        results.append(
            {
                "status": result.status,
                "output": result.output,
                "duration_ms": result.duration_ms,
                "cost_usd": result.cost_usd,
            }
        )
    return {"variations": results, "prompt": final_prompt}


# ─────────────────────────────────────────────────────────────────────────────
# Brand identity regeneration — Phase 4: server-side Gemini call.
# ─────────────────────────────────────────────────────────────────────────────


class ProductContext(BaseModel):
    product_name: str
    product_description: str = ""
    category: str = "Genel"
    stage: str = "idea"
    target_market: str = "TR"
    channels: list[str] = Field(default_factory=list)
    monthly_budget_band: str = "0-5k"
    priorities: list[str] = Field(default_factory=list)


class RegenerateBrandRequest(BaseModel):
    product: ProductContext
    model: str | None = None
    max_output_tokens: int = 8192


_BRAND_SCHEMA_PROMPT = """Sen Brand Identity Agent'sın. Yukarıdaki ürün için yepyeni bir marka kimliği üret.
Önemli: GranitPro, Stonecook, Çinko gibi tencere/mutfak markalarını ASLA referans alma — bu ürünün gerçek kategorisine göre özgün öneriler ver.
YALNIZCA aşağıdaki JSON şemasında, başka açıklama olmadan cevap ver. Tüm metinler Türkçe olsun.

```json
{
  "brand_name": "string",
  "tagline": "string",
  "taglines": ["string"],
  "story": "string (3-4 cümle)",
  "positioning": "string",
  "mission": "string",
  "vision": "string",
  "archetype": "Kahraman|Bilge|Aşık|Maceracı|Yaratıcı|Hükümdar|Sıradan|Şakacı|Bakıcı|Masum|Asi|Sihirbaz",
  "elevator_pitch": "string",
  "usp": "string",
  "values": [{"name":"string","description":"string"}],
  "differentiators": ["string"],
  "tone_examples": [{"context":"string","example":"string"}],
  "hashtags": ["#string"],
  "keywords": ["string"],
  "typography": {"heading":"string","body":"string","rationale":"string"},
  "logo_concepts": [{"name":"string","description":"string"}],
  "imagery_style": {"mood":"string","do":["string"],"dont":["string"],"references":["string"]},
  "competitors": [{"name":"string","positioning":"string","gap":"string"}],
  "alternatives": [{"name":"string","score":0,"domain":"✓ veya ✗","reasoning":"string"}],
  "palette": [{"role":"Primary|Secondary|Accent|Neutral|Background","hex":"#RRGGBB","label":"string"}],
  "voice": {"traits":["string"],"do":["string"],"dont":["string"]},
  "personas": [{"name":"string","age":"string","goal":"string","objection":"string","channel":"string","emoji":"string"}],
  "social_handles": [{"platform":"Instagram|TikTok|YouTube|Twitter|LinkedIn","handle":"@string","available":true}]
}
```
Minimum sayılar: taglines ≥ 4, values ≥ 4, differentiators ≥ 4, tone_examples ≥ 5, hashtags ≥ 6, keywords ≥ 8, logo_concepts ≥ 3, competitors ≥ 3, alternatives ≥ 4, palette ≥ 5, voice.traits ≥ 5, voice.do ≥ 4, voice.dont ≥ 4, personas ≥ 3, social_handles ≥ 4."""


def _product_brief(p: ProductContext) -> str:
    return (
        f"Ürün: {p.product_name}\n"
        f"Kategori: {p.category}\n"
        f"Aşama: {p.stage}\n"
        f"Pazar: {p.target_market}\n"
        f"Kanallar: {', '.join(p.channels) or '—'}\n"
        f"Aylık reklam bütçesi: {p.monthly_budget_band}\n"
        f"Öncelikler: {', '.join(p.priorities) or '—'}\n"
        f"Açıklama: {p.product_description or '—'}"
    )


def _extract_json(text: str) -> dict[str, Any] | None:
    """Strip code fences, find the first balanced JSON object."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"```\s*$", "", cleaned)
    start = cleaned.find("{")
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(cleaned[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(cleaned[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


@router.post("/regenerate-identity", response_model=dict[str, Any])
async def regenerate_identity(body: RegenerateBrandRequest) -> dict[str, Any]:
    """Server-side BrandIdentity generation. Eliminates the need for the
    browser to hold `VITE_GEMINI_API_KEY`.

    Uses Gemini with response_mime_type for reliable JSON output.
    """
    settings = get_settings()
    user_prompt = f"{_product_brief(body.product)}\n\n{_BRAND_SCHEMA_PROMPT}"
    system_prompt = "Sen Brand Identity Agent'sın. Yalnızca geçerli JSON üret, başka metin/yorum yazma."

    if settings.gemini_api_key:
        return await _regenerate_via_gemini(body, user_prompt, system_prompt, settings)

    from apps.api.core.llm.provider import LLMMessage, MockProvider, get_llm_provider

    provider = get_llm_provider()
    if isinstance(provider, MockProvider):
        raise HTTPException(
            status_code=503,
            detail="LLM API anahtarı yapılandırılmamış (GEMINI_API_KEY gerekli)",
        )

    try:
        resp = await provider.generate(
            system=system_prompt,
            messages=[LLMMessage(role="user", content=user_prompt)],
            temperature=0.7,
            max_tokens=body.max_output_tokens,
        )
    except Exception as exc:
        log.exception("brand.regenerate_exception", error=str(exc))
        raise HTTPException(status_code=502, detail=f"LLM error: {str(exc)[:200]}")

    if resp.error or not resp.text:
        raise HTTPException(status_code=502, detail=f"LLM boş yanıt: {resp.error or 'empty'}")

    identity = _extract_json(resp.text)
    if not identity or not isinstance(identity.get("brand_name"), str):
        log.warning("brand.regenerate.parse_failed", model=resp.model, head=resp.text[:200])
        raise HTTPException(status_code=502, detail="Could not parse BrandIdentity JSON")

    return {
        "identity": identity,
        "model": resp.model,
        "raw_length": len(resp.text),
    }


async def _regenerate_via_gemini(
    body: "RegenerateBrandRequest",
    user_prompt: str,
    system_prompt: str,
    settings: Any,
) -> dict[str, Any]:
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    model = body.model or settings.gemini_model or "gemini-2.5-flash"

    try:
        resp = await client.aio.models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])],
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=body.max_output_tokens,
                response_mime_type="application/json",
            ),
        )
    except genai_errors.ClientError as exc:
        status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        raise HTTPException(status_code=502, detail=f"Gemini {status}: {str(exc)[:200]}")
    except Exception as exc:
        log.exception("brand.regenerate_exception", error=str(exc))
        raise HTTPException(status_code=502, detail=f"Gemini error: {str(exc)[:200]}")

    text = ""
    try:
        text = "".join(
            (part.text or "")
            for part in (resp.candidates[0].content.parts if resp.candidates else [])
        ).strip()
    except Exception:
        text = ""

    if not text:
        finish = getattr(resp.candidates[0], "finish_reason", None) if resp.candidates else None
        raise HTTPException(status_code=502, detail=f"Empty Gemini response (finish={finish})")

    identity = _extract_json(text)
    if not identity or not isinstance(identity.get("brand_name"), str):
        log.warning("brand.regenerate.parse_failed", head=text[:200])
        raise HTTPException(status_code=502, detail="Could not parse BrandIdentity JSON")

    return {
        "identity": identity,
        "model": model,
        "raw_length": len(text),
    }
