"""Org chart endpoints.

Paperclip-style read-only view of the agent organisation. Editable later;
v1 just exposes the seeded structure so the UI can render the chart.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.core.org.service import get_org_snapshot
from apps.api.models.schemas import OrgUnit

router = APIRouter(prefix="/org", tags=["org"])


@router.get("/units", response_model=list[OrgUnit])
async def list_org_units() -> list[OrgUnit]:
    """Return every department with its members + child unit ids."""
    return get_org_snapshot()


@router.get("/units/{unit_id}", response_model=OrgUnit)
async def get_org_unit(unit_id: str) -> OrgUnit:
    for unit in get_org_snapshot():
        if unit.id == unit_id:
            return unit
    raise HTTPException(status_code=404, detail="Org unit not found")


@router.get("/agents/{agent_id}/unit", response_model=OrgUnit | None)
async def get_unit_for_agent(agent_id: str) -> OrgUnit | None:
    """Find the org unit a given agent belongs to. Returns ``null`` if
    the agent is not yet assigned (e.g. agents added after the seed)."""
    for unit in get_org_snapshot():
        if agent_id in unit.member_agent_ids:
            return unit
    return None
