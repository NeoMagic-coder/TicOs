from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query

from apps.api.core.db import session_scope
from apps.api.core.db.models import ProductRow
from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.observability import get_tracer
from apps.api.models.schemas import ApprovalRequest
from apps.api.services.task_store import get_approval_store

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _active_product_name(explicit: str | None) -> str | None:
    if explicit and explicit.strip():
        return explicit.strip()
    with session_scope() as s:
        rows = s.query(ProductRow).all()
        active = next((r for r in rows if getattr(r, "is_active", False)), None)
        return (active or (rows[0] if rows else None)).name if rows else None


def _seed_starter_approvals(product_name: str) -> list[ApprovalRequest]:
    """Create two pending approvals so the HITL queue is never empty on first run."""
    store = get_approval_store()
    now = datetime.now(UTC)
    starters = [
        ApprovalRequest(
            id=f"ap_seed_{uuid.uuid4().hex[:8]}",
            task_id="task_onboard",
            agent_id="paid_media_agent",
            action=f"Meta Ads bütçe artışı — {product_name}",
            description="Son 7 gün ROAS hedefin üzerinde; günlük bütçe artışı önerildi.",
            params={"source": "bootstrap", "product_name": product_name, "confidence": 0.82},
            risk_level="low",
            expected_impact="Beklenen: günlük gelir +15–25%, ROAS hedefi korunur.",
            status="pending",
            created_at=now,
        ),
        ApprovalRequest(
            id=f"ap_seed_{uuid.uuid4().hex[:8]}",
            task_id="task_inventory",
            agent_id="inventory_forecast_agent",
            action=f"Reorder önerisi — {product_name}",
            description="Stok tükenme tahmini 14 gün içinde; 200 adet reorder önerildi.",
            params={"source": "bootstrap", "product_name": product_name, "confidence": 0.71},
            risk_level="high",
            expected_impact="Stok-out riski düşer; nakit bağlama orta vadede artar.",
            status="pending",
            created_at=now,
        ),
    ]
    created: list[ApprovalRequest] = []
    for ap in starters:
        created.append(store.create(ap))
    return created


@router.get("", response_model=list[ApprovalRequest])
async def list_approvals() -> list[ApprovalRequest]:
    return get_approval_store().all()


@router.post("", response_model=ApprovalRequest)
async def upsert_approval(body: ApprovalRequest) -> ApprovalRequest:
    """Create or refresh a pending approval (idempotent upsert by id)."""
    store = get_approval_store()
    existing = store.get(body.id)
    if existing and existing.status != "pending":
        return existing
    return store.create(body)


@router.post("/bootstrap", response_model=list[ApprovalRequest])
async def bootstrap_approvals(
    product: str | None = Query(None, max_length=200),
) -> list[ApprovalRequest]:
    """Ensure at least one pending approval exists for the active product."""
    store = get_approval_store()
    pending = [a for a in store.all() if a.status == "pending"]
    if pending:
        return pending
    product_name = _active_product_name(product)
    if not product_name:
        return []
    return _seed_starter_approvals(product_name)


@router.post("/{approval_id}/estimate", response_model=ApprovalRequest)
async def estimate_impact(approval_id: str) -> ApprovalRequest:
    """Ask the LLM for a 1-2 sentence expected-impact estimate and persist it.

    Idempotent: if the approval already has a non-empty `expected_impact`, the
    stored value is returned unchanged to avoid burning quota on re-prompts.
    """
    store = get_approval_store()
    ap = store.get(approval_id)
    if not ap:
        raise HTTPException(status_code=404, detail="Approval not found")
    if ap.expected_impact and ap.expected_impact.strip():
        return ap

    llm = get_llm_provider()
    system = (
        "Sen bir e-ticaret operasyon analistisin. Sana verilen onay aksiyonunun "
        "beklenen sayısal etkisini 1-2 cümlede, Türkçe, somut metrikle (örn. "
        "+%ROAS, -%maliyet, +sipariş, -iade) tahmin et. Olmayan sayı uydurma; "
        "büyüklük bilinmiyorsa 'düşük/orta/yüksek etki' diye nitelendir."
    )
    user = (
        f"Ajan: {ap.agent_id}\n"
        f"Aksiyon: {ap.action}\n"
        f"Açıklama: {ap.description}\n"
        f"Risk: {ap.risk_level}\n"
        f"Parametreler: {ap.params}\n\n"
        "Beklenen etki:"
    )
    resp = await llm.generate(
        system=system,
        messages=[LLMMessage(role="user", content=user)],
        temperature=0.4,
        max_tokens=200,
    )
    impact = (resp.text or "").strip()
    if not impact or resp.error:
        impact = "Tahmin üretilemedi (LLM yanıt vermedi)."
    impact = impact.replace("\n", " ").strip()[:280]
    updated = store.update_impact(approval_id, impact)
    if not updated:
        raise HTTPException(status_code=404, detail="Approval not found")
    return updated


@router.post("/{approval_id}/approve", response_model=ApprovalRequest)
async def approve(approval_id: str, note: str | None = None) -> ApprovalRequest:
    tracer = get_tracer()
    with tracer.start_as_current_span("hitl.approve") as span:
        span.set_attribute("approval.id", approval_id)
        span.set_attribute("hitl.decision", "approved")
        ap = get_approval_store().resolve(approval_id, status="approved", note=note)
        if not ap:
            raise HTTPException(status_code=404, detail="Approval not found")
        span.set_attribute("approval.agent_id", ap.agent_id)
        span.set_attribute("approval.action", ap.action)
        span.set_attribute("approval.risk_level", ap.risk_level)
    return ap


@router.post("/{approval_id}/reject", response_model=ApprovalRequest)
async def reject(approval_id: str, note: str) -> ApprovalRequest:
    tracer = get_tracer()
    with tracer.start_as_current_span("hitl.reject") as span:
        span.set_attribute("approval.id", approval_id)
        span.set_attribute("hitl.decision", "rejected")
        ap = get_approval_store().resolve(approval_id, status="rejected", note=note)
        if not ap:
            raise HTTPException(status_code=404, detail="Approval not found")
        span.set_attribute("approval.agent_id", ap.agent_id)
        span.set_attribute("approval.action", ap.action)
        span.set_attribute("approval.risk_level", ap.risk_level)
    return ap
