"""Veri erisim katmani — kosu ve geri bildirim CRUD islemleri."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.shopping.db.models import FeedbackRow, RunRow
from apps.api.shopping.schemas import AgentRunResult, FeedbackIn, RunStatus, ShoppingGoal


async def create_run(session: AsyncSession, run_id: str, goal: ShoppingGoal) -> None:
    session.add(RunRow(id=run_id, status=RunStatus.PENDING.value, goal_json=goal.model_dump_json()))
    await session.commit()


async def get_run(session: AsyncSession, run_id: str) -> RunRow | None:
    return await session.get(RunRow, run_id)


async def list_runs(session: AsyncSession) -> list[RunRow]:
    result = await session.execute(select(RunRow).order_by(RunRow.created_at.desc()))
    return list(result.scalars())


async def set_run_status(session: AsyncSession, run_id: str, status: RunStatus) -> None:
    row = await session.get(RunRow, run_id)
    if row is not None:
        row.status = status.value
        await session.commit()


async def set_run_result(session: AsyncSession, run_id: str, result: AgentRunResult) -> None:
    row = await session.get(RunRow, run_id)
    if row is not None:
        row.status = result.status.value
        row.result_json = result.model_dump_json()
        row.duration_seconds = result.duration_seconds
        await session.commit()


async def set_run_failed(session: AsyncSession, run_id: str, error: str) -> None:
    row = await session.get(RunRow, run_id)
    if row is not None:
        row.status = RunStatus.FAILED.value
        row.error_text = error
        await session.commit()


async def add_feedback(session: AsyncSession, run_id: str, fb: FeedbackIn) -> FeedbackRow:
    row = FeedbackRow(
        run_id=run_id,
        recommendation_accurate=fb.recommendation_accurate,
        satisfaction=fb.satisfaction,
        comment=fb.comment,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def metrics_rows(session: AsyncSession) -> tuple[list[RunRow], list[FeedbackRow]]:
    runs = list((await session.execute(select(RunRow))).scalars())
    feedback = list((await session.execute(select(FeedbackRow))).scalars())
    return runs, feedback

