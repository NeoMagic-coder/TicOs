"""Cost budget tracker — two scopes.

1. **Per-product daily** (in-process counters, ``settings.daily_budget_max_usd``):
   keyed by (product_name, UTC date). Survives the process lifetime; resets
   when the API restarts. Used by the chat endpoint to short-circuit new
   tasks. ``0`` disables enforcement.

2. **Per-agent monthly** (Paperclip-style, DB-backed via ``AgentBudgetRow``):
   keyed by (agent_id, "YYYY-MM"). Persisted so caps survive restarts and
   can be edited from the UI. The orchestrator checks ``is_agent_exhausted``
   before each node and routes to ``escalated`` instead of running. A
   ``limit_usd`` of ``0`` disables enforcement for that agent/month.

For multi-replica deployments product-daily should move to Redis (PRODUCTION_PLAN
Wave 5); per-agent already uses Postgres-safe SQL so it scales out as-is."""
from __future__ import annotations

import threading
from datetime import UTC, date, datetime

from sqlalchemy import select

from apps.api.core.config import get_settings
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentBudgetRow

_lock = threading.Lock()
_spend: dict[tuple[str, str], float] = {}


def _key(product_name: str | None) -> tuple[str, str] | None:
    if not product_name:
        return None
    return (product_name, date.today().isoformat())


def record(product_name: str | None, cost_usd: float) -> None:
    """Add ``cost_usd`` to today's spend bucket for ``product_name``."""
    if cost_usd <= 0:
        return
    k = _key(product_name)
    if k is None:
        return
    with _lock:
        _spend[k] = _spend.get(k, 0.0) + float(cost_usd)


def remaining(product_name: str | None) -> float | None:
    """How many USD are left in today's budget. ``None`` means no limit (either
    ``daily_budget_max_usd`` is 0 or no product context)."""
    s = get_settings()
    if s.daily_budget_max_usd <= 0:
        return None
    k = _key(product_name)
    if k is None:
        return None
    with _lock:
        spent = _spend.get(k, 0.0)
    return max(0.0, float(s.daily_budget_max_usd) - spent)


def is_exhausted(product_name: str | None) -> bool:
    r = remaining(product_name)
    return r is not None and r <= 0.0


def snapshot() -> dict[str, dict[str, float]]:
    """Diagnostic peek — used by /api/v1/analytics/costs and tests."""
    out: dict[str, dict[str, float]] = {}
    with _lock:
        for (product, day), v in _spend.items():
            out.setdefault(product, {})[day] = v
    return out


# ---------------------------------------------------------------------------
# Per-agent monthly budget (Paperclip-style).
#
# Stored in ``agent_budgets`` (one row per (agent_id, month)). The orchestrator
# calls ``record_agent_spend`` after every node and ``is_agent_exhausted``
# before scheduling a node. Direct UPSERT-style logic keeps the helpers thin —
# the routes layer owns CRUD around the row.
# ---------------------------------------------------------------------------


def _current_month() -> str:
    return datetime.now(UTC).strftime("%Y-%m")


def get_or_create_agent_budget(agent_id: str, month: str | None = None) -> AgentBudgetRow:
    """Return the row for (agent_id, month), inserting an empty one if missing.

    NOT a context-manager — callers should wrap in their own ``session_scope``
    if they need to mutate or read inside a single transaction.
    """
    month = month or _current_month()
    with session_scope() as s:
        row = s.get(AgentBudgetRow, (agent_id, month))
        if row is None:
            row = AgentBudgetRow(agent_id=agent_id, month=month, limit_usd=0.0, spent_usd=0.0)
            s.add(row)
            s.flush()
        # Detach a copy so callers outside this scope can read attributes safely.
        s.expunge(row)
        return row


def record_agent_spend(agent_id: str, cost_usd: float, month: str | None = None) -> None:
    """Increment ``spent_usd`` for the agent. No-op when ``cost_usd <= 0``."""
    if cost_usd <= 0:
        return
    month = month or _current_month()
    with session_scope() as s:
        row = s.get(AgentBudgetRow, (agent_id, month))
        if row is None:
            row = AgentBudgetRow(
                agent_id=agent_id,
                month=month,
                limit_usd=0.0,
                spent_usd=float(cost_usd),
                last_spend_at=datetime.now(UTC),
            )
            s.add(row)
        else:
            row.spent_usd = (row.spent_usd or 0.0) + float(cost_usd)
            row.last_spend_at = datetime.now(UTC)


def remaining_agent_budget(agent_id: str, month: str | None = None) -> float | None:
    """USD remaining for the agent this month. ``None`` if no cap is set
    (``limit_usd == 0``); otherwise ``max(0, limit - spent)``."""
    month = month or _current_month()
    with session_scope() as s:
        row = s.get(AgentBudgetRow, (agent_id, month))
        if row is None or (row.limit_usd or 0.0) <= 0:
            return None
        return max(0.0, float(row.limit_usd) - float(row.spent_usd or 0.0))


def is_agent_exhausted(agent_id: str, month: str | None = None) -> bool:
    r = remaining_agent_budget(agent_id, month)
    return r is not None and r <= 0.0


def list_agent_budgets(month: str | None = None) -> list[AgentBudgetRow]:
    month = month or _current_month()
    with session_scope() as s:
        rows = s.execute(
            select(AgentBudgetRow).where(AgentBudgetRow.month == month)
        ).scalars().all()
        for r in rows:
            s.expunge(r)
        return list(rows)


def set_agent_budget(
    agent_id: str,
    *,
    limit_usd: float,
    warn_threshold_pct: int = 80,
    month: str | None = None,
) -> AgentBudgetRow:
    """Insert or update the agent's monthly cap. Returns the (detached) row."""
    month = month or _current_month()
    with session_scope() as s:
        row = s.get(AgentBudgetRow, (agent_id, month))
        if row is None:
            row = AgentBudgetRow(
                agent_id=agent_id,
                month=month,
                limit_usd=float(limit_usd),
                spent_usd=0.0,
                warn_threshold_pct=int(warn_threshold_pct),
            )
            s.add(row)
        else:
            row.limit_usd = float(limit_usd)
            row.warn_threshold_pct = int(warn_threshold_pct)
        s.flush()
        s.expunge(row)
        return row
