"""Goal-driven autonomous loop (Phase 2).

Scans active Paperclip goals and dispatches Hermes work for goals that lack
recent linked task activity. Uses the decision engine as a lightweight gate
before invoking the orchestrator.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select

from apps.api.core.autonomy.decision_engine import DecisionEngine
from apps.api.core.autonomy.runtime import autonomy_enabled, get_autonomy_mode
from apps.api.core.db import session_scope
from apps.api.core.db.models import GoalRow, ProductRow, TaskRow
from apps.api.core.hermes.orchestrator import HermesOrchestrator, OrchestrationResult
from apps.api.core.logging import get_logger
from apps.api.models.schemas import ApprovalRequest
from apps.api.services.task_store import get_approval_store

log = get_logger(__name__)

STALE_HOURS = 4
COOLDOWN_MINUTES = 30
_DEFAULT_GOAL_LOOP: dict[str, Any] = {
    "last_tick_at": None,
    "last_results": [],
    "dispatched": {},
    "seeded_goal_ids": [],
}

_LAST_LOOP: dict[str, Any] = dict(_DEFAULT_GOAL_LOOP)
_engine = DecisionEngine()


def last_loop_state() -> dict[str, Any]:
    return dict(_LAST_LOOP)


def _active_product() -> ProductRow | None:
    with session_scope() as s:
        row = s.execute(
            select(ProductRow).where(ProductRow.is_active == True).limit(1)  # noqa: E712
        ).scalar_one_or_none()
        if row:
            return row
        return s.execute(
            select(ProductRow).order_by(ProductRow.onboarded_at.desc()).limit(1)
        ).scalar_one_or_none()


def ensure_default_goals(*, product_name: str | None = None) -> list[str]:
    """Seed three root goals when the tree is empty."""
    with session_scope() as s:
        existing = s.execute(
            select(func.count()).select_from(GoalRow).where(GoalRow.status == "active")
        ).scalar_one()
        if existing and existing > 0:
            return []

        name = product_name or "aktif ürün"
        now = datetime.now(UTC)
        templates = [
            (
                f"{name} — ilk satış ve lansman",
                "Ürün görünürlüğü, listeleme kalitesi ve ilk dönüşüm hunisi adımları.",
                "orders_per_day",
                10.0,
                "cmo_agent",
            ),
            (
                f"{name} — operasyon sürekliliği",
                "Stok, kargo SLA ve iade oranı için günlük operasyon hedefleri.",
                "fulfillment_sla_pct",
                95.0,
                "operations_agent",
            ),
            (
                f"{name} — ROAS ve marj",
                "Reklam verimliliği ve brüt marj korunarak büyüme.",
                "roas",
                3.0,
                "dynamic_pricing_agent",
            ),
        ]
        created: list[str] = []
        for title, desc, metric, target, owner in templates:
            gid = f"goal_{uuid.uuid4().hex[:12]}"
            s.add(
                GoalRow(
                    id=gid,
                    title=title,
                    description=desc,
                    target_metric=metric,
                    target_value=target,
                    owner_agent_id=owner,
                    status="active",
                    created_at=now,
                    updated_at=now,
                )
            )
            created.append(gid)
        s.flush()
    if created:
        _LAST_LOOP["seeded_goal_ids"] = created
        log.info("goal_loop.seeded", count=len(created), product=name)
    return created


def _last_task_at(goal_id: str) -> datetime | None:
    with session_scope() as s:
        row = s.execute(
            select(TaskRow.created_at)
            .where(TaskRow.goal_id == goal_id)
            .order_by(TaskRow.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        return row


def _recent_loop_dispatch(goal_id: str) -> bool:
    dispatched = _LAST_LOOP.get("dispatched") or {}
    raw = dispatched.get(goal_id)
    if not raw:
        return False
    try:
        at = datetime.fromisoformat(str(raw))
    except ValueError:
        return False
    return at > datetime.now(UTC) - timedelta(minutes=COOLDOWN_MINUTES)


def find_stale_goals(*, stale_hours: int = STALE_HOURS, limit: int = 3) -> list[GoalRow]:
    cutoff = datetime.now(UTC) - timedelta(hours=stale_hours)
    with session_scope() as s:
        goals = s.execute(
            select(GoalRow)
            .where(GoalRow.status == "active")
            .order_by(GoalRow.updated_at.asc())
        ).scalars().all()

    stale: list[tuple[int, GoalRow]] = []
    for goal in goals:
        if _recent_loop_dispatch(goal.id):
            continue
        last_at = _last_task_at(goal.id)
        if last_at is None or last_at < cutoff:
            priority = 0 if last_at is None else int((cutoff - last_at).total_seconds())
            stale.append((priority, goal))
    stale.sort(key=lambda x: -x[0])
    return [g for _, g in stale[:limit]]


def get_loop_status() -> dict[str, Any]:
    product = _active_product()
    with session_scope() as s:
        active_count = s.execute(
            select(func.count()).select_from(GoalRow).where(GoalRow.status == "active")
        ).scalar_one() or 0
    stale = find_stale_goals(limit=5)
    return {
        "enabled": autonomy_enabled() and get_autonomy_mode().get("auto_goal_loop", True),
        "active_goals": active_count,
        "stale_goals": [
            {
                "id": g.id,
                "title": g.title,
                "owner_agent_id": g.owner_agent_id,
                "last_task_at": _last_task_at(g.id).isoformat() if _last_task_at(g.id) else None,
            }
            for g in stale
        ],
        "stale_count": len(stale),
        "active_product": product.name if product else None,
        "last_tick_at": _LAST_LOOP.get("last_tick_at"),
        "last_results": _LAST_LOOP.get("last_results") or [],
        "seeded_goal_ids": _LAST_LOOP.get("seeded_goal_ids") or [],
    }


def _build_prompt(goal: GoalRow, product: ProductRow) -> str:
    metric = goal.target_metric or "—"
    target = goal.target_value if goal.target_value is not None else "—"
    current = goal.current_value if goal.current_value is not None else "—"
    owner = goal.owner_agent_id or "supervisor"
    return (
        f'Otonom hedef döngüsü: "{goal.title}" hedefi için bir sonraki somut adımı planla ve uygula.\n'
        f"Açıklama: {goal.description or '—'}\n"
        f"Metrik: {metric} · hedef={target} · mevcut={current}\n"
        f"Aktif ürün: {product.name} ({product.category})\n"
        f"Sorumlu ajan: {owner}\n"
        "Kısa özet + yapılacak aksiyonları listele; düşük riskli adımları doğrudan uygula."
    )


def _persist_goal_task(
    *,
    result: OrchestrationResult,
    goal: GoalRow,
    product: ProductRow,
) -> None:
    now = datetime.now(UTC)
    status = "escalated" if result.escalated else "completed"
    with session_scope() as s:
        row = s.get(TaskRow, result.task_id)
        if row is None:
            row = TaskRow(
                task_id=result.task_id,
                title=f"Hedef: {goal.title[:200]}",
                description=(result.summary or "")[:2000],
                goal=goal.title,
                goal_id=goal.id,
                status=status,
                context={
                    "source": "goal_loop",
                    "product_name": product.name,
                    "confidence": result.confidence,
                },
                created_at=now,
                updated_at=now,
                completed_at=now,
            )
            s.add(row)
        else:
            row.goal_id = goal.id
            row.goal = goal.title
            row.status = status
            row.updated_at = now
            row.completed_at = now
            if result.summary:
                row.description = result.summary[:2000]
        goal.updated_at = now
        s.flush()


def _queue_goal_approval(
    *,
    goal: GoalRow,
    task_id: str,
    agent_id: str | None,
    action: str,
    description: str,
    risk_level: str = "medium",
) -> str:
    """Enqueue human review when goal progress needs approval or escalates."""
    ap_id = f"ap_{uuid.uuid4().hex[:8]}"
    get_approval_store().create(
        ApprovalRequest(
            id=ap_id,
            task_id=task_id,
            agent_id=agent_id or "supervisor",
            action=action[:512],
            description=description[:2000],
            params={
                "goal_id": goal.id,
                "goal_title": goal.title,
                "source": "goal_loop",
            },
            risk_level=risk_level,
            expected_impact="",
            status="pending",
        )
    )
    log.info("goal_loop.approval_queued", goal_id=goal.id, approval_id=ap_id)
    return ap_id


async def run_goal_loop_tick(
    orchestrator: HermesOrchestrator | None = None,
    *,
    goal_id: str | None = None,
    max_goals: int = 1,
) -> dict[str, Any]:
    """Run one goal-loop tick — dispatch Hermes for stale active goals."""
    mode = get_autonomy_mode()
    if not autonomy_enabled() or not mode.get("auto_goal_loop", True):
        return {"skipped": True, "reason": "auto_goal_loop_disabled"}

    product = _active_product()
    if product is None:
        return {"skipped": True, "reason": "no_active_product"}

    ensure_default_goals(product_name=product.name)

    if orchestrator is None:
        orchestrator = HermesOrchestrator()

    started = datetime.now(UTC)
    results: list[dict[str, Any]] = []

    if goal_id:
        with session_scope() as s:
            goal = s.get(GoalRow, goal_id)
        if goal is None or goal.status != "active":
            return {"skipped": True, "reason": "goal_not_found_or_inactive", "goal_id": goal_id}
        targets = [goal]
    else:
        targets = find_stale_goals(limit=max_goals)

    if not targets:
        payload = {
            "at": started.isoformat(),
            "dispatched": 0,
            "results": [],
            "reason": "no_stale_goals",
        }
        _LAST_LOOP["last_tick_at"] = started.isoformat()
        _LAST_LOOP["last_results"] = []
        return payload

    for goal in targets:
        decision = _engine.evaluate(
            action_type="goal_progress",
            value=0.0,
            risk_level="low",
            confidence=0.9,
        )
        entry: dict[str, Any] = {
            "goal_id": goal.id,
            "goal_title": goal.title,
            "decision": decision.status,
            "decision_reason": decision.reason,
        }
        if decision.status != "auto_approved":
            if decision.status == "needs_approval":
                ap_id = _queue_goal_approval(
                    goal=goal,
                    task_id=f"task_goal_{goal.id[-8:]}",
                    agent_id=goal.owner_agent_id,
                    action=f"Hedef ilerlemesi: {goal.title[:120]}",
                    description=decision.reason,
                    risk_level="medium",
                )
                entry["approval_id"] = ap_id
            results.append(entry)
            log.info(
                "goal_loop.skipped_policy",
                goal_id=goal.id,
                status=decision.status,
                reason=decision.reason,
            )
            continue

        prompt = _build_prompt(goal, product)
        product_context = {
            "source": "goal_loop",
            "product_name": product.name,
            "category": product.category,
            "goal_id": goal.id,
            "goal_title": goal.title,
            "owner_agent_id": goal.owner_agent_id,
        }
        try:
            result = await orchestrator.handle(
                message=prompt,
                history=[],
                product_context=product_context,
            )
            _persist_goal_task(result=result, goal=goal, product=product)
            entry.update(
                {
                    "task_id": result.task_id,
                    "summary": (result.summary or "")[:240],
                    "confidence": round(result.confidence, 3),
                    "escalated": result.escalated,
                }
            )
            if result.escalated:
                ap_id = _queue_goal_approval(
                    goal=goal,
                    task_id=result.task_id,
                    agent_id=goal.owner_agent_id,
                    action=f"Hedef görevi yükseltildi: {goal.title[:100]}",
                    description=(result.summary or "Düşük güven — insan onayı gerekli.")[:500],
                    risk_level="high" if result.confidence < 0.5 else "medium",
                )
                entry["approval_id"] = ap_id
            log.info("goal_loop.dispatched", goal_id=goal.id, task_id=result.task_id)
        except Exception as exc:
            entry["error"] = str(exc)[:200]
            log.warning("goal_loop.dispatch_failed", goal_id=goal.id, error=str(exc)[:200])

        results.append(entry)
        dispatched = dict(_LAST_LOOP.get("dispatched") or {})
        dispatched[goal.id] = datetime.now(UTC).isoformat()
        _LAST_LOOP["dispatched"] = dispatched

    finished = datetime.now(UTC)
    _LAST_LOOP["last_tick_at"] = finished.isoformat()
    _LAST_LOOP["last_results"] = results

    return {
        "at": finished.isoformat(),
        "dispatched": sum(1 for r in results if r.get("task_id")),
        "results": results,
        "active_product": product.name,
    }
