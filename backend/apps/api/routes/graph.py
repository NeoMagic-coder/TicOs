"""Graph endpoints — start a new DAG explicitly (bypasses chat).

POST /api/v1/dag
    Equivalent to POST /api/v1/chat but the payload is positioned as a DAG
    builder rather than a conversational message.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from apps.api.core.hermes.orchestrator import get_orchestrator

router = APIRouter(prefix="/dag", tags=["graph"])


class NewDagRequest(BaseModel):
    prompt: str = Field(..., min_length=3)
    product_context: dict[str, Any] | None = None


@router.post("", response_model=dict[str, Any])
async def new_dag(body: NewDagRequest) -> dict[str, Any]:
    orchestrator = get_orchestrator()
    output = await orchestrator.handle(
        message=body.prompt,
        history=[],
        product_context=body.product_context or {},
    )
    return {
        "task_id": output.task_id,
        "summary": output.summary,
        "confidence": output.confidence,
        "escalated": output.escalated,
        "tools_used": output.tools_used,
        "graph": output.graph,
    }
