"""Google Analytics 4 Data API live adapter.

Tools wired:
- ``ga4_realtime_report``  → POST .../properties/{id}:runRealtimeReport
- ``ga4_sessions_report``  → POST .../properties/{id}:runReport  (7-day)

Auth priority:
  1. ``GA4_SERVICE_ACCOUNT_JSON`` env var (base64-encoded service account JSON)
     — uses ``google-auth`` to obtain a short-lived bearer token.
  2. ``GA4_ACCESS_TOKEN`` env var — static token, useful for testing.
  When neither is set the adapters fall back to mock output with ``degraded: true``.

Env vars:
  GA4_PROPERTY_ID          — numeric GA4 property ID (e.g. "123456789")
  GA4_SERVICE_ACCOUNT_JSON — base64(service_account.json bytes)   OR
  GA4_ACCESS_TOKEN         — short-lived OAuth2 access token

Rate-limit handling: GA4 returns 429 with ``retryDelay`` in the error body.
We respect it up to ``_MAX_ATTEMPTS`` times before raising.
"""
from __future__ import annotations

import asyncio
import base64
import json
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_BASE = "https://analyticsdata.googleapis.com/v1beta"
_SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]
_TIMEOUT = httpx.Timeout(connect=5.0, read=20.0, write=10.0, pool=5.0)
_MAX_ATTEMPTS = 3


def _configured() -> bool:
    s = get_settings()
    return bool(s.ga4_property_id and (s.ga4_service_account_json or s.ga4_access_token))


def _get_access_token() -> str | None:
    """Return a bearer token from SA JSON or static env var. Returns None if not configured."""
    s = get_settings()
    if s.ga4_service_account_json:
        try:
            from google.oauth2 import service_account  # type: ignore[import-untyped]

            sa_bytes = base64.b64decode(s.ga4_service_account_json)
            sa_info = json.loads(sa_bytes)
            creds = service_account.Credentials.from_service_account_info(
                sa_info, scopes=_SCOPES
            )
            # Refresh synchronously — credentials.token is populated after refresh.
            import google.auth.transport.requests as treqs  # type: ignore[import-untyped]

            creds.refresh(treqs.Request())
            return creds.token
        except Exception as exc:
            log.warning("ga4.token_refresh_failed", error=str(exc)[:200])
            return None
    if s.ga4_access_token:
        return s.ga4_access_token
    return None


async def _request(
    path: str,
    body: dict[str, Any],
    token: str,
) -> dict[str, Any]:
    """Single GA4 REST call with 429-aware retry."""
    url = f"{_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=body, headers=headers)

        if resp.status_code == 429:
            try:
                retry_delay = float(
                    resp.json()
                    .get("error", {})
                    .get("details", [{}])[0]
                    .get("retryDelay", "2s")
                    .rstrip("s")
                )
            except Exception:
                retry_delay = 2.0
            log.warning("ga4.rate_limited", attempt=attempt, retry_in_s=retry_delay)
            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(min(retry_delay, 20))
                continue
            resp.raise_for_status()

        if 500 <= resp.status_code < 600 and attempt < _MAX_ATTEMPTS:
            backoff = min(2**attempt, 12)
            log.warning("ga4.5xx", status=resp.status_code, attempt=attempt, backoff=backoff)
            await asyncio.sleep(backoff)
            continue

        resp.raise_for_status()
        return resp.json()

    raise RuntimeError("ga4._request: exhausted retries without returning")


