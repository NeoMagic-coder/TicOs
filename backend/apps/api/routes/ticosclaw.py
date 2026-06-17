"""Unified public identity and capability catalog for TicOSClaw."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

router = APIRouter(prefix="/ticosclaw", tags=["ticosclaw"])


@router.get("")
async def ticosclaw_identity() -> dict[str, Any]:
    """Describe the capabilities exposed by the unified backend."""
    return {
        "name": "TicOSClaw",
        "status": "unified",
        "capabilities": {
            "orchestration": {
                "description": "Coklu ajan planlama, yonlendirme ve sonuc birlestirme",
                "entrypoint": "/api/v1/ticosclaw/chat",
            },
            "tool_execution": {
                "description": "Izin kontrollu arac calistirma ve audit kaydi",
                "entrypoint": "/api/v1/ticosclaw/tools/execute",
            },
            "commerce_operations": {
                "description": "Urun, stok, siparis ve musteri operasyonlari",
                "entrypoint": "/api/v1/ticosclaw/tic/dashboard",
            },
            "shopping_comparison": {
                "description": "Web aramasi, pazar yeri tarama, teklif skorlama ve urun onerisi",
                "entrypoint": "/api/v1/ticosclaw/shopping/runs/sync",
                "features": ["web_search", "collectapi_marketplaces", "offer_scoring"],
            },
        },
    }
