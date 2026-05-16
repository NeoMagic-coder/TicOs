"""Autonomous scheduler — runs periodic agent jobs on a cron-like schedule.

Backed by APScheduler's `AsyncIOScheduler` so it shares the FastAPI event
loop without spawning a separate process. Jobs are intentionally narrow:
each one builds a small Hermes prompt and runs it through the existing
orchestrator. State changes (approvals, audit logs) happen through the
same channels as user-triggered chats.

This is the missing piece between "agents that exist on paper" and "agents
that actually do work on a clock".
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from apps.api.core.hermes.orchestrator import HermesOrchestrator
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None
_orchestrator: HermesOrchestrator | None = None
_last_runs: dict[str, dict[str, Any]] = {}


async def _run_agent_job(job_id: str, prompt: str, agent_hint: str | None) -> None:
    """Execute a single scheduled prompt through Hermes."""
    started = datetime.now(UTC)
    log.info("scheduler.job.start", job_id=job_id, agent=agent_hint)
    assert _orchestrator is not None
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
    except Exception as exc:  # noqa: BLE001 — surface every failure to telemetry
        _last_runs[job_id] = {
            "started_at": started.isoformat(),
            "finished_at": datetime.now(UTC).isoformat(),
            "status": "failed",
            "error": str(exc)[:240],
        }
        log.warning("scheduler.job.failed", job_id=job_id, error=str(exc)[:200])


def start_scheduler(orchestrator: HermesOrchestrator) -> AsyncIOScheduler:
    """Start the scheduler with the default job set. Idempotent — calling
    twice returns the same scheduler instance.
    """
    global _scheduler, _orchestrator
    if _scheduler is not None:
        return _scheduler
    _orchestrator = orchestrator
    _scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")

    # Hourly: light operational sweep — open orders + critical stock.
    _scheduler.add_job(
        _run_agent_job,
        IntervalTrigger(hours=1),
        id="ops.hourly_sweep",
        kwargs={
            "job_id": "ops.hourly_sweep",
            "prompt": (
                "Operations Agent: son 1 saatte değişen sipariş ve stok "
                "durumunu özetle. Reorder gereken SKU varsa ⚠️ ile işaretle."
            ),
            "agent_hint": "operations_agent",
        },
        replace_existing=True,
        next_run_time=None,   # don't fire immediately on boot
    )

    # Daily at 09:00: pricing & demand sweep.
    _scheduler.add_job(
        _run_agent_job,
        CronTrigger(hour=9, minute=0),
        id="pricing.daily_review",
        kwargs={
            "job_id": "pricing.daily_review",
            "prompt": (
                "Dynamic Pricing Agent: dün için rakip fiyat, talep ve stok "
                "sinyallerinden hareketle fiyat ayarı önerisi ver. %5 üstü "
                "değişimi ⚠️ ile insan onayına işaretle."
            ),
            "agent_hint": "dynamic_pricing_agent",
        },
        replace_existing=True,
    )

    # Daily at 18:00: review/reputation sweep.
    _scheduler.add_job(
        _run_agent_job,
        CronTrigger(hour=18, minute=0),
        id="reviews.daily_sweep",
        kwargs={
            "job_id": "reviews.daily_sweep",
            "prompt": (
                "Review & Reputation Agent: bugün gelen yorumları sınıflandır; "
                "negatif olanlar için empatik taslak yanıt üret."
            ),
            "agent_hint": "review_reputation_agent",
        },
        replace_existing=True,
    )

    _scheduler.start()
    log.info("scheduler.started", jobs=[j.id for j in _scheduler.get_jobs()])
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


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
    """Manually fire a scheduled job — useful for UI 'Run now' buttons."""
    if _scheduler is None:
        return {"ok": False, "reason": "scheduler not started"}
    job = _scheduler.get_job(job_id)
    if not job:
        return {"ok": False, "reason": f"job '{job_id}' not found"}
    # Modify next_run_time so the job fires on the next tick.
    job.modify(next_run_time=datetime.now(UTC))
    return {"ok": True, "job_id": job_id}
