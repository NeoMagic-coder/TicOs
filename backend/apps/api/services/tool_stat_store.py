"""In-memory per-tool usage counters. Sibling of AgentStatStore but without
DB persistence — tool stats reset when the process restarts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock

from apps.api.models.schemas import ToolStats


@dataclass
class _Counter:
    total_calls: int = 0
    successes: int = 0
    total_duration_ms: float = 0.0
    total_cost_usd: float = 0.0
    last_called_at: datetime | None = None


class ToolStatStore:
    def __init__(self) -> None:
        self._by_tool: dict[str, _Counter] = {}
        self._lock = Lock()

    def record(
        self,
        tool_id: str,
        *,
        status: str,
        duration_ms: float,
        cost_usd: float = 0.0,
    ) -> None:
        with self._lock:
            c = self._by_tool.setdefault(tool_id, _Counter())
            c.total_calls += 1
            if status == "success":
                c.successes += 1
            c.total_duration_ms += duration_ms
            c.total_cost_usd += cost_usd
            c.last_called_at = datetime.now(UTC)

    def get_stats(self, tool_id: str) -> ToolStats:
        c = self._by_tool.get(tool_id)
        if c is None or c.total_calls == 0:
            return ToolStats()
        return ToolStats(
            total_calls=c.total_calls,
            success_rate=round(c.successes / c.total_calls, 3),
            avg_duration_ms=round(c.total_duration_ms / c.total_calls, 1),
            total_cost_usd=round(c.total_cost_usd, 4),
            last_called_at=c.last_called_at,
        )

    def all_stats(self) -> dict[str, ToolStats]:
        return {tool_id: self.get_stats(tool_id) for tool_id in self._by_tool}


_store: ToolStatStore | None = None


def get_tool_stat_store() -> ToolStatStore:
    global _store
    if _store is None:
        _store = ToolStatStore()
    return _store
