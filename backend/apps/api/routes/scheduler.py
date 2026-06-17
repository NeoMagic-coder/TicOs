"""Scheduler CRUD routes — user-defined automated jobs."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from apps.api.core.scheduler import (
    create_job,
    delete_job,
    list_user_jobs,
    scheduler_status,
    toggle_job,
    trigger_job_now,
)

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


class CreateJobRequest(BaseModel):
    name: str
    prompt: str
    schedule_description: str
    agent_hint: str | None = None
    delivery_platform: str = "web"
    delivery_target: str = ""


class ToggleJobRequest(BaseModel):
    enabled: bool


@router.get("", response_model=dict[str, Any])
async def get_scheduler_status() -> dict[str, Any]:
    """Return scheduler status + built-in job states."""
    return scheduler_status()


@router.get("/jobs", response_model=list[dict[str, Any]])
async def get_jobs() -> list[dict[str, Any]]:
    """List all user-defined scheduled jobs."""
    return list_user_jobs()


@router.post("/jobs", response_model=dict[str, Any], status_code=201)
async def post_job(body: CreateJobRequest) -> dict[str, Any]:
    """Create a new scheduled job. Accepts natural-language or cron schedule."""
    try:
        row = await create_job(
            name=body.name,
            prompt=body.prompt,
            schedule_description=body.schedule_description,
            agent_hint=body.agent_hint,
            delivery_platform=body.delivery_platform,
            delivery_target=body.delivery_target,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "id": row.id,
        "name": row.name,
        "schedule_expr": row.schedule_expr,
        "next_run_at": row.next_run_at.isoformat() if row.next_run_at else None,
        "enabled": row.enabled,
        "last_status": row.last_status,
        "created_at": row.created_at.isoformat(),
    }


@router.delete("/jobs/{job_id}", status_code=200)
async def remove_job(job_id: str) -> dict[str, bool]:
    """Delete a user-defined job."""
    if not delete_job(job_id):
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return {"deleted": True}


@router.patch("/jobs/{job_id}/toggle", response_model=dict[str, Any])
async def patch_toggle(job_id: str, body: ToggleJobRequest) -> dict[str, Any]:
    """Enable or pause a scheduled job."""
    if not toggle_job(job_id, enabled=body.enabled):
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return {"ok": True, "job_id": job_id, "enabled": body.enabled}


@router.post("/jobs/{job_id}/run", response_model=dict[str, Any])
async def run_job_now(job_id: str) -> dict[str, Any]:
    """Manually trigger a job immediately."""
    result = await trigger_job_now(job_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("reason", "not found"))
    return result
