"""Growth experiments endpoints — list, create, fetch detail.

In-memory store for now; mirrors what the frontend stub expects.
A future iteration can move this into the SQL store alongside tasks/approvals.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/experiments", tags=["experiments"])


class ExperimentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    area: str = Field(default="CRO")
    hypothesis: str = Field(default="")
    agent: str = Field(default="growth_agent")


class Experiment(BaseModel):
    id: str
    name: str
    area: str
    hypothesis: str
    agent: str
    status: str = "planned"
    conv_lift: str = "—"
    spend: float = 0
    win_rate: float = 0
    created_at: str


_EXPERIMENTS: dict[str, Experiment] = {}


@router.get("", response_model=list[Experiment])
async def list_experiments() -> list[Experiment]:
    return list(_EXPERIMENTS.values())


@router.post("", response_model=Experiment, status_code=201)
async def create_experiment(body: ExperimentCreate) -> Experiment:
    exp = Experiment(
        id=f"exp_{uuid4().hex[:6]}",
        name=body.name,
        area=body.area,
        hypothesis=body.hypothesis,
        agent=body.agent,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _EXPERIMENTS[exp.id] = exp
    return exp


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str) -> Experiment:
    exp = _EXPERIMENTS.get(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp
