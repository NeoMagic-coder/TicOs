"""Klaviyo (or Mailchimp) live adapter — STUB.

Decision pending: Klaviyo *or* Mailchimp. They have incompatible APIs:
- Klaviyo: JSON:API style, ``revision`` header, private API key (no OAuth).
- Mailchimp: REST + OAuth, data-center-prefixed base URL.

Phase 2 scope (Klaviyo path, assuming that's chosen):
- Profiles + Lists + Segments + Flows endpoints.
- ``add_to_segment``: POST ``/api/profiles/`` with list relationships.
- ``send_flow``: trigger via Events API.
- Rate-limit: 75 req/s burst, 700 req/min steady-state. Honor ``Retry-After``
  on 429 with exponential backoff capped at 30s.

Credentials needed:
- ``KLAVIYO_PRIVATE_API_KEY``  (pk_ prefix)
- ``KLAVIYO_API_REVISION``     (e.g. ``2024-10-15``)
"""
from __future__ import annotations

from apps.api.core.logging import get_logger

log = get_logger(__name__)


def register() -> None:
    log.info("live.klaviyo.skipped", reason="stub_phase2")
