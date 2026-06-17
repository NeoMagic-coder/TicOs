"""LLM metadata endpoints: provider catalogue + browser completion proxy."""
from __future__ import annotations

import os

from fastapi import APIRouter

from apps.api.core.config import get_settings
from apps.api.core.llm.image import describe_image_provider
from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.models.schemas import LLMGenerateRequest, LLMGenerateResponse, LLMProviderInfo

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
    {
        "id": "bedrock",
        "label": "AWS Bedrock (Mantle)",
        "requires_base_url": True,
        "default_base_url": "https://bedrock-mantle.us-east-1.api.aws",
        "default_model": "openai.gpt-oss-120b",
        "default_api_key_env": "AWS_BEARER_TOKEN_BEDROCK",
        "suggested_models": [
            "openai.gpt-oss-120b",
            "deepseek.v3.2",
            "mistral.mistral-large-3-675b-instruct",
            "openai.gpt-oss-20b",
            "google.gemma-3-27b-it",
            "qwen.qwen3-32b",
            "minimax.minimax-m2.1",
            "moonshotai.kimi-k2.5",
        ],
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
        elif env_name == "AWS_BEARER_TOKEN_BEDROCK":
            present = bool(settings.aws_bearer_token_bedrock)
        elif env_name:
            present = bool(os.environ.get(env_name, ""))
        else:
            present = p["id"] == "mock"
        out.append(LLMProviderInfo(api_key_present=present, **p))
    return out


@router.get("/image-status")
async def image_status() -> dict:
    """Image pipeline readiness — Bedrock Runtime model access, fal, placeholder."""
    return describe_image_provider()


@router.post("/generate", response_model=LLMGenerateResponse)
async def generate_completion(body: LLMGenerateRequest) -> LLMGenerateResponse:
    """Server-side LLM proxy — replaces direct browser Gemini calls."""
    provider = get_llm_provider()
    messages: list[LLMMessage] = []
    for turn in body.history:
        role = "model" if turn.role == "assistant" else turn.role
        messages.append(LLMMessage(role=role, content=turn.content))
    messages.append(LLMMessage(role="user", content=body.user))

    system = body.system
    if body.json_mode and system and "json" not in system.lower():
        system = f"{system}\n\nYalnızca geçerli JSON üret; başka metin veya markdown yazma."

    resp = await provider.generate(
        system=system,
        messages=messages,
        max_tokens=body.max_output_tokens,
    )
    provider_name = type(provider).__name__.replace("Provider", "").lower()
    return LLMGenerateResponse(
        text=resp.text or "",
        error=resp.error,
        provider=provider_name,
        model=resp.model or getattr(provider, "model", ""),
        tokens_used=resp.tokens_used,
    )


