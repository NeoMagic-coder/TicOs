"""FastAPI routes for AutoResearch operations.

Endpoints to trigger optimization loops, query run status, and retrieve trial runs.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from apps.api.core.config import get_settings
from apps.api.core.autoresearch.engine import AutoResearchEngine
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AutoResearchRunRow
from apps.api.core.logging import get_logger

log = get_logger(__name__)

router = APIRouter(prefix="/autoresearch", tags=["autoresearch"])


class RunRequest(BaseModel):
    goal_id: str = Field(..., description="The ID of the goal associated with this research.")
    program_name: str = Field(
        "dynamic_pricing.md",
        description="Name of an approved recipe markdown file.",
    )
    max_cycles: int = Field(3, description="Number of trial iterations to run.", ge=1, le=10)


def _resolve_program_path(program_name: str) -> Path:
    """Resolve a recipe name inside the configured allowlisted directory."""
    if Path(program_name).name != program_name or not program_name.endswith(".md"):
        raise HTTPException(status_code=400, detail="Invalid AutoResearch program name")

    program_dir = Path(get_settings().autoresearch_program_dir).resolve()
    program_path = (program_dir / program_name).resolve()
    if not program_path.is_relative_to(program_dir):
        raise HTTPException(status_code=400, detail="Invalid AutoResearch program name")
    if not program_path.is_file():
        raise HTTPException(status_code=404, detail="AutoResearch program not found")
    return program_path


async def _run_bg_task(goal_id: str, program_path: str, max_cycles: int) -> None:
    try:
        engine = AutoResearchEngine()
        await engine.run_loop(goal_id=goal_id, program_path=program_path, max_cycles=max_cycles)
    except Exception as exc:
        log.error("autoresearch.background_job.failed", goal_id=goal_id, error=str(exc))


@router.post("/run", tags=["autoresearch"])
async def trigger_autoresearch_run(req: RunRequest, bg_tasks: BackgroundTasks) -> dict[str, Any]:
    """Start an autonomous research optimization run in the background."""
    program_path = _resolve_program_path(req.program_name)
    bg_tasks.add_task(_run_bg_task, req.goal_id, str(program_path), req.max_cycles)
    return {
        "status": "started",
        "message": f"AutoResearch loop has been triggered in the background for goal: {req.goal_id}.",
        "goal_id": req.goal_id,
        "program_name": req.program_name,
        "max_cycles": req.max_cycles,
    }


@router.get("/status/{goal_id}", tags=["autoresearch"])
async def get_autoresearch_status(goal_id: str) -> dict[str, Any]:
    """Get the latest trial status, metrics, and parameters for a goal."""
    try:
        with session_scope() as db:
            stmt = select(AutoResearchRunRow).where(AutoResearchRunRow.goal_id == goal_id).order_by(AutoResearchRunRow.iteration.asc())
            rows = db.execute(stmt).scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}")

    if not rows:
        return {
            "goal_id": goal_id,
            "status": "not_started",
            "trials": [],
            "best_trial": None,
        }

    trials = []
    best_trial = None
    for r in rows:
        trial_data = {
            "id": r.id,
            "recipe_name": r.recipe_name,
            "metric_name": r.metric_name,
            "metric_value": r.metric_value,
            "parameters": r.parameters,
            "iteration": r.iteration,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        trials.append(trial_data)

        # Update best trial (maximizing expected_revenue_lift_pct or general metric)
        if best_trial is None:
            best_trial = trial_data
        else:
            # By default, we assume metric is to be maximized unless specified (e.g. costs)
            is_cost = any(c in r.metric_name.lower() for c in ("cost", "loss", "error"))
            if is_cost:
                if trial_data["metric_value"] < best_trial["metric_value"]:
                    best_trial = trial_data
            else:
                if trial_data["metric_value"] > best_trial["metric_value"]:
                    best_trial = trial_data

    return {
        "goal_id": goal_id,
        "status": "active" if any(r.status == "running" for r in rows) else "completed",
        "trials_count": len(trials),
        "best_trial": best_trial,
        "trials": trials,
    }


@router.get("/runs", tags=["autoresearch"])
async def list_autoresearch_runs() -> list[dict[str, Any]]:
    """List all AutoResearch trial runs stored in the database."""
    try:
        with session_scope() as db:
            stmt = select(AutoResearchRunRow).order_by(AutoResearchRunRow.created_at.desc())
            rows = db.execute(stmt).scalars().all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database query failed: {exc}")

    return [
        {
            "id": r.id,
            "goal_id": r.goal_id,
            "recipe_name": r.recipe_name,
            "metric_name": r.metric_name,
            "metric_value": r.metric_value,
            "parameters": r.parameters,
            "iteration": r.iteration,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
