"""Paperclip-style organisational layer (departments + agent memberships).

Sits on top of the flat ``AgentSpec`` registry to give the 22 agents a
reporting structure: 5 departments, each with a head agent and a list of
members. Mirrors paperclip's *"OpenClaw is the employee, Paperclip is the
company"* model — units roll up under a CEO (the supervisor agent).
"""
from apps.api.core.org.seed import DEFAULT_ORG_UNITS, DEFAULT_MEMBERSHIPS, seed_default_org
from apps.api.core.org.service import get_org_snapshot

__all__ = [
    "DEFAULT_ORG_UNITS",
    "DEFAULT_MEMBERSHIPS",
    "seed_default_org",
    "get_org_snapshot",
]
