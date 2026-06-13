"""Idempotent LLM config helpers run at boot."""
from __future__ import annotations

from datetime import UTC, datetime

from apps.api.agents.registry import get_agent_registry
from apps.api.core.config import get_settings
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentLLMConfigRow
from apps.api.core.logging import get_logger

log = get_logger(__name__)


def migrate_enabled_gemini_to_bedrock() -> None:
    """When global provider is Bedrock, rewrite enabled per-agent Gemini rows."""
    settings = get_settings()
    if (settings.llm_provider or "").lower() != "bedrock" or not settings.aws_bearer_token_bedrock:
        return

    now = datetime.now(UTC)
    updated = 0
    with session_scope() as s:
        for agent in get_agent_registry().all():
            row = (
                s.query(AgentLLMConfigRow)
                .filter(AgentLLMConfigRow.agent_id == agent.agent_id)
                .one_or_none()
            )
            if row is None or not row.enabled:
                continue
            if (row.provider or "").lower() != "gemini":
                continue
            row.provider = "bedrock"
            row.api_key_env = "AWS_BEARER_TOKEN_BEDROCK"
            if not row.model or row.model.startswith("gemini"):
                row.model = settings.bedrock_model
            row.base_url = row.base_url or settings.bedrock_base_url
            row.updated_at = now
            updated += 1
        s.flush()

    if updated:
        log.info("llm.seed.bedrock_migrated", count=updated)
