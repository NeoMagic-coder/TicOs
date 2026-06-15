"""Dolap REST endpoints for the TicOSClaw UI."""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from apps.api.core.dolap.client import DolapClient, dolap_configured

router = APIRouter(prefix="/dolap", tags=["dolap"])

_client = DolapClient()
_PROBE_TIMEOUT_S = 12.0


@router.get("/status")
async def dolap_status() -> dict[str, Any]:
    if not dolap_configured():
        return {
            "configured": False,
            "connected": False,
            "mode": "stub",
            "notes": "DOLAP_ACCESS_TOKEN veya DOLAP_USERNAME + DOLAP_PASSWORD gerekli.",
        }
    try:
        probe = await asyncio.wait_for(_client.probe(), timeout=_PROBE_TIMEOUT_S)
        return {
            "configured": True,
            "connected": True,
            "mode": "live",
            "nickname": probe.get("nickname"),
            "member_id": probe.get("member_id"),
            "follower_count": probe.get("follower_count"),
        }
    except Exception as exc:
        return {
            "configured": True,
            "connected": False,
            "mode": "error",
            "notes": str(exc)[:300],
        }


@router.get("/products")
async def dolap_products(
    nickname: str | None = Query(None, max_length=80),
    max_pages: int = Query(20, ge=1, le=50),
) -> dict[str, Any]:
    if not dolap_configured():
        raise HTTPException(
            status_code=503,
            detail="Dolap not configured. Set DOLAP_ACCESS_TOKEN or DOLAP_USERNAME + DOLAP_PASSWORD in .env.local",
        )
    try:
        return await _client.get_products(nickname, max_pages=max_pages)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)[:300]) from exc


@router.get("/profile")
async def dolap_profile(nickname: str | None = Query(None, max_length=80)) -> dict[str, Any]:
    if not dolap_configured():
        raise HTTPException(status_code=503, detail="Dolap not configured")
    try:
        return await _client.get_profile(nickname)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)[:300]) from exc
