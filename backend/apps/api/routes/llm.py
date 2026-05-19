"""LLM metadata endpoints: which providers are available + suggested models."""
from __future__ import annotations

import os

from fastapi import APIRouter

from apps.api.core.config import get_settings
from apps.api.models.schemas import LLMProviderInfo

router = APIRouter(prefix="/llm", tags=["llm"])


# Static catalogue of supported providers. ``suggested_models`` is purely a
# UI hint — users can type any model id supported by the provider.
_PROVIDERS: list[dict] = [
    {
        "id": "gemini",
        "label": "Google Gemini",
        "requires_base_url": False,
        "default_base_url": "",
        "default_model": "gemini-2.5-flash",
        "default_api_key_env": "GEMINI_API_KEY",
        "suggested_models": [
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ],
    },
    {
        "id": "mock",
        "label": "Mock (Test)",
        "requires_base_url": False,
        "default_base_url": "",
        "default_model": "mock",
        "default_api_key_env": "",
        "suggested_models": [],
    },
]


@router.get("/providers", response_model=list[LLMProviderInfo])
async def list_providers() -> list[LLMProviderInfo]:
    """Return the static catalogue with each provider's api-key-presence flag.

    The ``api_key_present`` field reads the *default* env var so the UI can
    show a green/red dot before the user starts typing. Custom env var names
    set per agent are checked separately in :func:`agents.get_agent_llm_config`.
    """
    settings = get_settings()
    out: list[LLMProviderInfo] = []
    for p in _PROVIDERS:
        env_name = p["default_api_key_env"]
        if env_name == "GEMINI_API_KEY":
            present = bool(settings.gemini_api_key)
        elif env_name:
            present = bool(os.environ.get(env_name, ""))
        else:
            present = p["id"] == "mock"
        out.append(LLMProviderInfo(api_key_present=present, **p))
    return out


