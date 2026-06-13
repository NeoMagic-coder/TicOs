"""Per-agent LLM provider resolution.

Each agent can override the global LLM provider through ``AgentLLMConfigRow``.
``get_llm_provider_for_agent(agent_id)`` returns the agent-specific provider
if an enabled row exists, otherwise falls back to ``get_llm_provider()``.

Providers are cached by configuration tuple so a typical request reuses the
same httpx client / google-genai client across agents pointing at the same
backend. Calling ``invalidate_cache()`` (or ``invalidate_agent(agent_id)``)
busts the cache after a config PUT.
"""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass

from apps.api.core.config import get_settings
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentLLMConfigRow
from apps.api.core.llm.provider import (
    BedrockProvider,
    GeminiProvider,
    LLMProvider,
    MockProvider,
    get_llm_provider,
)
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_lock = threading.RLock()
_provider_cache: dict[tuple[str, str, str, str], LLMProvider] = {}
_per_agent_cache: dict[str, LLMProvider] = {}


@dataclass(frozen=True)
class ResolvedProvider:
    provider_id: str
    model: str
    base_url: str
    api_key_env: str
    api_key_present: bool


def _build(cfg: AgentLLMConfigRow) -> LLMProvider | None:
    """Instantiate a provider from a config row. Returns None on bad config."""
    settings = get_settings()
    provider = (cfg.provider or "").lower().strip()

    # Resolve api key: explicit env var name wins; otherwise sensible defaults.
    if cfg.api_key_env:
        api_key = os.environ.get(cfg.api_key_env, "") or ""
    else:
        api_key = ""

    if provider == "gemini":
        key = api_key or settings.gemini_api_key
        if not key:
            log.warning("per_agent.gemini.no_key", agent=cfg.agent_id)
            return None
        return GeminiProvider(
            key,
            cfg.model or settings.gemini_model,
            fallback_models=settings.gemini_fallback_models,
            max_concurrency=settings.llm_max_concurrency,
        )

    if provider == "bedrock":
        token = api_key or settings.aws_bearer_token_bedrock
        if not token:
            log.warning("per_agent.bedrock.no_token", agent=cfg.agent_id)
            return None
        return BedrockProvider(
            bearer_token=token,
            model=cfg.model or settings.bedrock_model,
            fallback_models=settings.bedrock_fallback_models,
            base_url=settings.bedrock_base_url,
            max_concurrency=settings.llm_max_concurrency,
        )

    if provider == "mock":
        return MockProvider()

    log.warning("per_agent.unknown_provider", agent=cfg.agent_id, provider=provider)
    return None


def get_llm_provider_for_agent(agent_id: str) -> LLMProvider:
    """Return the provider configured for ``agent_id``, else the global default.

    Cached per agent. Call :func:`invalidate_agent` after a config update.
    """
    with _lock:
        cached = _per_agent_cache.get(agent_id)
    if cached is not None:
        return cached

    cfg: AgentLLMConfigRow | None = None
    try:
        with session_scope() as s:
            cfg = s.query(AgentLLMConfigRow).filter(AgentLLMConfigRow.agent_id == agent_id).one_or_none()
            if cfg is not None and cfg.enabled:
                # Detach via copy so we can release the session.
                cfg = AgentLLMConfigRow(
                    agent_id=cfg.agent_id,
                    provider=cfg.provider,
                    model=cfg.model,
                    base_url=cfg.base_url,
                    api_key_env=cfg.api_key_env,
                    temperature=cfg.temperature,
                    max_tokens=cfg.max_tokens,
                    enabled=cfg.enabled,
                )
            else:
                cfg = None
    except Exception as exc:
        # DB unavailable during a test bootstrap: degrade to global default.
        log.debug("per_agent.db_unavailable", agent=agent_id, error=str(exc))
        cfg = None

    if cfg is None:
        provider = get_llm_provider()
    else:
        # Try to reuse a provider already built for the same tuple.
        cache_key = (cfg.provider, cfg.model, cfg.base_url, cfg.api_key_env)
        with _lock:
            existing = _provider_cache.get(cache_key)
        if existing is not None:
            provider = existing
        else:
            built = _build(cfg)
            if built is None:
                log.info("per_agent.fallback_global", agent=agent_id, provider=cfg.provider)
                provider = get_llm_provider()
            else:
                provider = built
                with _lock:
                    _provider_cache[cache_key] = provider

    with _lock:
        _per_agent_cache[agent_id] = provider
    return provider


def invalidate_agent(agent_id: str) -> None:
    """Drop the cached provider for one agent. Next call rebuilds."""
    with _lock:
        _per_agent_cache.pop(agent_id, None)


def invalidate_cache() -> None:
    """Drop *all* cached providers. Use sparingly (e.g. env var rotation)."""
    with _lock:
        _per_agent_cache.clear()
        _provider_cache.clear()


def describe_for_agent(agent_id: str) -> ResolvedProvider:
    """Return what *would* be used for ``agent_id`` right now (read-only)."""
    settings = get_settings()
    with session_scope() as s:
        cfg = s.query(AgentLLMConfigRow).filter(AgentLLMConfigRow.agent_id == agent_id).one_or_none()
        if cfg is not None and cfg.enabled:
            key_env = cfg.api_key_env or ""
            if key_env == "GEMINI_API_KEY":
                api_key_present = bool(settings.gemini_api_key)
            elif key_env == "AWS_BEARER_TOKEN_BEDROCK":
                api_key_present = bool(settings.aws_bearer_token_bedrock)
            elif key_env:
                api_key_present = bool(os.environ.get(key_env, ""))
            else:
                api_key_present = False
            return ResolvedProvider(
                provider_id=cfg.provider,
                model=cfg.model or "",
                base_url=cfg.base_url or "",
                api_key_env=key_env,
                api_key_present=api_key_present,
            )
    # Fall back to global resolution
    if (settings.llm_provider or "").lower() == "bedrock" or (not settings.llm_provider and settings.aws_bearer_token_bedrock):
        return ResolvedProvider("bedrock", settings.bedrock_model, settings.bedrock_base_url, "AWS_BEARER_TOKEN_BEDROCK", bool(settings.aws_bearer_token_bedrock))
    if (settings.llm_provider or "").lower() == "gemini" or (not settings.llm_provider and settings.gemini_api_key):
        return ResolvedProvider("gemini", settings.gemini_model, "", "GEMINI_API_KEY", bool(settings.gemini_api_key))
    return ResolvedProvider("mock", "mock", "", "", False)
