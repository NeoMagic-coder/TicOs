"""User-defined scheduled automation CRUD.

POST /api/v1/automations           — create (accepts nl_schedule or schedule_expr)
GET  /api/v1/automations           — list all with live APScheduler state
GET  /api/v1/automations/{id}      — get one
PATCH /api/v1/automations/{id}     — update fields (name, prompt, enabled, ...)
DELETE /api/v1/automations/{id}    — remove from scheduler and DB
POST /api/v1/automations/{id}/trigger — fire immediately
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from apps.api.core.scheduler import (
    create_job,
    delete_job,
    list_user_jobs,
    toggle_job,
    trigger_job_now,
)

router = APIRouter(prefix="/automations", tags=["automations"])


class AutomationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    prompt: str = Field(..., min_length=1)
    # Either a 5-field cron string OR a Turkish phrase. The backend resolves it.
    schedule: str = Field(..., description="Cron expr ('0 9 * * 1') or NL ('her pazartesi sabah')")
    agent_hint: str | None = None
    delivery_platform: str = "web"
    delivery_target: str = ""


class AutomationUpdate(BaseModel):
    name: str | None = None
    prompt: str | None = None
    enabled: bool | None = None


@router.get("", response_model=list[dict])
async def list_automations() -> list[dict[str, Any]]:
    return list_user_jobs()


@router.post("", response_model=dict)
async def create_automation(body: AutomationCreate) -> dict[str, Any]:
    try:
        row = await create_job(
            name=body.name,
            prompt=body.prompt,
            schedule_description=body.schedule,
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
        "enabled": row.enabled,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/{job_id}", response_model=dict)
async def get_automation(job_id: str) -> dict[str, Any]:
    jobs = {j["id"]: j for j in list_user_jobs()}
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Automation not found")
    return jobs[job_id]


@router.patch("/{job_id}", response_model=dict)
async def update_automation(job_id: str, body: AutomationUpdate) -> dict[str, Any]:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    if "enabled" in updates:
        ok = toggle_job(job_id, enabled=updates.pop("enabled"))
        if not ok:
            raise HTTPException(status_code=404, detail="Automation not found")

    # Apply remaining field changes (name, prompt) via the DB
    if updates:
        from apps.api.core.db.engine import session_scope
        from apps.api.core.db.models import ScheduledJobRow
        with session_scope() as db:
            row = db.get(ScheduledJobRow, job_id)
            if row is None:
                raise HTTPException(status_code=404, detail="Automation not found")
            for key, val in updates.items():
                setattr(row, key, val)

    jobs = {j["id"]: j for j in list_user_jobs()}
    return jobs.get(job_id, {"id": job_id})


@router.delete("/{job_id}")
async def delete_automation(job_id: str) -> dict[str, bool]:
    removed = delete_job(job_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"deleted": True}


@router.post("/{job_id}/trigger")
async def trigger_automation(job_id: str) -> dict[str, Any]:
    result = await trigger_job_now(job_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("reason", "Job not found"))
    return result
