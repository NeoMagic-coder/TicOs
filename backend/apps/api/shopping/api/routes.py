"""API uclari — kullanici hedefi girisi, ajan kosusu, sonuc ve EUV metrikleri."""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.shopping.config import Settings, get_settings
from apps.api.shopping.core.metrics import build_metrics_report
from apps.api.shopping.core.orchestrator import execute_run, run_shopping_agent
from apps.api.shopping.db import repo
from apps.api.shopping.db.database import get_session
from apps.api.shopping.db.models import RunRow
from apps.api.shopping.schemas import (
    AgentRunResult,
    FeedbackIn,
    FeedbackOut,
    MetricsReport,
    RunCreatedOut,
    RunStatus,
    RunSummary,
    ShoppingGoal,
)

router = APIRouter(prefix="/shopping", tags=["shopping-agent"])
logger = logging.getLogger(__name__)

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def _row_to_result(row: RunRow) -> AgentRunResult:
    if row.result_json:
        result = AgentRunResult.model_validate_json(row.result_json)
        return result.model_copy(update={"created_at": row.created_at})
    summary = (
        "Alisveris karsilastirmasi basarisiz oldu"
        if row.status == RunStatus.FAILED.value
        else ""
    )
    return AgentRunResult(
        run_id=row.id,
        status=RunStatus(row.status),
        goal=ShoppingGoal.model_validate_json(row.goal_json),
        summary=summary,
        created_at=row.created_at,
    )


@router.post("/runs", status_code=status.HTTP_202_ACCEPTED, response_model=RunCreatedOut)
async def create_run(
    goal: ShoppingGoal, background: BackgroundTasks, session: SessionDep
) -> RunCreatedOut:
    """Kullanici hedefini al, ajani arka planda baslat; sonuc GET /runs/{id} ile alinir."""
    run_id = uuid.uuid4().hex[:12]
    await repo.create_run(session, run_id, goal)
    background.add_task(execute_run, run_id)
    return RunCreatedOut(run_id=run_id, status=RunStatus.PENDING)


@router.post("/runs/sync", response_model=AgentRunResult)
async def create_run_sync(goal: ShoppingGoal, session: SessionDep) -> AgentRunResult:
    """Ajani senkron calistir ve sonucu dogrudan dondur (demo/test icin pratik)."""
    run_id = uuid.uuid4().hex[:12]
    await repo.create_run(session, run_id, goal)
    try:
        result = await run_shopping_agent(goal, run_id=run_id)
    except Exception as exc:
        await repo.set_run_failed(session, run_id, str(exc))
        logger.exception("shopping.run.failed run_id=%s", run_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Alisveris karsilastirmasi gecici olarak basarisiz oldu",
        ) from exc
    await repo.set_run_result(session, run_id, result)
    return result


@router.get("/runs", response_model=list[RunSummary])
async def list_runs(session: SessionDep) -> list[RunSummary]:
    rows = await repo.list_runs(session)
    return [
        RunSummary(
            run_id=row.id,
            status=RunStatus(row.status),
            product_query=ShoppingGoal.model_validate_json(row.goal_json).product_query,
            duration_seconds=row.duration_seconds,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/runs/{run_id}", response_model=AgentRunResult)
async def get_run(run_id: str, session: SessionDep) -> AgentRunResult:
    row = await repo.get_run(session, run_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kosu bulunamadi")
    return _row_to_result(row)


@router.post(
    "/runs/{run_id}/feedback",
    status_code=status.HTTP_201_CREATED,
    response_model=FeedbackOut,
)
async def add_feedback(run_id: str, fb: FeedbackIn, session: SessionDep) -> FeedbackOut:
    """EUV anketi: oneri dogru muydu + memnuniyet (1-5)."""
    row = await repo.get_run(session, run_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kosu bulunamadi")
    saved = await repo.add_feedback(session, run_id, fb)
    return FeedbackOut(
        id=saved.id,
        run_id=saved.run_id,
        recommendation_accurate=saved.recommendation_accurate,
        satisfaction=saved.satisfaction,
    )


@router.get("/metrics", response_model=MetricsReport)
async def get_metrics(session: SessionDep, settings: SettingsDep) -> MetricsReport:
    """EUV denklem metrikleri: dogruluk orani, ortalama sure/tasarruf, memnuniyet."""
    runs, feedback = await repo.metrics_rows(session)
    return build_metrics_report(
        durations=[
            r.duration_seconds
            for r in runs
            if r.status in ("completed", "partial") and r.duration_seconds > 0
        ],
        statuses=[r.status for r in runs],
        feedback=[(f.recommendation_accurate, f.satisfaction) for f in feedback],
        baseline_seconds=settings.manual_baseline_seconds,
    )

