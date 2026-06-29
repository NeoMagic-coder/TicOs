"""Web arama yardimcilari — pazar yeri (CollectAPI) + genel web (DuckDuckGo)."""

from __future__ import annotations

import asyncio
import re
from html import unescape
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.shopping.extraction.dom_extractor import parse_price_tr
from apps.api.shopping.schemas import Offer, WebSearchMeta, WebSearchSource

log = get_logger(__name__)

_DDG_HTML = "https://html.duckduckgo.com/html/"
_DDG_TIMEOUT = httpx.Timeout(connect=5.0, read=12.0, write=5.0, pool=5.0)
_DEFAULT_MARKET_SOURCES = ("trendyol", "hepsiburada", "n11")

_RESULT_LINK_RE = re.compile(
    r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_SNIPPET_RE = re.compile(
    r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    return unescape(_TAG_RE.sub("", text or "")).strip()


def _unwrap_ddg_href(href: str) -> str:
    """DuckDuckGo redirect URLs → hedef URL."""
    if "uddg=" in href:
        parsed = urlparse(href)
        qs = parse_qs(parsed.query)
        if qs.get("uddg"):
            return unquote(qs["uddg"][0])
    return href


def collectapi_item_to_offer(item: dict[str, Any], *, source: str) -> Offer | None:
    """CollectAPI alisveris sonucunu Offer'a cevir."""
    title = (item.get("name") or item.get("desc") or "").strip()
    if not title:
        return None
    price_text = (item.get("newprice") or item.get("price") or "").strip()
    price = parse_price_tr(price_text)
    if price is None or price <= 0:
        return None
    link = (item.get("link") or item.get("url") or "").strip()
    desc = (item.get("desc") or "").strip()
    return Offer(
        site=source,
        title=title,
        url=link,
        price=price,
        currency="TRY",
        in_stock=True,
        stock_level=None,
        delivery_days=None,
        warranty_months=None,
        rating=None,
        extracted_via="web_search",
    )


async def search_marketplaces(
    query: str,
    *,
    sources: tuple[str, ...] = _DEFAULT_MARKET_SOURCES,
    limit_per_source: int = 5,
) -> tuple[list[Offer], list[WebSearchSource], list[str]]:
    """CollectAPI uzerinden Turk pazar yerlerinde paralel urun aramasi."""
    if not get_settings().collectapi_api_key:
        # Anahtar yoksa mock fiyatlar skoru bozar; genel web aramasina birak.
        return [], [], []

    from apps.api.tools.live.collectapi import _search_live, _search_mock

    async def _one(source: str) -> tuple[str, dict[str, Any] | None, str | None]:
        payload = {"query": query, "source": source, "limit": limit_per_source}
        try:
            output = await _search_live(payload)
            return source, output, None
        except Exception as exc:
            log.warning("shopping.web_search.market_failed", source=source, error=str(exc)[:120])
            try:
                output = await _search_mock(payload)
                return source, output, None
            except Exception as mock_exc:
                return source, None, str(mock_exc)

    tasks = [_one(src) for src in sources]
    rows = await asyncio.gather(*tasks)

    offers: list[Offer] = []
    sources_out: list[WebSearchSource] = []
    errors: list[str] = []

    for source, output, err in rows:
        if err:
            errors.append(f"{source}: {err}")
            continue
        if not output:
            continue
        items: list[dict[str, Any]] = list(output.get("results") or [])
        for item in items:
            offer = collectapi_item_to_offer(item, source=source)
            if offer is None:
                continue
            offers.append(offer)
            snippet_parts = [offer.title, f"Fiyat: {offer.price:.0f} TRY"]
            if offer.url:
                snippet_parts.append(offer.url)
            sources_out.append(
                WebSearchSource(
                    uri=offer.url or f"collectapi://{source}",
                    title=f"{source}: {offer.title}",
                    snippet=" — ".join(snippet_parts),
                )
            )

    return offers, sources_out, errors


async def _ddg_instant_search(query: str, *, limit: int = 6) -> list[WebSearchSource]:
    """DuckDuckGo Instant Answer API — HTML engellendiginde yedek."""
    sources: list[WebSearchSource] = []
    async with httpx.AsyncClient(timeout=_DDG_TIMEOUT, follow_redirects=True) as client:
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()

    abstract_url = (data.get("AbstractURL") or "").strip()
    if abstract_url:
        sources.append(
            WebSearchSource(
                uri=abstract_url,
                title=(data.get("Heading") or query).strip(),
                snippet=(data.get("Abstract") or "").strip(),
            )
        )

    for topic in data.get("RelatedTopics") or []:
        if len(sources) >= limit:
            break
        if not isinstance(topic, dict):
            continue
        uri = (topic.get("FirstURL") or "").strip()
        text = (topic.get("Text") or "").strip()
        if uri and text:
            sources.append(WebSearchSource(uri=uri, title=text[:120], snippet=text))

    return sources[:limit]


async def search_web_general(query: str, *, limit: int = 6) -> tuple[list[WebSearchSource], list[str]]:
    """DuckDuckGo HTML uzerinden genel web aramasi (API anahtari gerektirmez)."""
    sources: list[WebSearchSource] = []
    errors: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=_DDG_TIMEOUT, follow_redirects=True) as client:
            resp = await client.post(
                _DDG_HTML,
                data={"q": query, "b": "", "kl": "tr-tr"},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                    ),
                    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
                    "Accept": "text/html",
                },
            )
            resp.raise_for_status()
            html = resp.text
    except Exception as exc:
        log.warning("shopping.web_search.ddg_html_failed", error=str(exc)[:120])
        errors.append(str(exc))
        try:
            sources = await _ddg_instant_search(query, limit=limit)
        except Exception as instant_exc:
            log.warning("shopping.web_search.ddg_instant_failed", error=str(instant_exc)[:120])
            errors.append(str(instant_exc))
        return sources, errors

    links = _RESULT_LINK_RE.findall(html)
    snippets = _SNIPPET_RE.findall(html)
    for i, (href, title_html) in enumerate(links[:limit]):
        uri = _unwrap_ddg_href(href.strip())
        title = _strip_html(title_html)
        snippet = _strip_html(snippets[i]) if i < len(snippets) else title
        if not uri or not title:
            continue
        sources.append(WebSearchSource(uri=uri, title=title, snippet=snippet))

    if not sources:
        try:
            sources = await _ddg_instant_search(query, limit=limit)
        except Exception as instant_exc:
            errors.append(str(instant_exc))

    return sources, errors


