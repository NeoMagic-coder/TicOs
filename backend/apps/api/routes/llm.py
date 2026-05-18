"""LLM metadata endpoints: which providers are available + suggested models."""
from __future__ import annotations

import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from apps.api.core.config import get_settings
from apps.api.models.schemas import LLMProviderInfo

router = APIRouter(prefix="/llm", tags=["llm"])

# In-memory cache for OpenRouter's /models endpoint. Refreshed every hour so
# new model releases show up without a backend restart.
_OR_CACHE: dict[str, Any] = {"at": 0.0, "models": []}
_OR_TTL_SECONDS = 3600.0


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
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-1.5-pro",
        ],
    },
    {
        "id": "openrouter",
        "label": "OpenRouter (300+ models)",
        "requires_base_url": False,
        "default_base_url": "https://openrouter.ai/api/v1",
        "default_model": "openai/gpt-4o-mini",
        "default_api_key_env": "OPENROUTER_API_KEY",
        "suggested_models": [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3.5-haiku",
            "anthropic/claude-3-opus",
            "google/gemini-2.5-flash",
            "meta-llama/llama-3.3-70b-instruct",
            "deepseek/deepseek-r1",
            "qwen/qwen-2.5-72b-instruct",
            "x-ai/grok-2-1212",
        ],
    },
    {
        "id": "openai_compatible",
        "label": "OpenAI-Uyumlu (özel endpoint)",
        "requires_base_url": True,
        "default_base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "default_api_key_env": "OPENAI_API_KEY",
        "suggested_models": [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "deepseek-chat",
            "llama3.1",  # ollama
            "qwen2.5:7b",  # ollama
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
        elif env_name == "OPENROUTER_API_KEY":
            present = bool(settings.openrouter_api_key)
        elif env_name:
            present = bool(os.environ.get(env_name, ""))
        else:
            present = p["id"] == "mock"
        out.append(LLMProviderInfo(api_key_present=present, **p))
    return out


@router.get("/openrouter/models")
async def list_openrouter_models(refresh: bool = False) -> dict[str, Any]:
    """Return the full OpenRouter model catalogue (cached 1h).

    Each entry is a thin projection of the upstream record:
    ``{id, name, context_length, pricing_prompt, pricing_completion}``.
    The UI uses this to populate the model autocomplete when the user
    picks the OpenRouter provider — no need to hardcode the 300+ ids.
    """
    now = time.time()
    if not refresh and _OR_CACHE["models"] and (now - _OR_CACHE["at"] < _OR_TTL_SECONDS):
        return {"models": _OR_CACHE["models"], "cached": True, "fetched_at": _OR_CACHE["at"]}

    settings = get_settings()
    headers: dict[str, str] = {"Accept": "application/json"}
    # API key is optional for the public /models listing but including it
    # avoids strict rate limits when an account is configured.
    if settings.openrouter_api_key:
        headers["Authorization"] = f"Bearer {settings.openrouter_api_key}"

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                f"{settings.openrouter_base_url.rstrip('/')}/models",
                headers=headers,
            )
            resp.raise_for_status()
            body = resp.json()
    except Exception as exc:
        # Don't break the UI — return the last good cache (possibly empty).
        return {
            "models": _OR_CACHE["models"],
            "cached": True,
            "fetched_at": _OR_CACHE["at"],
            "error": str(exc)[:200],
        }

    raw_list = body.get("data") if isinstance(body, dict) else body
    if not isinstance(raw_list, list):
        raise HTTPException(status_code=502, detail="unexpected OpenRouter response shape")

    models: list[dict[str, Any]] = []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        pricing = item.get("pricing") or {}
        models.append({
            "id": item.get("id") or "",
            "name": item.get("name") or item.get("id") or "",
            "context_length": item.get("context_length") or item.get("top_provider", {}).get("context_length"),
            "pricing_prompt": pricing.get("prompt"),
            "pricing_completion": pricing.get("completion"),
        })
    # Sort alphabetically by id so the UI list is stable.
    models.sort(key=lambda m: m["id"])

    _OR_CACHE["models"] = models
    _OR_CACHE["at"] = now
    return {"models": models, "cached": False, "fetched_at": now}
