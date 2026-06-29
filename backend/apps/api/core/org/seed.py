"""Default org chart for the OneProduct agent roster.

Maps the 22 seed agents (see ``apps.api.agents.seed.SEED_AGENTS``) into 5
top-level departments. Loaded idempotently on boot — missing units are
inserted, existing rows are left untouched so a user can re-org without
having their edits reverted.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentOrgMembershipRow, OrgUnitRow
from apps.api.core.logging import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class _SeedUnit:
    id: str
    name: str
    description: str
    head_agent_id: str
    icon: str
    color: str
    sort_order: int
    members: tuple[str, ...]


DEFAULT_ORG_UNITS: list[_SeedUnit] = [
    _SeedUnit(
        id="yonetim",
        name="Yönetim",
        description="Strateji, otonom karar ve müzakere — şirketin C-suite katmanı.",
        head_agent_id="supervisor",
        icon="🏛️",
        color="#6366f1",
        sort_order=0,
        members=("supervisor", "autonomous_decision_agent", "negotiation_agent"),
    ),
    _SeedUnit(
        id="pazarlama",
        name="Pazarlama",
        description="Marka, içerik, reklam, e-posta ve influencer çalışmaları.",
        head_agent_id="marketing_agent",
        icon="📣",
        color="#ec4899",
        sort_order=1,
        members=(
            "marketing_agent",
            "brand_identity_agent",
            "content_seo_agent",
            "email_crm_agent",
            "influencer_pr_agent",
            "growth_agent",
        ),
    ),
    _SeedUnit(
        id="operasyon",
        name="Operasyon",
        description="Sipariş, lojistik, mağaza kurulumu ve müşteri desteği.",
        head_agent_id="operations_agent",
        icon="⚙️",
        color="#f97316",
        sort_order=2,
        members=(
            "operations_agent",
            "logistics_agent",
            "support_agent",
            "store_setup_agent",
            "catalog_agent",
        ),
    ),
    _SeedUnit(
        id="finans",
        name="Finans & Analiz",
        description="Statik & dinamik fiyatlandırma, analitik ve itibar takibi.",
        head_agent_id="pricing_agent",
        icon="📊",
        color="#10b981",
        sort_order=3,
        members=(
            "pricing_agent",
            "dynamic_pricing_agent",
            "analytics_agent",
            "review_reputation_agent",
        ),
    ),
    _SeedUnit(
        id="arge",
        name="AR-GE & Uyum",
        description="Pazar araştırması, ürün geliştirme ve uyumluluk denetimleri.",
        head_agent_id="market_research_agent",
        icon="🔬",
        color="#0ea5e9",
        sort_order=4,
        members=(
            "market_research_agent",
            "product_development_agent",
            "compliance_agent",
            "legal_compliance_agent",
        ),
    ),
]

DEFAULT_MEMBERSHIPS: list[tuple[str, str, bool]] = [
    (agent_id, unit.id, agent_id == unit.head_agent_id)
    for unit in DEFAULT_ORG_UNITS
    for agent_id in unit.members
]


def seed_default_org() -> None:
    """Insert default units + memberships if not already present.

    Safe to call on every boot: existing rows (matched by primary key) are
    left as-is, so user edits stick. Logs a single summary at the end.
    """
    inserted_units = 0
    inserted_members = 0
    with session_scope() as s:
        existing_unit_ids = {u for (u,) in s.execute(select(OrgUnitRow.id)).all()}
        for unit in DEFAULT_ORG_UNITS:
            if unit.id in existing_unit_ids:
                continue
            s.add(OrgUnitRow(
                id=unit.id,
                parent_id=None,
                name=unit.name,
                description=unit.description,
                head_agent_id=unit.head_agent_id,
                icon=unit.icon,
                color=unit.color,
                sort_order=unit.sort_order,
            ))
            inserted_units += 1

        existing_member_ids = {a for (a,) in s.execute(select(AgentOrgMembershipRow.agent_id)).all()}
        for agent_id, unit_id, is_head in DEFAULT_MEMBERSHIPS:
            if agent_id in existing_member_ids:
                continue
            s.add(AgentOrgMembershipRow(
                agent_id=agent_id,
                org_unit_id=unit_id,
                title="Department Head" if is_head else "Member",
                is_head=is_head,
            ))
            inserted_members += 1

    log.info(
        "org.seed.done",
        units_inserted=inserted_units,
        members_inserted=inserted_members,
        units_total=len(DEFAULT_ORG_UNITS),
    )
