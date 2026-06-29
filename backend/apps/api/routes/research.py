"""Research endpoints — trajectory management and batch prompt execution.

GET  /api/v1/research/trajectories        — list trajectories (filterable)
GET  /api/v1/research/trajectories/{id}   — get one full trajectory
POST /api/v1/research/trajectories/{id}/compress  — LLM-compress a trajectory
POST /api/v1/research/batch               — run N prompts in parallel, create N trajectories
POST /api/v1/research/export              — stream unexported trajectories as JSONL
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/research", tags=["research"])


class BatchRequest(BaseModel):
    prompts: list[str] = Field(..., min_length=1, max_length=20)
    product_context: dict[str, Any] = Field(default_factory=dict)
    min_confidence: float = 0.0


class ExportRequest(BaseModel):
    min_quality: float = 0.0
    unexported_only: bool = True
    use_compressed: bool = True


@router.get("/trajectories", response_model=list[dict[str, Any]])
async def list_trajectories_endpoint(
    min_quality: float = 0.0,
    unexported_only: bool = False,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List recorded trajectories with optional quality filter."""
    from apps.api.core.research.compressor import list_trajectories
    return list_trajectories(min_quality=min_quality, unexported_only=unexported_only, limit=min(limit, 500))


@router.get("/trajectories/{trajectory_id}", response_model=dict[str, Any])
async def get_trajectory_endpoint(trajectory_id: str) -> dict[str, Any]:
    """Return the full step list for a trajectory."""
    from apps.api.core.research.trajectory import get_trajectory
    traj = get_trajectory.__wrapped__(trajectory_id) if hasattr(get_trajectory, "__wrapped__") else get_trajectory(trajectory_id)
    # Use direct DB call
    from apps.api.core.db.engine import session_scope
    from apps.api.core.db.models import TrajectoryRow
    with session_scope() as db:
        row = db.get(TrajectoryRow, trajectory_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Trajectory not found")
    return {
        "id": row.id,
        "task_id": row.task_id,
        "steps": row.steps,
        "compressed_steps": row.compressed_steps,
        "quality_score": row.quality_score,
        "exported_at": row.exported_at.isoformat() if row.exported_at else None,
        "created_at": row.created_at.isoformat(),
    }


@router.post("/trajectories/{trajectory_id}/compress", response_model=dict[str, Any])
async def compress_trajectory(trajectory_id: str) -> dict[str, Any]:
    """Compress a trajectory by removing redundant/retried steps."""
    from apps.api.core.research.compressor import compress
    ok = await compress(trajectory_id)
    if not ok:
        raise HTTPException(status_code=422, detail="Compression failed — check logs")
    return {"ok": True, "trajectory_id": trajectory_id}


@router.post("/batch", response_model=dict[str, Any])
async def batch_run(body: BatchRequest) -> dict[str, Any]:
    """Run multiple prompts in parallel through Hermes. Each creates a trajectory."""
    from apps.api.core.hermes.orchestrator import get_orchestrator

    orchestrator = get_orchestrator()

    async def _run_one(prompt: str) -> dict[str, Any]:
        try:
            result = await orchestrator.handle(
                message=prompt,
                history=[],
                product_context={**body.product_context, "source": "research_batch"},
            )
            return {
                "task_id": result.task_id,
                "summary": (result.summary or "")[:300],
                "confidence": round(result.confidence, 3),
                "tools_used": len(result.tools_called),
                "escalated": result.status == "escalated",
            }
        except Exception as exc:
            return {"error": str(exc)[:200], "prompt_preview": prompt[:80]}

    results = await asyncio.gather(*[_run_one(p) for p in body.prompts])
    passed = [r for r in results if "error" not in r and r.get("confidence", 0) >= body.min_confidence]
    return {
        "total": len(body.prompts),
        "passed": len(passed),
        "results": list(results),
    }


@router.post("/export")
async def export_trajectories(body: ExportRequest) -> StreamingResponse:
    """Stream unexported trajectories as JSONL (one JSON object per line)."""
    from apps.api.core.db.engine import session_scope
    from apps.api.core.db.models import TrajectoryRow
    from apps.api.core.research.compressor import list_trajectories, mark_exported
    from sqlalchemy import select, and_

    summaries = list_trajectories(
        min_quality=body.min_quality,
        unexported_only=body.unexported_only,
        limit=500,
    )

    ids_to_export = [s["id"] for s in summaries]

    def _gen():
        with session_scope() as db:
            for tid in ids_to_export:
                row = db.get(TrajectoryRow, tid)
                if row is None:
                    continue
                steps = row.compressed_steps if (body.use_compressed and row.compressed_steps) else row.steps
                record = {
                    "id": row.id,
                    "task_id": row.task_id,
                    "quality_score": row.quality_score,
                    "steps": steps,
                }
                yield json.dumps(record, ensure_ascii=False) + "\n"

        mark_exported(ids_to_export)

    return StreamingResponse(
        _gen(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=trajectories.jsonl"},
    )
