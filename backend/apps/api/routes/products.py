"""Product registry — persistent via SQLAlchemy (`ProductRow`).

Phase 3 promoted this from an in-memory dict to a real DB table so:
- A reload no longer wipes the product list.
- Per-product telemetry rollups (`DashboardSnapshotRow`) can FK back to it.
- Two browser tabs see the same products.

Endpoints:
- GET    /api/v1/products                  list
- POST   /api/v1/products                  upsert by name (becomes active on first insert)
- POST   /api/v1/products/fetch-from-url   LLM-extract product info from a URL
- DELETE /api/v1/products/{name}           delete
- POST   /api/v1/products/{name}/activate  flip the active flag
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import html as htmllib

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from apps.api.core.db import session_scope
from apps.api.core.db.models import ProductRow
from apps.api.core.llm.provider import LLMMessage, MockProvider, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.services.product_bridge import sync_workspace_product_to_inventory

log = get_logger(__name__)
router = APIRouter(prefix="/products", tags=["products"])


class ProductIn(BaseModel):
    product_name: str = Field(..., min_length=1, max_length=200)
    product_description: str = ""
    category: str = "Genel"
    reference_url: str = ""
    image_url: str = "📦"
    stage: str = "idea"
    target_market: str = "TR"
    channels: list[str] = Field(default_factory=lambda: ["Shopify"])
    monthly_budget_band: str = "0-5k"
    priorities: list[str] = Field(default_factory=lambda: ["fast_sales"])


class Product(ProductIn):
    onboarded_at: str
    is_active: bool = False


def _row_to_product(row: ProductRow) -> Product:
    return Product(
        product_name=row.name,
        product_description=row.description or "",
        category=row.category or "Genel",
        reference_url=row.reference_url or "",
        image_url=row.image_url or "📦",
        stage=row.stage or "idea",
        target_market=row.target_market or "TR",
        channels=list(row.channels or []),
        monthly_budget_band=row.monthly_budget_band or "0-5k",
        priorities=list(row.priorities or []),
        onboarded_at=row.onboarded_at.isoformat() if row.onboarded_at else datetime.utcnow().isoformat(),
        is_active=bool(row.is_active),
    )


@router.get("", response_model=list[Product])
async def list_products() -> list[Product]:
    with session_scope() as s:
        rows = s.execute(select(ProductRow).order_by(ProductRow.onboarded_at.desc())).scalars().all()
        return [_row_to_product(r) for r in rows]


@router.post("", response_model=Product)
async def upsert_product(body: ProductIn) -> Product:
    with session_scope() as s:
        row = s.get(ProductRow, body.product_name)
        first_insert = row is None
        if row is None:
            row = ProductRow(name=body.product_name)
            s.add(row)
        row.description = body.product_description
        row.category = body.category
        row.reference_url = body.reference_url
        row.image_url = body.image_url
        row.stage = body.stage
        row.target_market = body.target_market
        row.channels = list(body.channels)
        row.monthly_budget_band = body.monthly_budget_band
        row.priorities = list(body.priorities)
        # First product becomes active automatically.
        any_active = s.execute(select(ProductRow.name).where(ProductRow.is_active.is_(True))).first()
        if first_insert and not any_active:
            row.is_active = True
        s.flush()
        result = _row_to_product(row)
    log.info("products.upserted", product=body.product_name)
    if result.is_active:
        sync_workspace_product_to_inventory(body.product_name)
        from apps.api.core.autonomy.goal_loop import ensure_default_goals

        ensure_default_goals(product_name=body.product_name)
    return result


_CATEGORIES = [
    "Ev & Mutfak", "Moda & Aksesuar", "Elektronik", "Kozmetik & Bakım",
    "Spor & Outdoor", "Bebek & Anne", "Hobi", "Otomotiv",
]

_FETCH_SYSTEM_PROMPT = (
    "Sen bir e-ticaret ürün analisti asistanısın. Sana verilen ÜRÜN SAYFASI "
    "URL'sini Google araması ile aç, sayfanın başlığını, açıklamasını ve "
    "kategorisini öğren. Yanıtı SADECE aşağıdaki JSON şemasında, başka hiçbir "
    "metin olmadan döndür:\n\n"
    "{\n"
    '  "product_name": "kısa, satılabilir Türkçe başlık (max 80 karakter)",\n'
    '  "product_description": "3 cümlelik Türkçe pitch (hedef kitle, '
    'farklılaştırıcı, ana fayda; max 240 karakter)",\n'
    '  "category": "AŞAĞIDAKİ LİSTEDEN BİRİ — birebir eşleşmeli",\n'
    '  "brand": "marka adı veya boş",\n'
    '  "price_text": "fiyat metni veya boş",\n'
    '  "confidence": 0.0-1.0 arası float\n'
    "}\n\n"
    f"Kategori listesi: {_CATEGORIES}\n\n"
    "Eğer URL erişilemiyor, ürün sayfası değil ya da bilgi yetersizse "
    "alanları boş bırak ve confidence 0 ver. JSON dışında yorum yazma."
)


class FetchFromUrlIn(BaseModel):
    url: str = Field(..., min_length=8, max_length=2000)


class FetchFromUrlOut(BaseModel):
    product_name: str = ""
    product_description: str = ""
    category: str = ""
    brand: str = ""
    price_text: str = ""
    confidence: float = 0.0
    sources: list[dict[str, str]] = Field(default_factory=list)
    model: str = ""
    degraded: bool = False
    degraded_reason: str | None = None


def _extract_json(text: str) -> dict[str, Any]:
    """Pull the first JSON object out of an LLM response.

    Gemini sometimes wraps JSON in ```json fences or trails commentary; we
    locate the outermost {...} span and parse that.
    """
    if not text:
        return {}
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except Exception:
            pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return {}
    return {}


async def _scrape_product_html(url: str) -> dict[str, str]:
    """Best-effort deterministic scraper — no LLM required.

    Parses og:title, og:description, og:price, JSON-LD Product nodes, and
    canonical <title>. Used as a fallback when the LLM is quota-exhausted
    so the URL fetch flow still returns something useful.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        ),
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text
    except Exception as exc:
        log.warning("products.scrape_failed", url=url[:200], error=str(exc)[:200])
        return {}

    def _meta(prop: str) -> str:
        m = re.search(
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)["\']',
            html, flags=re.IGNORECASE,
        )
        return htmllib.unescape(m.group(1)).strip() if m else ""

    name = _meta("og:title") or _meta("twitter:title")
    desc = _meta("og:description") or _meta("description") or _meta("twitter:description")
    brand = _meta("product:brand") or _meta("og:brand")
    price = _meta("product:price:amount") or _meta("og:price:amount")
    currency = _meta("product:price:currency") or _meta("og:price:currency") or "TL"

    # JSON-LD Product node — richer fields if present.
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, flags=re.DOTALL | re.IGNORECASE,
    ):
        try:
            data = json.loads(m.group(1).strip())
        except Exception:
            continue
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get("@type") or node.get("type") or ""
            if isinstance(t, list):
                t = t[0] if t else ""
            if "Product" not in str(t):
                continue
            name = name or str(node.get("name") or "")
            desc = desc or str(node.get("description") or "")
            br = node.get("brand")
            if isinstance(br, dict):
                brand = brand or str(br.get("name") or "")
            elif isinstance(br, str):
                brand = brand or br
            offers = node.get("offers")
            if isinstance(offers, dict):
                price = price or str(offers.get("price") or "")
                currency = currency or str(offers.get("priceCurrency") or "TL")

    if not name:
        m = re.search(r"<title[^>]*>([^<]+)</title>", html, flags=re.IGNORECASE)
        if m:
            name = htmllib.unescape(m.group(1)).strip()

    out = {
        "product_name": name[:200],
        "product_description": desc[:240],
        "brand": brand[:120],
        "price_text": (f"{price} {currency}".strip() if price else "")[:80],
    }
    return out


# IMPORTANT: this route MUST be declared before the parameterized
# `/{name}` routes below. FastAPI matches routes by declaration order and
# would otherwise route `POST /products/fetch-from-url` to the
# `DELETE /{name}` handler (returning 405 Method Not Allowed).
@router.post("/fetch-from-url", response_model=FetchFromUrlOut)
async def fetch_from_url(body: FetchFromUrlIn) -> FetchFromUrlOut:
    """Look up a product page on the web and return structured info.

    Uses the configured LLM provider with Google Search grounding so the model
    can actually fetch the page contents before answering. Falls back to a
    degraded response (empty fields, confidence=0) when no LLM key is
    configured or extraction fails — never raises on bad URLs / missing data.
    """
    url = body.url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="invalid url")

    provider = get_llm_provider()
    resp = None
    if not isinstance(provider, MockProvider):
        try:
            resp = await provider.generate(
                system=_FETCH_SYSTEM_PROMPT,
                messages=[LLMMessage(role="user", content=f"URL: {url}")],
                temperature=0.2,
                max_tokens=900,
                grounding=["google_search"],
            )
        except Exception as exc:
            log.warning("products.fetch_from_url.exception", url=url[:200], error=str(exc)[:200])

    data: dict[str, Any] = {}
    if resp is not None and resp.text and not (resp.model or "").startswith("mock"):
        data = _extract_json(resp.text)

    # Deterministic HTML scrape fallback — runs when the LLM call failed,
    # was quota-degraded to mock, or returned an empty/unparseable payload.
    if not data.get("product_name"):
        scraped = await _scrape_product_html(url)
        if scraped.get("product_name"):
            log.info("products.fetch_from_url.scraped", url=url[:200], name=scraped.get("product_name", "")[:60])
            data = {**scraped, **{k: v for k, v in data.items() if v}, "confidence": data.get("confidence") or 0.6}
    category = str(data.get("category") or "").strip()
    if category and category not in _CATEGORIES:
        # Best-effort normalisation: keep only categories the UI knows about.
        category = ""

    meta = ((resp.raw if resp else {}) or {}).get("grounding_metadata") or {}
    sources = [
        {"uri": str(s.get("uri") or ""), "title": str(s.get("title") or s.get("uri") or "")}
        for s in (meta.get("sources") or [])
        if isinstance(s, dict) and s.get("uri")
    ]

    resp_model = (resp.model if resp else "") or ""
    used_scraper = bool(data.get("product_name")) and (not resp_model or resp_model.startswith("mock"))
    model_used = "scraper" if used_scraper else resp_model
    out = FetchFromUrlOut(
        product_name=str(data.get("product_name") or "")[:200],
        product_description=str(data.get("product_description") or "")[:240],
        category=category,
        brand=str(data.get("brand") or "")[:120],
        price_text=str(data.get("price_text") or "")[:80],
        confidence=float(data.get("confidence") or 0.0),
        sources=sources[:6],
        model=model_used,
        degraded=not (data.get("product_name") or data.get("product_description")),
        degraded_reason=None if data else "parse_failed",
    )
    log.info(
        "products.fetch_from_url.ok",
        url=url[:200],
        has_name=bool(out.product_name),
        category=out.category,
        confidence=out.confidence,
    )
    return out


@router.delete("/{name}")
async def delete_product(name: str) -> dict[str, Any]:
    with session_scope() as s:
        row = s.get(ProductRow, name)
        if row is None:
            raise HTTPException(status_code=404, detail=f"product '{name}' not found")
        was_active = bool(row.is_active)
        s.delete(row)
        s.flush()
        remaining = s.execute(select(ProductRow).order_by(ProductRow.onboarded_at.desc())).scalars().all()
        new_active: str | None = None
        if was_active and remaining:
            remaining[0].is_active = True
            new_active = remaining[0].name
    log.info("products.deleted", product=name)
    return {"deleted": name, "remaining": len(remaining), "active": new_active}


@router.post("/{name}/activate", response_model=Product)
async def activate_product(name: str) -> Product:
    with session_scope() as s:
        target = s.get(ProductRow, name)
        if target is None:
            raise HTTPException(status_code=404, detail=f"product '{name}' not found")
        s.execute(update(ProductRow).values(is_active=False))
        target.is_active = True
        s.flush()
        result = _row_to_product(target)
    sync_workspace_product_to_inventory(name)
    return result
