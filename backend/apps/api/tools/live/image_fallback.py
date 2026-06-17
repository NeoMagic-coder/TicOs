"""Image-generation fallback chain — STUB.

Today: ``brand_visual_generator`` is wired live to Gemini image generation in
``apps/api/core/llm/image.py``. This module will eventually wrap that adapter
in a chain:

    Gemini (primary) → Replicate / Stable Diffusion (fallback) → static placeholder

Phase 2 decision needed: Replicate (managed, pay-per-call) vs self-hosted
``stable-diffusion-xl`` behind a small inference service. Each has different
auth, cost profile, and latency budgets.

Credentials needed (Replicate path):
- ``REPLICATE_API_TOKEN``
- ``REPLICATE_MODEL``  (e.g. ``stability-ai/sdxl:7762fd07...``)
"""
from __future__ import annotations

from apps.api.core.logging import get_logger

log = get_logger(__name__)


def register() -> None:
    log.info("live.image_fallback.skipped", reason="stub_phase2")
