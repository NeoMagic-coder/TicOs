"""Autonomous scheduler — runs periodic agent jobs on a cron-like schedule.

Backed by APScheduler's `AsyncIOScheduler` so it shares the FastAPI event
loop without spawning a separate process.

Jobs come from two sources:
1. **Built-in** static jobs hardcoded below (ops sweep, pricing, reviews).
2. **User-defined** jobs loaded from ``ScheduledJobRow`` at startup and
   managed via the ``/api/v1/scheduler`` CRUD endpoints.

Natural-language schedule descriptions ("Her pazartesi sabah 9'da") are
converted to cron expressions by the LLM provider when a job is created.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import ScheduledJobRow
from apps.api.core.hermes.orchestrator import HermesOrchestrator
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None
_orchestrator: HermesOrchestrator | None = None
_last_runs: dict[str, dict[str, Any]] = {}

# ──────────────────────────────────────────────
# Built-in job definitions
# ──────────────────────────────────────────────
_BUILTIN_JOBS: list[dict[str, Any]] = [
    {
        "id": "ops.hourly_sweep",
        "trigger": IntervalTrigger(hours=1),
        "kwargs": {
            "job_id": "ops.hourly_sweep",
            "prompt": (
                "Operations Agent: son 1 saatte değişen sipariş ve stok "
                "durumunu özetle. Reorder gereken SKU varsa ⚠️ ile işaretle."
            ),
            "agent_hint": "operations_agent",
        },
        "next_run_time": None,  # don't fire immediately on boot
    },
    {
        "id": "pricing.daily_review",
        "trigger": CronTrigger(hour=9, minute=0),
        "kwargs": {
            "job_id": "pricing.daily_review",
            "prompt": (
                "Dynamic Pricing Agent: dün için rakip fiyat, talep ve stok "
                "sinyallerinden hareketle fiyat ayarı önerisi ver. %5 üstü "
                "değişimi ⚠️ ile insan onayına işaretle."
            ),
            "agent_hint": "dynamic_pricing_agent",
        },
    },
    {
        "id": "reviews.daily_sweep",
        "trigger": CronTrigger(hour=18, minute=0),
        "kwargs": {
            "job_id": "reviews.daily_sweep",
            "prompt": (
                "Review & Reputation Agent: bugün gelen yorumları sınıflandır; "
                "negatif olanlar için empatik taslak yanıt üret."
            ),
            "agent_hint": "review_reputation_agent",
        },
    },
]


# ──────────────────────────────────────────────
# Job runner
# ──────────────────────────────────────────────

async def _run_agent_job(job_id: str, prompt: str, agent_hint: str | None) -> None:
    """Execute a single scheduled prompt through Hermes."""
    started = datetime.now(UTC)
    log.info("scheduler.job.start", job_id=job_id, agent=agent_hint)
    assert _orchestrator is not None
    status = "ok"
    try:
        result = await _orchestrator.handle(
            message=prompt,
            history=[],
            product_context={"source": "scheduler", "job_id": job_id},
        )
        _last_runs[job_id] = {
            "started_at": started.isoformat(),
            "finished_at": datetime.now(UTC).isoformat(),
            "status": "ok",
            "tools_used": len(result.tools_used or []),
            "summary": (result.summary or "")[:200],
        }
        log.info("scheduler.job.ok", job_id=job_id, summary=_last_runs[job_id]["summary"])
    except Exception as exc:
        status = "error"
        _last_runs[job_id] = {
            "started_at": started.isoformat(),
            "finished_at": datetime.now(UTC).isoformat(),
            "status": "failed",
            "error": str(exc)[:240],
        }
        log.warning("scheduler.job.failed", job_id=job_id, error=str(exc)[:200])

    # Persist last_run state for user-defined jobs
    _persist_job_run(job_id, status=status)


def _persist_job_run(job_id: str, *, status: str) -> None:
    try:
        with session_scope() as db:
            row = db.get(ScheduledJobRow, job_id)
            if row:
                row.last_run_at = datetime.now(UTC)
                row.last_status = status
                if _scheduler:
                    apsjob = _scheduler.get_job(job_id)
                    if apsjob and apsjob.next_run_time:
                        row.next_run_at = apsjob.next_run_time
    except Exception as exc:
        log.warning("scheduler.persist_run_failed", job_id=job_id, error=str(exc)[:120])


# ──────────────────────────────────────────────
# NL → cron conversion
# ──────────────────────────────────────────────

_NL_TO_CRON_PROMPT = """\
Convert the following Turkish schedule description to a standard 5-field cron expression.
Return ONLY the cron string (e.g. "0 9 * * 1"), nothing else.
If the input is already a cron expression, return it unchanged.
Input: {description}
"""


async def parse_schedule(description: str) -> str:
    """Convert a natural-language schedule to a cron expression.

    Fast path: local Turkish keyword parser (no LLM call).
    Slow path: LLM generation for complex phrases.
    Returns the cron string, or raises ValueError.
    """
    import re as _re
    from apps.api.core.scheduler_nl import nl_to_cron

    candidate = nl_to_cron(description)
    # Accept if it looks like a valid cron expression (5 fields)
    parts = candidate.strip().split()
    if len(parts) == 5:
        valid = all(
            _re.fullmatch(r"[\d\*/,\-]+", p) for p in parts
        )
        if valid:
            return candidate

    # Fall back to LLM for phrases the local parser didn't recognise
    from apps.api.core.llm.provider import LLMMessage, get_llm_provider
    llm = get_llm_provider()
    resp = await llm.generate(
        system="You convert Turkish scheduling phrases to cron expressions. Reply with ONLY the 5-field cron string.",
        messages=[LLMMessage(role="user", content=_NL_TO_CRON_PROMPT.format(description=description))],
        temperature=0.0,
        max_tokens=32,
    )
    cron = (resp.text or "").strip().strip('"').strip("'")
    if not cron:
        raise ValueError(f"LLM could not convert schedule: {description!r}")
    return cron


# ──────────────────────────────────────────────
# Lifecycle
# ──────────────────────────────────────────────

def _register_user_job(row: ScheduledJobRow) -> None:
    assert _scheduler is not None
    try:
        parts = row.schedule_expr.split()
        if len(parts) == 5:
            trigger = CronTrigger.from_crontab(row.schedule_expr)
        else:
            trigger = CronTrigger(hour=9, minute=0)  # fallback
        _scheduler.add_job(
            _run_agent_job,
            trigger,
            id=row.id,
            kwargs={"job_id": row.id, "prompt": row.prompt, "agent_hint": row.agent_hint},
            replace_existing=True,
        )
        log.info("scheduler.user_job.registered", job_id=row.id, cron=row.schedule_expr)
    except Exception as exc:
        log.warning("scheduler.user_job.register_failed", job_id=row.id, error=str(exc)[:200])


def start_scheduler(orchestrator: HermesOrchestrator) -> AsyncIOScheduler:
    """Start the scheduler. Idempotent."""
    global _scheduler, _orchestrator
    if _scheduler is not None:
        return _scheduler
    _orchestrator = orchestrator
    _scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")

    # Register built-in jobs
    for spec in _BUILTIN_JOBS:
        kw: dict[str, Any] = {"replace_existing": True}
        if "next_run_time" in spec:
            kw["next_run_time"] = spec["next_run_time"]
        _scheduler.add_job(_run_agent_job, spec["trigger"], id=spec["id"], kwargs=spec["kwargs"], **kw)

    # Load user-defined jobs from DB
    try:
        with session_scope() as db:
            rows = db.execute(select(ScheduledJobRow).where(ScheduledJobRow.enabled == True)).scalars().all()  # noqa: E712
        for row in rows:
            _register_user_job(row)
    except Exception as exc:
        log.warning("scheduler.db_load_failed", error=str(exc)[:200])

    _scheduler.start()
    log.info("scheduler.started", jobs=[j.id for j in _scheduler.get_jobs()])
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


# ──────────────────────────────────────────────
# Status & control
# ──────────────────────────────────────────────

def scheduler_status() -> dict[str, Any]:
    if _scheduler is None:
        return {"running": False, "jobs": []}
    return {
        "running": _scheduler.running,
        "jobs": [
            {
                "id": j.id,
                "next_run_time": j.next_run_time.isoformat() if j.next_run_time else None,
                "trigger": str(j.trigger),
                "last_run": _last_runs.get(j.id),
            }
            for j in _scheduler.get_jobs()
        ],
    }


async def trigger_job_now(job_id: str) -> dict[str, Any]:
    """Manually fire a scheduled job."""
    if _scheduler is None:
        return {"ok": False, "reason": "scheduler not started"}
    job = _scheduler.get_job(job_id)
    if not job:
        return {"ok": False, "reason": f"job '{job_id}' not found"}
    job.modify(next_run_time=datetime.now(UTC))
    return {"ok": True, "job_id": job_id}


async def create_job(
    *,
    name: str,
    prompt: str,
    schedule_description: str,
    agent_hint: str | None = None,
    delivery_platform: str = "web",
    delivery_target: str = "",
) -> ScheduledJobRow:
    """Create a new user-defined job. Parses the schedule description with LLM."""
    cron_expr = await parse_schedule(schedule_description)
    job_id = f"job_{uuid.uuid4().hex[:10]}"
    now = datetime.now(UTC)
    row = ScheduledJobRow(
        id=job_id,
        name=name,
        prompt=prompt,
        schedule_expr=cron_expr,
        agent_hint=agent_hint,
        delivery_platform=delivery_platform,
        delivery_target=delivery_target,
        enabled=True,
        last_status="never",
        created_at=now,
    )
    with session_scope() as db:
        db.add(row)
    if _scheduler is not None:
        _register_user_job(row)
        apsjob = _scheduler.get_job(job_id)
        if apsjob and apsjob.next_run_time:
            row.next_run_at = apsjob.next_run_time
    log.info("scheduler.job.created", job_id=job_id, cron=cron_expr)
    return row


def delete_job(job_id: str) -> bool:
    """Remove a user-defined job from APScheduler and DB."""
    if _scheduler is not None:
        try:
            _scheduler.remove_job(job_id)
        except Exception:
            pass
    try:
        with session_scope() as db:
            row = db.get(ScheduledJobRow, job_id)
            if row:
                db.delete(row)
                return True
    except Exception as exc:
        log.warning("scheduler.job.delete_failed", job_id=job_id, error=str(exc)[:120])
    return False


def toggle_job(job_id: str, *, enabled: bool) -> bool:
    """Enable or pause a user-defined job."""
    try:
        with session_scope() as db:
            row = db.get(ScheduledJobRow, job_id)
            if not row:
                return False
            row.enabled = enabled
        if _scheduler is not None:
            if enabled:
                _register_user_job(row)
            else:
                try:
                    _scheduler.remove_job(job_id)
                except Exception:
                    pass
        return True
    except Exception as exc:
        log.warning("scheduler.job.toggle_failed", job_id=job_id, error=str(exc)[:120])
        return False


def list_user_jobs() -> list[dict[str, Any]]:
    """Return all user-defined jobs with live APScheduler state."""
    try:
        with session_scope() as db:
            rows = db.execute(select(ScheduledJobRow).order_by(ScheduledJobRow.created_at.asc())).scalars().all()
    except Exception:
        return []
    result = []
    for row in rows:
        aps_next = None
        if _scheduler:
            apsjob = _scheduler.get_job(row.id)
            if apsjob and apsjob.next_run_time:
                aps_next = apsjob.next_run_time.isoformat()
        result.append({
            "id": row.id,
            "name": row.name,
            "prompt": row.prompt,
            "schedule_expr": row.schedule_expr,
            "agent_hint": row.agent_hint,
            "delivery_platform": row.delivery_platform,
            "delivery_target": row.delivery_target,
            "enabled": row.enabled,
            "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
            "next_run_at": aps_next or (row.next_run_at.isoformat() if row.next_run_at else None),
            "last_status": row.last_status,
            "created_at": row.created_at.isoformat(),
            "last_run": _last_runs.get(row.id),
        })
    return result
