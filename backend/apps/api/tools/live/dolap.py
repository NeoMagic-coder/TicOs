"""Dolap mobile API live tool adapters."""
from __future__ import annotations

from typing import Any

from apps.api.core.dolap.client import DolapClient, dolap_configured
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_client = DolapClient()


async def _get_products_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not dolap_configured():
        return await _get_products_mock(payload)
    nick = payload.get("nickname")
    max_pages = int(payload.get("max_pages") or 20)
    data = await _client.get_products(nick, max_pages=max_pages)
    return {**data, "degraded": False}


async def _get_products_mock(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "nickname": payload.get("nickname") or "demo_seller",
        "owner_id": 0,
        "total": 1,
        "products": [
            {
                "id": "mock-dolap-1",
                "title": "Demo Dolap İlanı",
                "price": 199.0,
                "like_count": 3,
                "comment_count": 0,
                "thumbnail_url": None,
                "url": "https://dolap.com/urun/mock-dolap-1",
            }
        ],
        "degraded": True,
    }


async def _get_profile_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not dolap_configured():
        return await _get_profile_mock(payload)
    nick = payload.get("nickname")
    profile = await _client.get_profile(nick)
    return {**profile, "degraded": False}


async def _get_profile_mock(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "nickname": payload.get("nickname") or "demo_seller",
        "member_id": 0,
        "follower_count": 0,
        "followee_count": 0,
        "display_name": "Demo Satıcı",
        "degraded": True,
    }


async def _onboard_guide_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not dolap_configured():
        return await _onboard_guide_mock(payload)
    try:
        profile = await _client.get_profile()
        steps = [
            "Dolap mobil uygulamasından satıcı hesabını doğrula",
            "Ürün fotoğraflarını net ve tek ürün odaklı çek",
            "Kategori ve marka bilgisini eksiksiz gir",
            "Fiyatı piyasa ortalamasının %5–10 altında başlat",
            "İlk hafta 2–3 ilanı öne çıkar",
        ]
        tips = [
            f"Bağlı hesap: @{profile.get('nickname')} ({profile.get('follower_count')} takipçi)",
            "TicOSClaw üzerinden ürün listesini dolap_get_products ile çekebilirsin",
        ]
        if payload.get("category"):
            tips.append(f"Hedef kategori: {payload['category']}")
        return {
            "steps": steps,
            "tips": tips,
            "connected_profile": profile,
            "degraded": False,
        }
    except Exception as exc:
        log.warning("dolap.onboard_guide_live_failed", error=str(exc)[:200])
        mock = await _onboard_guide_mock(payload)
        mock["tips"] = [*mock["tips"], f"Canlı profil alınamadı: {exc}"]
        return mock


async def _onboard_guide_mock(payload: dict[str, Any]) -> dict[str, Any]:
    steps = [
        "Dolap uygulamasını indir ve satıcı hesabı aç",
        "Profil fotoğrafı ve kısa biyografi ekle",
        "İlk ilanı moda kategorisinde yayınla",
        "DOLAP_USERNAME ve DOLAP_PASSWORD ile TicOSClaw bağlantısını kur",
    ]
    tips = [
        "Resmi Partner API yok — TicOSClaw mobil API köprüsü kullanır",
        "Hesap güvenliği için yalnızca .env.local kullan",
    ]
    if payload.get("category"):
        tips.append(f"Kategori önerisi: {payload['category']}")
    return {"steps": steps, "tips": tips, "degraded": True}


async def _close_listing_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not dolap_configured():
        return await _close_listing_mock(payload)
    product_id = payload.get("product_id") or payload.get("productId")
    if product_id is None:
        raise ValueError("product_id required")
    return await _client.close_listing(product_id)


async def _close_listing_mock(payload: dict[str, Any]) -> dict[str, Any]:
    pid = payload.get("product_id") or payload.get("productId") or "mock-dolap-1"
    return {"product_id": str(pid), "status": "closed", "ok": True, "degraded": True}


def register() -> None:
    register_live_adapter(
        "dolap_get_products",
        with_breaker(
            tool_id="dolap_get_products",
            adapter=_get_products_live,
            mock_fallback=_get_products_mock,
        ),
    )
    register_live_adapter(
        "dolap_get_profile",
        with_breaker(
            tool_id="dolap_get_profile",
            adapter=_get_profile_live,
            mock_fallback=_get_profile_mock,
        ),
    )
    register_live_adapter(
        "dolap_seller_onboard_guide",
        with_breaker(
            tool_id="dolap_seller_onboard_guide",
            adapter=_onboard_guide_live,
            mock_fallback=_onboard_guide_mock,
        ),
    )
    register_live_adapter(
        "dolap_listing_close",
        with_breaker(
            tool_id="dolap_listing_close",
            adapter=_close_listing_live,
            mock_fallback=_close_listing_mock,
        ),
    )
    log.info("live.dolap.registered", configured=dolap_configured())
