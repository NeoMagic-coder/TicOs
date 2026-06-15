"""LLM tabanli veri cikarimi — DOM secicileri bos kalirsa sayfa metninden teklif cikarir.

Hata = akinti yonu: LLM hatasi/bozuk JSON durumunda bos liste doner, akis devam eder.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from apps.api.shopping.llm.provider import LLMProvider
from apps.api.shopping.schemas import Offer

logger = logging.getLogger(__name__)

MAX_SNIPPET_CHARS = 6000

SYSTEM_PROMPT = (
    "Sen bir e-ticaret veri cikarim asistanisin. Sana bir urun listeleme sayfasindan "
    "alinmis ham metin verilecek. SADECE su semada gecerli JSON dondur:\n"
    '{"offers": [{"title": str, "price": float, "in_stock": bool, '
    '"stock_level": int|null, "delivery_days": int|null, '
    '"warranty_months": int|null, "url": str|null}]}\n'
    "Fiyatlari TL cinsinden sayiya cevir (orn. '40.999 TL' -> 40999). "
    "Emin olamadigin alanlari null birak. JSON disinda hicbir sey yazma."
)


def _safe_json(raw: str) -> dict[str, Any]:
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        return {"offers": []}
    try:
        data = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return {"offers": []}
    return data if isinstance(data, dict) else {"offers": []}


def _to_offer(item: dict[str, Any], site: str) -> Offer | None:
    try:
        return Offer(
            site=site,
            title=str(item.get("title", "")).strip(),
            url=str(item.get("url") or ""),
            price=float(item["price"]),
            in_stock=bool(item.get("in_stock", True)),
            stock_level=item.get("stock_level"),
            delivery_days=item.get("delivery_days"),
            warranty_months=item.get("warranty_months"),
            extracted_via="llm",
        )
    except (KeyError, TypeError, ValueError):  # bozuk satiri atla, akis devam eder
        return None


async def extract_offers_llm(snippet: str, *, site: str, provider: LLMProvider) -> list[Offer]:
    if not snippet.strip():
        return []
    try:
        raw = await provider.complete(SYSTEM_PROMPT, snippet[:MAX_SNIPPET_CHARS])
    except Exception as exc:
        logger.warning("llm_extract.failed site=%s error=%s", site, exc)
        return []
    items = _safe_json(raw).get("offers", [])
    if not isinstance(items, list):
        return []
    offers = [_to_offer(item, site) for item in items if isinstance(item, dict)]
    return [o for o in offers if o is not None and o.title and o.price > 0]