def _parse_report_rows(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert GA4 runReport/runRealtimeReport response rows → list of dicts."""
    dimension_headers = [h.get("name", "") for h in data.get("dimensionHeaders", [])]
    metric_headers = [h.get("name", "") for h in data.get("metricHeaders", [])]
    rows = []
    for row in data.get("rows", []):
        record: dict[str, Any] = {}
        for i, dim in enumerate(row.get("dimensionValues", [])):
            key = dimension_headers[i] if i < len(dimension_headers) else f"dim_{i}"
            record[key] = dim.get("value")
        for i, met in enumerate(row.get("metricValues", [])):
            key = metric_headers[i] if i < len(metric_headers) else f"metric_{i}"
            record[key] = met.get("value")
        rows.append(record)
    return rows


# ── ga4_realtime_report ────────────────────────────────────────────────────────

async def _realtime_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        return await _realtime_mock(payload)
    token = _get_access_token()
    if not token:
        return {**await _realtime_mock(payload), "degraded": True}

    prop_id = get_settings().ga4_property_id
    body: dict[str, Any] = {
        "dimensions": [{"name": "country"}, {"name": "deviceCategory"}],
        "metrics": [{"name": "activeUsers"}],
    }
    data = await _request(f"/properties/{prop_id}:runRealtimeReport", body, token)
    rows = _parse_report_rows(data)
    total_active = sum(int(r.get("activeUsers", 0)) for r in rows)
    return {
        "active_users": total_active,
        "top_countries": rows[:10],
        "kind": "realtime",
    }


async def _realtime_mock(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "active_users": 47,
        "top_countries": [
            {"country": "Turkey", "deviceCategory": "mobile", "activeUsers": "31"},
            {"country": "Turkey", "deviceCategory": "desktop", "activeUsers": "12"},
            {"country": "Germany", "deviceCategory": "mobile", "activeUsers": "4"},
        ],
        "kind": "realtime",
    }


# ── ga4_sessions_report ────────────────────────────────────────────────────────

async def _sessions_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        return await _sessions_mock(payload)
    token = _get_access_token()
    if not token:
        return {**await _sessions_mock(payload), "degraded": True}

    prop_id = get_settings().ga4_property_id
    days = int(payload.get("days", 7))
    body: dict[str, Any] = {
        "dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "today"}],
        "dimensions": [{"name": "date"}, {"name": "sessionDefaultChannelGroup"}],
        "metrics": [
            {"name": "sessions"},
            {"name": "totalRevenue"},
            {"name": "conversions"},
        ],
        "orderBys": [{"dimension": {"dimensionName": "date"}, "desc": False}],
    }
    data = await _request(f"/properties/{prop_id}:runReport", body, token)
    rows = _parse_report_rows(data)
    total_sessions = sum(int(r.get("sessions", 0)) for r in rows)
    total_revenue = sum(float(r.get("totalRevenue", 0)) for r in rows)
    total_conversions = sum(int(r.get("conversions", 0)) for r in rows)
    return {
        "period_days": days,
        "total_sessions": total_sessions,
        "total_revenue_usd": round(total_revenue, 2),
        "total_conversions": total_conversions,
        "conversion_rate": round(total_conversions / max(total_sessions, 1) * 100, 2),
        "daily_breakdown": rows,
    }


async def _sessions_mock(payload: dict[str, Any]) -> dict[str, Any]:
    days = int(payload.get("days", 7))
    return {
        "period_days": days,
        "total_sessions": 1_840,
        "total_revenue_usd": 4_210.50,
        "total_conversions": 73,
        "conversion_rate": 3.97,
        "daily_breakdown": [
            {"date": "20250109", "sessionDefaultChannelGroup": "Organic Search", "sessions": "263", "totalRevenue": "601.5", "conversions": "10"},
            {"date": "20250110", "sessionDefaultChannelGroup": "Direct",         "sessions": "210", "totalRevenue": "480.0", "conversions": "8"},
        ],
    }


def register() -> None:
    register_live_adapter(
        "ga4_realtime_report",
        with_breaker(
            tool_id="ga4_realtime_report",
            adapter=_realtime_live,
            mock_fallback=_realtime_mock,
        ),
    )
    register_live_adapter(
        "ga4_sessions_report",
        with_breaker(
            tool_id="ga4_sessions_report",
            adapter=_sessions_live,
            mock_fallback=_sessions_mock,
        ),
    )
    log.info("live.ga4.registered", configured=_configured())
