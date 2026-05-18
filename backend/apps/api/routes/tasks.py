from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.models.schemas import Task, TaskCreate, TaskStatus
from apps.api.services.task_store import get_task_store

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[Task])
async def list_tasks(
    status: TaskStatus | None = None,
    goal_id: str | None = None,
) -> list[Task]:
    tasks = get_task_store().all()
    if status:
        tasks = [t for t in tasks if t.status == status]
    if goal_id:
        tasks = [t for t in tasks if t.goal_id == goal_id]
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


@router.post("/{task_id}/explain")
async def explain_task(task_id: str) -> dict:
    """Generate a Turkish plain-language explanation of why this task was created
    and what impact is expected. Follows the same pattern as /approvals/{id}/estimate.
    """
    task = get_task_store().get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    llm = get_llm_provider()
    system = (
        "Sen bir e-ticaret stratejisti ve AI ajan koordinatörüsün. Sana verilen "
        "görevin neden oluşturulduğunu, hangi iş sorununu çözdüğünü ve başarı "
        "durumunda beklenen somut etkiyi 2-3 cümlede, sade Türkçe ile açıkla. "
        "Teknik jargon kullanma; iş sahibinin anlayacağı dille yaz."
    )
    result_block = ""
    if task.result:
        result_block = (
            f"\nSonuç özeti: {(task.result.summary or '')[:300]}"
            f"\nBulgular: {'; '.join(task.result.findings[:3])}"
        )
    user = (
        f"Görev: {task.title}\n"
        f"Açıklama: {task.description}\n"
        f"Hedef: {task.goal}\n"
        f"Öncelik: {task.priority}\n"
        f"Durum: {task.status}\n"
        f"Ajan: {task.assigned_agent_id or '—'}"
        f"{result_block}\n\n"
        "Bu görev neden oluşturuldu ve ne işe yarıyor?"
    )
    resp = await llm.generate(
        system=system,
        messages=[LLMMessage(role="user", content=user)],
        temperature=0.4,
        max_tokens=300,
    )
    explanation = (resp.text or "").strip().replace("\n", " ")
    if not explanation or resp.error:
        explanation = "Açıklama üretilemedi (LLM yanıt vermedi)."
    return {"task_id": task_id, "explanation": explanation[:400]}
