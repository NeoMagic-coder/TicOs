"""Integration registry. Surfaces the connection status of external channels
(Shopify, Trendyol, GA4, Meta Ads, Google Ads, Klaviyo) based on the env-loaded
settings. The frontend Integrations page hydrates from this — no more
seed-empty array masquerading as "not connected"."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from apps.api.core.config import get_settings
from apps.api.core.dolap.client import dolap_configured

router = APIRouter(prefix="/integrations", tags=["integrations"])


class Integration(BaseModel):
    id: str
    platform: str
    icon: str
    store_name: str
    status: str  # "connected" | "disconnected" | "error"
    mode: str    # "live" | "mock" | "stub"
    last_sync: str | None = None
    notes: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=list[Integration])
def list_integrations() -> list[Integration]:
    s = get_settings()
    out: list[Integration] = []

    out.append(Integration(
        id="shopify",
        platform="Shopify",
        icon="🛍️",
        store_name=f"{s.shopify_shop}.myshopify.com" if s.shopify_shop else "—",
        status="connected" if (s.shopify_shop and s.shopify_access_token) else "disconnected",
        mode="live" if (s.shopify_shop and s.shopify_access_token) else "stub",
        last_sync=_now_iso() if (s.shopify_shop and s.shopify_access_token) else None,
        notes=None if (s.shopify_shop and s.shopify_access_token) else "SHOPIFY_SHOP ve SHOPIFY_ACCESS_TOKEN gerekli.",
    ))

    out.append(Integration(
        id="trendyol",
        platform="Trendyol",
        icon="🟠",
        store_name=f"supplier:{s.trendyol_supplier_id}" if s.trendyol_supplier_id else "—",
        status="connected" if (s.trendyol_supplier_id and s.trendyol_api_key) else "disconnected",
        mode="live" if (s.trendyol_supplier_id and s.trendyol_api_key) else "stub",
        last_sync=_now_iso() if (s.trendyol_supplier_id and s.trendyol_api_key) else None,
        notes=None if (s.trendyol_supplier_id and s.trendyol_api_key) else "TRENDYOL_SUPPLIER_ID, TRENDYOL_API_KEY ve TRENDYOL_API_SECRET gerekli.",
    ))

    dolap_ok = dolap_configured()
    dolap_label = s.dolap_nickname or s.dolap_username or ("token" if s.dolap_access_token else "—")
    out.append(Integration(
        id="dolap",
        platform="Dolap",
        icon="👗",
        store_name=f"@{dolap_label}" if dolap_ok else "—",
        status="connected" if dolap_ok else "disconnected",
        mode="live" if dolap_ok else "stub",
        last_sync=_now_iso() if dolap_ok else None,
        notes=None if dolap_ok else "DOLAP_ACCESS_TOKEN veya DOLAP_USERNAME + DOLAP_PASSWORD gerekli.",
    ))

    ga4_ok = bool(s.ga4_property_id and (s.ga4_service_account_json or s.ga4_access_token))
    out.append(Integration(
        id="ga4",
        platform="Google Analytics 4",
        icon="📊",
        store_name=f"property:{s.ga4_property_id}" if s.ga4_property_id else "—",
        status="connected" if ga4_ok else "disconnected",
        mode="live" if ga4_ok else "stub",
        last_sync=_now_iso() if ga4_ok else None,
        notes=None if ga4_ok else "GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON (veya GA4_ACCESS_TOKEN) gerekli.",
    ))

    # Phase-2 stubs — credentials never configured, adapter not implemented.
    for stub in [
        ("meta_ads", "Meta Ads", "📘"),
        ("google_ads", "Google Ads", "🔵"),
        ("klaviyo", "Klaviyo", "✉️"),
    ]:
        out.append(Integration(
            id=stub[0], platform=stub[1], icon=stub[2],
            store_name="—",
            status="disconnected",
            mode="stub",
            last_sync=None,
            notes="Phase-2 adapter — henüz canlı bağlanmadı.",
        ))

    return out
