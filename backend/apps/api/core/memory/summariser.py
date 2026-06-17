"""Post-task session summariser.

After a task completes, collects all MemoryRows with a matching task_id and
asks the LLM to produce a compact Turkish summary stored as a new
'session_summary' row. Fire-and-forget; never raises.
"""
from __future__ import annotations

from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import MemoryRow
from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.core.memory.store import add_memory

log = get_logger(__name__)

_SUMMARISE_PROMPT = (
    "Aşağıdaki görev konuşmasını Türkçe olarak 2-3 cümleyle özetle. "
    "Sadece özet yaz, başka hiçbir şey ekleme.\n\n"
    "Konuşma:\n{text}"
)


async def summarise_session(task_id: str) -> str | None:
    """Summarise all memory rows for *task_id* and store the result.

    Returns the summary text on success, None on error.
    """
    try:
        with session_scope() as db:
            rows = db.execute(
                select(MemoryRow)
                .where(MemoryRow.task_id == task_id)
                .where(MemoryRow.kind.in_(["user_message", "agent_output"]))
                .order_by(MemoryRow.created_at.asc())
                .limit(30)
            ).scalars().all()

        if not rows:
            return None

        combined = "\n\n".join(f"[{r.kind}] {r.text[:500]}" for r in rows)
        prompt = _SUMMARISE_PROMPT.format(text=combined[:4000])

        llm = get_llm_provider()
        response = await llm.complete([LLMMessage(role="user", content=prompt)])
        summary = (response.content or "").strip()
        if not summary:
            return None

        await add_memory(
            text=summary,
            kind="session_summary",
            task_id=task_id,
            metadata={"source_rows": len(rows)},
        )
        log.info("memory.session_summarised", task_id=task_id, length=len(summary))
        return summary

    except Exception as exc:
        log.warning("memory.summarise_failed", task_id=task_id, error=str(exc)[:200])
        return None
