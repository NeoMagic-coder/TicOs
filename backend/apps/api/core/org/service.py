"""Read helpers for the org chart. Heavy reads happen here; the routes layer
stays a thin translation layer over these snapshots."""
from __future__ import annotations

from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentOrgMembershipRow, OrgUnitRow
from apps.api.models.schemas import OrgUnit


def get_org_snapshot() -> list[OrgUnit]:
    """Return every org unit with its members + children resolved.

    Cheap by design — runs two ``SELECT *`` queries and assembles in Python.
    Re-evaluate if the table ever crosses a few thousand rows.
    """
    with session_scope() as s:
        units = s.execute(select(OrgUnitRow).order_by(OrgUnitRow.sort_order, OrgUnitRow.name)).scalars().all()
        memberships = s.execute(select(AgentOrgMembershipRow)).scalars().all()

        members_by_unit: dict[str, list[str]] = {}
        for m in memberships:
            members_by_unit.setdefault(m.org_unit_id, []).append(m.agent_id)

        children_by_parent: dict[str | None, list[str]] = {}
        for u in units:
            children_by_parent.setdefault(u.parent_id, []).append(u.id)

        return [
            OrgUnit(
                id=u.id,
                parent_id=u.parent_id,
                name=u.name,
                description=u.description,
                head_agent_id=u.head_agent_id,
                icon=u.icon,
                color=u.color,
                sort_order=u.sort_order,
                member_agent_ids=sorted(members_by_unit.get(u.id, [])),
                child_unit_ids=sorted(children_by_parent.get(u.id, [])),
            )
            for u in units
        ]
