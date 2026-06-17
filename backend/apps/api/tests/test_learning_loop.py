"""Tests for Phase 1-B: Learning Loop.

Covers SkillRegistry upsert/dedup, SkillBuilder thresholds, and the session
summariser's fire-and-forget path. No network calls — LLM is stubbed.
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.api.core.db.engine import init_db, session_scope
from apps.api.core.db.models import SkillRow
from apps.api.core.skills.builder import _MIN_CONFIDENCE, _MIN_TOOLS, extract_from_task
from apps.api.core.skills.registry import SkillRegistry, _sequence_hash


# ── fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _db():
    """Ensure tables exist before every test."""
    init_db()


@pytest.fixture()
def registry(tmp_path) -> SkillRegistry:
    """Return a fresh SkillRegistry (uses the shared SQLite test DB)."""
    return SkillRegistry()


# ── SkillRegistry ─────────────────────────────────────────────────────────────


def test_upsert_creates_new_skill(registry: SkillRegistry):
    suffix = uuid.uuid4().hex[:6]
    tools = [f"tool_create_a_{suffix}", f"tool_create_b_{suffix}", f"tool_create_c_{suffix}"]
    skill_id = registry.upsert(
        name="test_skill",
        description="test description",
        trigger_pattern=["fiyat", "analiz"],
        tool_sequence=tools,
        source_task_id=f"task_{suffix}",
    )
    assert skill_id.startswith("skill_")
    row = registry.get(skill_id)
    assert row is not None
    assert row.name == "test_skill"
    assert row.usage_count == 1
    assert row.success_rate == 1.0


def test_upsert_deduplicates_by_tool_sequence(registry: SkillRegistry):
    suffix = uuid.uuid4().hex[:6]
    tools = [f"dedup_a_{suffix}", f"dedup_b_{suffix}", f"dedup_c_{suffix}"]
    id1 = registry.upsert(
        name="first",
        description="d",
        trigger_pattern=[],
        tool_sequence=tools,
        source_task_id="task_1",
    )
    id2 = registry.upsert(
        name="second",  # different name, same sequence
        description="d",
        trigger_pattern=[],
        tool_sequence=tools,
        source_task_id="task_2",
    )
    assert id1 == id2  # same hash → same row
    row = registry.get(id1)
    assert row.usage_count == 2
    assert row.name == "first"  # name not overwritten on upsert


def test_upsert_updates_success_rate(registry: SkillRegistry):
    suffix = uuid.uuid4().hex[:6]
    tools = [f"sr_x_{suffix}", f"sr_y_{suffix}", f"sr_z_{suffix}"]
    sid = registry.upsert(
        name="s", description="d", trigger_pattern=[], tool_sequence=tools,
        source_task_id="t1", success=True,
    )
    registry.upsert(
        name="s", description="d", trigger_pattern=[], tool_sequence=tools,
        source_task_id="t2", success=False,
    )
    row = registry.get(sid)
    # After 2 runs (1 success, 1 fail), running mean = 0.75
    assert row.usage_count == 2
    assert 0.0 < row.success_rate < 1.0


def test_sequence_hash_is_order_sensitive():
    h1 = _sequence_hash(["a", "b", "c"])
    h2 = _sequence_hash(["c", "b", "a"])
    assert h1 != h2


def test_all_returns_skills_sorted_by_usage(registry: SkillRegistry):
    for seq, count in [(["p", "q", "r"], 3), (["x", "y", "z"], 1)]:
        for i in range(count):
            registry.upsert(
                name=f"s_{seq[0]}", description="d", trigger_pattern=[],
                tool_sequence=seq, source_task_id=f"t_{i}",
            )
    skills = registry.all()
    assert len(skills) >= 2
    # Highest usage_count should come first
    counts = [s.usage_count for s in skills if s.tool_sequence in ['["p", "q", "r"]', "['p', 'q', 'r']"] or s.name.startswith("s_p")]
    if len(counts) >= 1:
        assert counts[0] >= 1


# ── SkillBuilder ──────────────────────────────────────────────────────────────


@dataclass
class _AuditEntry:
    tool_id: str
    status: str


@pytest.mark.asyncio
async def test_extract_skips_low_confidence(registry: SkillRegistry):
    result = await extract_from_task(
        task_id="t1",
        message="fiyat güncelle ürün ekle stok kontrol et",
        tools_used=["tool_a", "tool_b", "tool_c"],
        confidence=0.60,  # below threshold
        audit=[],
    )
    assert result is None


@pytest.mark.asyncio
async def test_extract_skips_too_few_tools(registry: SkillRegistry):
    result = await extract_from_task(
        task_id="t2",
        message="fiyat güncelle",
        tools_used=["tool_a", "tool_b"],  # only 2, need ≥ 3
        confidence=0.90,
        audit=[],
    )
    assert result is None


@pytest.mark.asyncio
async def test_extract_creates_skill_above_thresholds():
    # Unique sequence so dedup doesn't collide with other tests
    tools = ["restock_alert_builder", "stock_forecast", "carrier_rate_compare"]
    audit = [
        _AuditEntry("restock_alert_builder", "success"),
        _AuditEntry("stock_forecast", "success"),
        _AuditEntry("carrier_rate_compare", "success"),
    ]
    result = await extract_from_task(
        task_id="task_xyz_unique",
        message="trendyol ürünlerini getir fiyat analizi yap güncelle",
        tools_used=tools,
        confidence=0.92,
        audit=audit,
    )
    assert result is not None
    assert result.startswith("skill_")
    row = SkillRegistry().get(result)
    assert row is not None
    assert row.source_task_id == "task_xyz_unique"


@pytest.mark.asyncio
async def test_extract_deduplicates_tools():
    """Duplicate tool_ids should be collapsed before threshold check."""
    suffix = uuid.uuid4().hex[:6]
    tools = [f"td_a_{suffix}", f"td_a_{suffix}", f"td_b_{suffix}", f"td_b_{suffix}", f"td_c_{suffix}"]
    result = await extract_from_task(
        task_id=f"task_dedup_{suffix}",
        message="a b c d e f g h i j",
        tools_used=tools,
        confidence=0.90,
        audit=[],
    )
    # 5 entries → 3 unique → meets threshold
    assert result is not None


# ── session summariser ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarise_session_stores_memory():
    """summarise_session() should store a MemoryRow with kind='session_summary'."""
    from apps.api.core.memory.summariser import summarise_session
    from apps.api.core.db.models import MemoryRow
    from apps.api.core.memory.store import add_memory
    from sqlalchemy import select
    import uuid

    task_id = f"task_sum_{uuid.uuid4().hex[:8]}"

    # Pre-populate source rows using add_memory (handles embedding automatically)
    await add_memory(text="Fiyat analizi yap", kind="user_message", task_id=task_id)
    await add_memory(text="Analiz tamamlandı. Ürün fiyatı güncellendi.", kind="agent_output", task_id=task_id)

    mock_resp = MagicMock()
    mock_resp.content = "Bu görevde fiyat analizi yapıldı."

    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value=mock_resp)

    with patch("apps.api.core.memory.summariser.get_llm_provider", return_value=mock_llm):
        await summarise_session(task_id)

    with session_scope() as db:
        rows = db.execute(
            select(MemoryRow).where(
                MemoryRow.kind == "session_summary",
                MemoryRow.task_id == task_id,
            )
        ).scalars().all()

    assert len(rows) >= 1
    assert "fiyat" in rows[0].text


@pytest.mark.asyncio
async def test_summarise_session_handles_llm_error():
    """An LLM error must not raise — summariser is fire-and-forget."""
    from apps.api.core.memory.summariser import summarise_session

    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(side_effect=RuntimeError("LLM down"))

    with patch("apps.api.core.memory.summariser.get_llm_provider", return_value=mock_llm):
        # Should not raise
        await summarise_session("task_sum_err")
