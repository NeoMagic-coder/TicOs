"""Ajan orkestratoru — gez, cikar, skorla, oner.

Akis kisiti 1 geregi hatalar akinti yonudur: bir site coktugunde kosu durmaz,
hata SiteError olarak rapora yazilir ve kalan sitelerle devam edilir.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid

from apps.api.shopping.config import Settings, get_settings
from apps.api.shopping.core.scoring import LOW_STOCK_THRESHOLD, rank_offers
from apps.api.shopping.core.web_search import enrich_web_search_summary, run_product_web_search
from apps.api.shopping.crawler import ADAPTERS
from apps.api.shopping.crawler.base import SiteAdapter, SiteResult
from apps.api.shopping.crawler.browser import open_browser
from apps.api.shopping.db import repo
from apps.api.shopping.db.database import SessionLocal
from apps.api.shopping.llm.provider import LLMProvider, get_llm_provider
from apps.api.shopping.schemas import AgentRunResult, RunStatus, ScoredOffer, ShoppingGoal, SiteError

logger = logging.getLogger(__name__)


def resolve_sites(settings: Settings) -> list[str]:
    names = [s.strip().casefold() for s in settings.sites.split(",")]
    return [n for n in names if n in ADAPTERS]


async def _crawl_one(
    adapter: SiteAdapter,
    goal: ShoppingGoal,
    *,
    browser_ctx: object | None,
    llm: LLMProvider,
    limit: int,
) -> SiteResult:
    try:
        if adapter.requires_browser:
            if browser_ctx is None:
                raise RuntimeError("tarayici baslatilamadi")
            page = await browser_ctx.new_page()  # type: ignore[attr-defined]
            try:
                offers = await adapter.fetch_offers(goal, page=page, llm=llm, limit=limit)
            finally:
                await page.close()
        else:
            offers = await adapter.fetch_offers(goal, page=None, llm=llm, limit=limit)
        logger.info("crawl.site_done site=%s offers=%d", adapter.site_name, len(offers))
        return SiteResult(site=adapter.site_name, offers=offers)
    except Exception as exc:  # hata = akinti yonu: site duser, akis devam eder
        logger.warning("crawl.site_failed site=%s error=%s", adapter.site_name, exc)
        return SiteResult(site=adapter.site_name, offers=[], error=str(exc))


def build_recommendation(
    ranked: list[ScoredOffer],
) -> tuple[ScoredOffer | None, list[ScoredOffer]]:
    """En iyi teklifi sec; stok azsa bol stoklu alternatifi one cikar (senaryo 3)."""
    if not ranked:
        return None, []
    best = ranked[0]
    rest = list(ranked[1:4])
    offer = best.offer
    if offer.stock_level is not None and offer.stock_level <= LOW_STOCK_THRESHOLD:
        stocked_alts = [
            s
            for s in ranked[1:]
            if s.offer.in_stock
            and (s.offer.stock_level is None or s.offer.stock_level > LOW_STOCK_THRESHOLD)
        ]
        if stocked_alts:
            alt = stocked_alts[0]
            best = best.model_copy(
                update={
                    "reasons": [
                        *best.reasons,
                        f"Stok riski: alternatif olarak '{alt.offer.title}' "
                        f"({alt.offer.site}) degerlendirilebilir.",
                    ]
                }
            )
            rest = [alt, *[s for s in rest if s is not alt]][:3]
    return best, rest


def _summarize(
    ranked: list[ScoredOffer],
    best: ScoredOffer | None,
    sites: list[str],
    errors: list[SiteError],
    *,
    web_offer_count: int = 0,
    web_source_count: int = 0,
) -> str:
    parts = [f"{len(sites)} kaynak tarandi, {len(ranked)} uygun teklif bulundu."]
    if web_offer_count:
        parts.append(
            f"Web aramasi: {web_offer_count} pazar yeri teklifi, {web_source_count} kaynak."
        )
    if best is not None:
        parts.append(
            f"Oneri: {best.offer.title} — {best.offer.price:.0f} {best.offer.currency} "
            f"({best.offer.site}), skor {best.score:.2f}."
        )
    else:
        parts.append("Kriterlere uyan teklif bulunamadi; butce veya filtreleri gevsetmeyi deneyin.")
    if errors:
        failed = ", ".join(e.site for e in errors)
        parts.append(f"Hata alinan siteler: {failed} (akis kalan sitelerle tamamlandi).")
    return " ".join(parts)


async def run_shopping_agent(
    goal: ShoppingGoal,
    settings: Settings | None = None,
    run_id: str | None = None,
) -> AgentRunResult:
    settings = settings or get_settings()
    run_id = run_id or uuid.uuid4().hex[:12]
    start = time.perf_counter()

    site_names = resolve_sites(settings)
    web_search_meta = None
    web_offers: list = []

    if "web_search" in site_names:
        market_sources = tuple(
            s.strip().casefold()
            for s in settings.web_search_sources.split(",")
            if s.strip()
        )
        web_offers, web_search_meta = await run_product_web_search(
            goal.product_query.strip(),
            market_sources=market_sources or ("trendyol", "hepsiburada", "n11"),
            limit_per_source=settings.max_offers_per_site,
            include_general_web=settings.web_search_general,
        )
        site_names = [n for n in site_names if n != "web_search"]

    llm = get_llm_provider(settings)
    if web_search_meta is not None:
        web_search_meta = await enrich_web_search_summary(web_search_meta, llm)

    adapters = [ADAPTERS[name]() for name in site_names if name in ADAPTERS]
    limit = settings.max_offers_per_site

    results = await _crawl_all(adapters, goal, settings=settings, llm=llm, limit=limit)

    offers = [*web_offers, *(offer for result in results for offer in result.offers)]
    errors = [SiteError(site=r.site, error=r.error) for r in results if r.error]
    ranked = rank_offers(offers, goal)
    best, alternatives = build_recommendation(ranked)

    duration = round(time.perf_counter() - start, 2)
    if errors and not offers:
        status = RunStatus.FAILED
    elif errors:
        status = RunStatus.PARTIAL
    else:
        status = RunStatus.COMPLETED

    return AgentRunResult(
        run_id=run_id,
        status=status,
        goal=goal,
        best=best,
        alternatives=alternatives,
        all_offers=ranked,
        site_errors=errors,
        duration_seconds=duration,
        time_saved_seconds=round(max(0.0, settings.manual_baseline_seconds - duration), 2),
        summary=_summarize(
            ranked,
            best,
            resolve_sites(settings),
            errors,
            web_offer_count=len(web_offers),
            web_source_count=len(web_search_meta.sources) if web_search_meta else 0,
        ),
        web_search=web_search_meta,
    )


async def _crawl_all(
    adapters: list[SiteAdapter],
    goal: ShoppingGoal,
    *,
    settings: Settings,
    llm: LLMProvider,
    limit: int,
) -> list[SiteResult]:
    """Siteleri paralel gez; tarayici hic acilamazsa bile tarayicisiz adaptorler calisir."""
    needs_browser = any(a.requires_browser for a in adapters)
    if needs_browser:
        try:
            async with open_browser(
                headless=settings.headless, timeout_ms=settings.nav_timeout_ms
            ) as ctx:
                return await asyncio.gather(
                    *[
                        _crawl_one(a, goal, browser_ctx=ctx, llm=llm, limit=limit)
                        for a in adapters
                    ]
                )
        except Exception as exc:
            logger.warning("crawl.browser_unavailable error=%s — tarayicisiz devam ediliyor", exc)
    return await asyncio.gather(
        *[_crawl_one(a, goal, browser_ctx=None, llm=llm, limit=limit) for a in adapters]
    )


async def execute_run(run_id: str) -> None:
    """Arka plan gorevi: kosuyu calistirir, sonucu/hatayi veritabanina yazar."""
    settings = get_settings()
    async with SessionLocal() as session:
        row = await repo.get_run(session, run_id)
        if row is None:
            return
        goal = ShoppingGoal.model_validate_json(row.goal_json)
        await repo.set_run_status(session, run_id, RunStatus.RUNNING)
    try:
        result = await run_shopping_agent(goal, settings, run_id=run_id)
    except Exception as exc:
        logger.exception("run.failed run_id=%s", run_id)
        async with SessionLocal() as session:
            await repo.set_run_failed(session, run_id, str(exc))
        return
    async with SessionLocal() as session:
        await repo.set_run_result(session, run_id, result)

