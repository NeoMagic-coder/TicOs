from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.models.schemas import ApprovalRequest
from apps.api.services.task_store import get_approval_store

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalRequest])
async def list_approvals() -> list[ApprovalRequest]:
    return get_approval_store().all()


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
    ap = get_approval_store().resolve(approval_id, status="approved", note=note)
    if not ap:
        raise HTTPException(status_code=404, detail="Approval not found")
    return ap


@router.post("/{approval_id}/reject", response_model=ApprovalRequest)
async def reject(approval_id: str, note: str) -> ApprovalRequest:
    ap = get_approval_store().resolve(approval_id, status="rejected", note=note)
    if not ap:
        raise HTTPException(status_code=404, detail="Approval not found")
    return ap
