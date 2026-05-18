from __future__ import annotations

import os
import time
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from apps.api.agents.registry import get_agent_registry
from apps.api.core.budget import (
    get_or_create_agent_budget,
    list_agent_budgets,
    set_agent_budget,
)
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentLLMConfigRow
from apps.api.core.llm.per_agent import (
    get_llm_provider_for_agent,
    invalidate_agent,
)
from apps.api.core.llm.provider import LLMMessage
from apps.api.models.schemas import (
    AgentBudget,
    AgentBudgetUpdate,
    AgentLLMConfig,
    AgentLLMConfigUpdate,
    AgentSpec,
    LLMTestRequest,
    LLMTestResponse,
)
from apps.api.services.task_store import get_agent_stat_store

router = APIRouter(prefix="/agents", tags=["agents"])


def _row_to_budget(row) -> AgentBudget:
    limit = float(row.limit_usd or 0.0)
    spent = float(row.spent_usd or 0.0)
    remaining = max(0.0, limit - spent) if limit > 0 else 0.0
    pct = (spent / limit * 100.0) if limit > 0 else 0.0
    return AgentBudget(
        agent_id=row.agent_id,
        month=row.month,
        limit_usd=round(limit, 6),
        spent_usd=round(spent, 6),
        warn_threshold_pct=int(row.warn_threshold_pct or 80),
        remaining_usd=round(remaining, 6),
        pct_used=round(pct, 2),
        exhausted=limit > 0 and remaining <= 0.0,
        last_spend_at=row.last_spend_at,
    )


@router.get("", response_model=list[AgentSpec])
async def list_agents() -> list[AgentSpec]:
    specs = get_agent_registry().specs()
    stats_map = get_agent_stat_store().all_stats()
    return [
        spec.model_copy(update={"stats": stats_map[spec.agent_id]})
        if spec.agent_id in stats_map
        else spec
        for spec in specs
    ]


@router.get("/budgets", response_model=list[AgentBudget])
async def list_budgets(month: str | None = None) -> list[AgentBudget]:
    """Return every per-agent budget envelope for the given month
    (default: current UTC month). Unset agents are omitted; the UI lazily
    asks for individual ones via ``GET /agents/{id}/budget``."""
    return [_row_to_budget(r) for r in list_agent_budgets(month=month)]


@router.get("/llm-configs", response_model=list[AgentLLMConfig])
async def list_llm_configs_top() -> list[AgentLLMConfig]:
    """Same payload as ``/llm-configs`` defined below; declared up here so
    FastAPI matches it before the ``/{agent_id}`` dynamic segment."""
    with session_scope() as s:
        rows = s.query(AgentLLMConfigRow).all()
        return [_row_to_llm_config(r) for r in rows]


@router.get("/{agent_id}", response_model=AgentSpec)
async def get_agent(agent_id: str) -> AgentSpec:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    return agent.spec.model_copy(update={"stats": get_agent_stat_store().get_stats(agent_id)})


@router.get("/{agent_id}/budget", response_model=AgentBudget)
async def get_agent_budget(agent_id: str, month: str | None = None) -> AgentBudget:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    row = get_or_create_agent_budget(agent_id, month=month)
    return _row_to_budget(row)


@router.put("/{agent_id}/budget", response_model=AgentBudget)
async def update_agent_budget(
    agent_id: str, payload: AgentBudgetUpdate, month: str | None = None,
) -> AgentBudget:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    row = set_agent_budget(
        agent_id,
        limit_usd=payload.limit_usd,
        warn_threshold_pct=payload.warn_threshold_pct,
        month=month,
    )
    return _row_to_budget(row)


# ----------------------------------------------------------------------------
# Per-agent LLM model configuration
# ----------------------------------------------------------------------------


def _row_to_llm_config(row: AgentLLMConfigRow) -> AgentLLMConfig:
    from apps.api.core.config import get_settings
    settings = get_settings()
    env_name = (row.api_key_env or "").strip()
    if env_name == "GEMINI_API_KEY":
        api_key_present = bool(settings.gemini_api_key)
    elif env_name == "OPENROUTER_API_KEY":
        api_key_present = bool(settings.openrouter_api_key)
    elif env_name:
        api_key_present = bool(os.environ.get(env_name, ""))
    else:
        api_key_present = False
    return AgentLLMConfig(
        agent_id=row.agent_id,
        provider=row.provider or "openrouter",  # type: ignore[arg-type]
        model=row.model or "",
        base_url=row.base_url or "",
        api_key_env=row.api_key_env or "",
        temperature=float(row.temperature or 0.7),
        max_tokens=int(row.max_tokens or 1500),
        enabled=bool(row.enabled),
        api_key_present=api_key_present,
        updated_at=row.updated_at,
    )


def _empty_llm_config(agent_id: str) -> AgentLLMConfig:
    """Default response shape for agents that have never been configured."""
    return AgentLLMConfig(agent_id=agent_id)


@router.get("/{agent_id}/llm-config", response_model=AgentLLMConfig)
async def get_agent_llm_config(agent_id: str) -> AgentLLMConfig:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    with session_scope() as s:
        row = s.query(AgentLLMConfigRow).filter(AgentLLMConfigRow.agent_id == agent_id).one_or_none()
        if row is not None:
            return _row_to_llm_config(row)
    return _empty_llm_config(agent_id)


@router.put("/{agent_id}/llm-config", response_model=AgentLLMConfig)
async def put_agent_llm_config(agent_id: str, payload: AgentLLMConfigUpdate) -> AgentLLMConfig:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    now = datetime.now(UTC)
    with session_scope() as s:
        row = s.query(AgentLLMConfigRow).filter(AgentLLMConfigRow.agent_id == agent_id).one_or_none()
        if row is None:
            row = AgentLLMConfigRow(agent_id=agent_id, created_at=now)
            s.add(row)
        row.provider = payload.provider
        row.model = payload.model
        row.base_url = payload.base_url
        row.api_key_env = payload.api_key_env
        row.temperature = float(payload.temperature)
        row.max_tokens = int(payload.max_tokens)
        row.enabled = bool(payload.enabled)
        row.updated_at = now
        s.flush()
        result = _row_to_llm_config(row)
    invalidate_agent(agent_id)
    return result


@router.post("/{agent_id}/llm-config/test", response_model=LLMTestResponse)
async def test_agent_llm_config(agent_id: str, payload: LLMTestRequest) -> LLMTestResponse:
    """Fire a small live call against the agent's currently-configured provider.

    Useful for the UI to confirm a freshly-saved config actually works before
    handing it to the orchestrator. Token usage is capped low.
    """
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    provider = get_llm_provider_for_agent(agent_id)
    started = time.monotonic()
    try:
        resp = await provider.generate(
            system="Bu bir sağlık testidir. Tek satır cevap ver.",
            messages=[LLMMessage(role="user", content=payload.prompt)],
            temperature=0.0,
            max_tokens=payload.max_tokens,
        )
    except Exception as exc:
        return LLMTestResponse(
            ok=False,
            provider=type(provider).__name__,
            model=getattr(provider, "model", "?"),
            text="",
            duration_ms=int((time.monotonic() - started) * 1000),
            error=str(exc)[:300],
        )
    duration_ms = int((time.monotonic() - started) * 1000)
    return LLMTestResponse(
        ok=not resp.error and bool((resp.text or "").strip()),
        provider=type(provider).__name__,
        model=resp.model or getattr(provider, "model", "?"),
        text=(resp.text or "")[:400],
        tokens_used=resp.tokens_used,
        duration_ms=duration_ms,
        error=resp.error,
    )
