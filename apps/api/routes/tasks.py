from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.models.schemas import Task, TaskCreate, TaskStatus
from apps.api.services.task_store import get_task_store

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[Task])
async def list_tasks(status: TaskStatus | None = None) -> list[Task]:
    tasks = get_task_store().all()
    if status:
        tasks = [t for t in tasks if t.status == status]
    return tasks


@router.post("", response_model=Task)
async def create_task(payload: TaskCreate) -> Task:
    return get_task_store().create(payload)


@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str) -> Task:
    task = get_task_store().get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/status", response_model=Task)
async def update_status(task_id: str, status: TaskStatus) -> Task:
    task = get_task_store().update_status(task_id, status)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