async def run_product_web_search(
    query: str,
    *,
    market_sources: tuple[str, ...] = _DEFAULT_MARKET_SOURCES,
    limit_per_source: int = 5,
    include_general_web: bool = True,
) -> tuple[list[Offer], WebSearchMeta]:
    """Pazar yeri + genel web aramasini birlestir."""
    if include_general_web:
        (offers, market_sources_out, market_errors), (web_sources, web_errors) = await asyncio.gather(
            search_marketplaces(query, sources=market_sources, limit_per_source=limit_per_source),
            search_web_general(query),
        )
    else:
        offers, market_sources_out, market_errors = await search_marketplaces(
            query, sources=market_sources, limit_per_source=limit_per_source
        )
        web_sources, web_errors = [], []

    all_sources = market_sources_out + web_sources
    degraded = not offers and not all_sources
    degraded_reason: str | None = None
    if degraded:
        if not get_settings().collectapi_api_key:
            degraded_reason = "collectapi_key_missing"
        elif market_errors:
            degraded_reason = market_errors[0][:200]
        else:
            degraded_reason = "no_results"
    elif not offers and web_sources:
        degraded_reason = "marketplace_empty_web_only"

    meta = WebSearchMeta(
        query=query,
        queries=[query],
        sources=all_sources,
        market_sources=list(market_sources),
        offer_count=len(offers),
        degraded=degraded,
        degraded_reason=degraded_reason,
        errors=[*market_errors, *web_errors],
    )
    return offers, meta


async def enrich_web_search_summary(
    meta: WebSearchMeta,
    llm: Any,
) -> WebSearchMeta:
    """Web arama kaynaklarindan kisa Turkce ozet uret (Bedrock/Gemini/mock)."""
    if meta.answer or (not meta.sources and meta.offer_count == 0):
        return meta

    lines: list[str] = []
    if meta.offer_count:
        lines.append(f"Pazar yerlerinde {meta.offer_count} teklif bulundu.")
    for src in meta.sources[:8]:
        line = f"- {src.title}"
        if src.snippet:
            line += f": {src.snippet[:200]}"
        if src.uri:
            line += f" ({src.uri})"
        lines.append(line)

    system = (
        "Sen TicOSClaw alisveris arastirma asistanisin. Verilen web arama "
        "sonuclarina dayanarak 2-3 cumlelik Turkce ozet yaz. Fiyat ve stok "
        "varsa belirt; kaynaklarda olmayan bilgi uydurma."
    )
    user = f"Urun sorgusu: {meta.query}\n\nArama sonuclari:\n" + "\n".join(lines)
    try:
        answer = (await llm.complete(system, user)).strip()
        if answer:
            return meta.model_copy(update={"answer": answer})
    except Exception as exc:
        log.warning("shopping.web_search.summary_failed", error=str(exc)[:120])
    return meta
