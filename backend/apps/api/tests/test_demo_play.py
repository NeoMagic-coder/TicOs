"""Tests for the compressed-demo playback endpoint ``POST /api/v1/demo/play``.

Drives the route at the highest speed_multiplier (600) so the test
finishes in seconds, parses the SSE frames, and asserts the 6-step
contract: 6 start + 6 end + 1 summary event, all rows persisted, and
auto + escalated tally equals task_count.
"""
from __future__ import annotations

import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from apps.api.core.config import get_settings
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import DemoResultRow
from apps.api.main import create_app


def _fresh_app():
    get_settings.cache_clear()  # type: ignore[attr-defined]
    return create_app()


def _parse_sse(text: str) -> list[tuple[str, dict]]:
    """Split a raw SSE response body into [(event, data_dict), ...]."""
    frames: list[tuple[str, dict]] = []
    for block in text.split("\n\n"):
        block = block.strip()
        if not block:
            continue
        event = "message"
        data_line = ""
        for line in block.splitlines():
            if line.startswith("event:"):
                event = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data_line = line[len("data:"):].strip()
        if data_line:
            frames.append((event, json.loads(data_line)))
    return frames


@pytest.mark.asyncio
async def test_demo_play_runs_six_steps_and_persists_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.delenv("DAILY_BUDGET_MAX_USD", raising=False)

    app = _fresh_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with client.stream(
            "POST",
            "/api/v1/demo/play",
            json={"scenario": "3hour_race", "speed_multiplier": 600},
        ) as response:
            assert response.status_code == 200
            body = ""
            async for chunk in response.aiter_text():
                body += chunk

    frames = _parse_sse(body)
    starts = [f for f in frames if f[0] == "step_started"]
    ends = [f for f in frames if f[0] == "step_completed"]
    summaries = [f for f in frames if f[0] == "summary"]

    assert len(starts) == 6, f"expected 6 step_started frames, got {len(starts)}"
    assert len(ends) == 6, f"expected 6 step_completed frames, got {len(ends)}"
    assert len(summaries) == 1, "expected exactly one summary frame"

    summary = summaries[0][1]
    session_id = summary["session_id"]
    assert summary["task_count"] == 6
    tally = summary["auto_decisions_vs_escalations"]
    assert tally["auto"] + tally["escalated"] == 6

    # All 6 rows persisted under this session_id
    with session_scope() as s:
        rows = s.execute(
            select(DemoResultRow).where(DemoResultRow.session_id == session_id)
        ).scalars().all()
    assert len(rows) == 6
    assert {r.step_name for r in rows} == {
        "product_analysis",
        "brand_identity_generation",
        "pricing_optimization",
        "trendyol_listing",
        "negotiation_with_supplier",
        "roi_calculation",
    }
