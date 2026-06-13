"""Playwright tarayici yasam dongusu yardimcisi."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


@asynccontextmanager
async def open_browser(*, headless: bool = True, timeout_ms: int = 20_000) -> AsyncIterator[Any]:
    # Lazy import: mockstore-only kosular ve testler playwright kurulumu gerektirmez
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context(
            locale="tr-TR",
            user_agent=_USER_AGENT,
            viewport={"width": 1366, "height": 900},
        )
        context.set_default_timeout(timeout_ms)
        context.set_default_navigation_timeout(timeout_ms)
        try:
            yield context
        finally:
            await context.close()
            await browser.close()
