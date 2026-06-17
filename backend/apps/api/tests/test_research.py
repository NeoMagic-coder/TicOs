"""Tests for Phase 5: Research-Ready trajectory capture and export.

Covers TrajectoryCapture, list_trajectories, compress, and the HTTP endpoints
for batch execution and JSONL streaming export.
"""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.db.engine import init_db, session_scope
from apps.api.core.db.models import TrajectoryRow
from apps.api.core.research.trajectory import TrajectoryCapture
from apps.api.core.research.compressor import list_trajectories, mark_exported
from apps.api.main import create_app
from apps.api.models.schemas import AgentOutput

_app = create_app()


@pytest.fixture(autouse=True)
def _db():
    init_db()


# ── helpers ──────────────────────────────────────────────────────────────────


def _insert_traj(
    *,
    task_id: str | None = None,
    quality: float = 0.85,
    steps: list | None = None,
    exported: bool = False,
) -> str:
    uid = uuid.uuid4().hex[:8]
    task_id = task_id or f"task_test_{uid}"
    traj_id = f"traj_{uid}"
    with session_scope() as db:
        row = TrajectoryRow(
            id=traj_id,
            task_id=task_id,
            steps=steps or [{"role": "user", "content": "test"}],
            quality_score=quality,
            exported_at=datetime.now(UTC) if exported else None,
            created_at=datetime.now(UTC),
        )
        db.add(row)
    return traj_id


def _fake_agent_output(agent_id: str = "pricing_agent") -> AgentOutput:
    return AgentOutput(
        task_id="task_capture_test",
        agent_id=agent_id,
        status="completed",
        summary="Fiyat analizi tamamlandı.",
        content="Detaylı analiz: ...",
        confidence=0.91,
    )


# ── TrajectoryCapture ─────────────────────────────────────────────────────────


def test_capture_starts_with_user_step():
    tc = TrajectoryCapture(task_id="t1", user_message="fiyat analizi")
    assert len(tc.steps) == 1
    assert tc.steps[0]["role"] == "user"
    assert tc.steps[0]["content"] == "fiyat analizi"


def test_capture_record_agent_output_appends_step():
    tc = TrajectoryCapture(task_id="t2", user_message="ürün getir")
    output = _fake_agent_output()
    tc.record_agent_output(output, tool_ids=["trendyol_get_products", "price_optimizer"])
    assert len(tc.steps) == 2
    step = tc.steps[1]
    assert step["role"] == "assistant"
    assert step["agent_id"] == "pricing_agent"
    assert step["confidence"] == 0.91
    assert len(step["tool_calls"]) == 2
    assert step["tool_calls"][0]["tool_id"] == "trendyol_get_products"


def test_capture_finalize_persists_to_db():
    tc = TrajectoryCapture(task_id="task_fin_001", user_message="stok analizi")
    tc.record_agent_output(_fake_agent_output(), tool_ids=["stock_check"])
    tc.finalize(summary="Stok analizi tamamlandı.", confidence=0.88)

    with session_scope() as db:
        row = db.get(TrajectoryRow, tc.traj_id)
    assert row is not None
    assert row.task_id == "task_fin_001"
    assert row.quality_score == 0.88
    assert len(row.steps) == 3  # user + agent + final summary
    assert row.steps[-1]["content"] == "Stok analizi tamamlandı."


def test_capture_finalize_with_no_agent_outputs():
    tc = TrajectoryCapture(task_id="task_min_001", user_message="merhaba")
    tc.finalize(summary="Yanıt verildi.", confidence=0.70)

    with session_scope() as db:
        row = db.get(TrajectoryRow, tc.traj_id)
    assert row is not None
    assert len(row.steps) == 2  # user + final summary


# ── list_trajectories ─────────────────────────────────────────────────────────


def test_list_trajectories_quality_filter():
    _insert_traj(task_id="task_hi_q", quality=0.95)
    _insert_traj(task_id="task_lo_q", quality=0.30)

    results = list_trajectories(min_quality=0.80)
    ids = [r["task_id"] for r in results]
    assert "task_hi_q" in ids
    assert "task_lo_q" not in ids


def test_list_trajectories_unexported_only():
    _insert_traj(task_id="task_exported_01", quality=0.85, exported=True)
    _insert_traj(task_id="task_unexported_01", quality=0.85, exported=False)

    results = list_trajectories(unexported_only=True)
    ids = [r["task_id"] for r in results]
    assert "task_unexported_01" in ids
    assert "task_exported_01" not in ids


def test_list_trajectories_summary_shape():
    uid = uuid.uuid4().hex[:8]
    task_id = f"task_shape_{uid}"
    traj_id = _insert_traj(quality=0.75)
    # Retrieve directly by id to avoid cross-test pollution
    results = list_trajectories(min_quality=0.70)
    matching = [r for r in results if r["id"] == traj_id]
    assert len(matching) == 1
    r = matching[0]
    assert "id" in r
    assert "steps_count" in r
    assert "quality_score" in r
    assert "compressed_steps_count" in r


def test_mark_exported_sets_timestamp():
    traj_id = _insert_traj(task_id="task_mark_exp_01", quality=0.90)
    mark_exported([traj_id])

    with session_scope() as db:
        row = db.get(TrajectoryRow, traj_id)
    assert row.exported_at is not None


# ── GET /api/v1/research/trajectories ────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_trajectories_endpoint_returns_list():
    _insert_traj(task_id="task_ep_list_01", quality=0.80)

    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        resp = await client.get("/api/v1/research/trajectories?min_quality=0.5")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    ids = [r["task_id"] for r in data]
    assert "task_ep_list_01" in ids


@pytest.mark.asyncio
async def test_get_trajectory_by_id_returns_steps():
    traj_id = _insert_traj(
        steps=[{"role": "user", "content": "hi"}, {"role": "assistant", "content": "merhaba"}],
    )

    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        resp = await client.get(f"/api/v1/research/trajectories/{traj_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == traj_id
    assert len(data["steps"]) == 2


@pytest.mark.asyncio
async def test_get_trajectory_not_found_returns_404():
    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        resp = await client.get("/api/v1/research/trajectories/traj_nonexistent_xyz")
    assert resp.status_code == 404


# ── POST /api/v1/research/trajectories/{id}/compress ─────────────────────────


@pytest.mark.asyncio
async def test_compress_endpoint_success():
    traj_id = _insert_traj(
        steps=[{"role": "user", "content": "fiyat"}, {"role": "assistant", "content": "ok"}, {"role": "assistant", "content": "düzeltildi"}],
    )

    mock_resp = MagicMock()
    mock_resp.content = '[{"role": "user", "content": "fiyat"}, {"role": "assistant", "content": "düzeltildi"}]'

    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value=mock_resp)

    with patch("apps.api.core.research.compressor.get_llm_provider", return_value=mock_llm):
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
            resp = await client.post(f"/api/v1/research/trajectories/{traj_id}/compress")

    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    with session_scope() as db:
        row = db.get(TrajectoryRow, traj_id)
    assert row.compressed_steps is not None
    assert len(row.compressed_steps) == 2


@pytest.mark.asyncio
async def test_compress_endpoint_nonexistent_returns_422():
    mock_llm = AsyncMock()
    with patch("apps.api.core.research.compressor.get_llm_provider", return_value=mock_llm):
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
            resp = await client.post("/api/v1/research/trajectories/traj_ghost_xyz/compress")
    assert resp.status_code == 422


# ── POST /api/v1/research/export ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_export_returns_ndjson():
    _insert_traj(task_id="task_export_01", quality=0.85)
    _insert_traj(task_id="task_export_02", quality=0.90)

    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/research/export",
            json={"min_quality": 0.80, "unexported_only": False, "use_compressed": False},
        )

    assert resp.status_code == 200
    assert "ndjson" in resp.headers["content-type"]
    lines = [l for l in resp.text.strip().split("\n") if l]
    assert len(lines) >= 2
    # Each line must be valid JSON
    for line in lines:
        record = json.loads(line)
        assert "task_id" in record
        assert "steps" in record
        assert "quality_score" in record


@pytest.mark.asyncio
async def test_export_marks_exported():
    traj_id = _insert_traj(task_id="task_mark_on_export", quality=0.88, exported=False)

    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        await client.post(
            "/api/v1/research/export",
            json={"min_quality": 0.80, "unexported_only": False, "use_compressed": False},
        )

    with session_scope() as db:
        row = db.get(TrajectoryRow, traj_id)
    assert row.exported_at is not None


# ── POST /api/v1/research/batch ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_batch_runs_multiple_prompts():
    from apps.api.models.schemas import AgentOutput
    from apps.api.core.hermes.orchestrator import get_orchestrator

    mock_result = AgentOutput(
        task_id="batch_task", agent_id="pricing_agent",
        status="completed", summary="Sonuç.", confidence=0.88,
    )

    orch = get_orchestrator()
    with patch.object(orch, "handle", AsyncMock(return_value=mock_result)):
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/research/batch",
                json={"prompts": ["fiyat analizi", "stok kontrolü", "satış raporu"]},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["passed"] == 3
    assert len(data["results"]) == 3
    assert "error" not in data["results"][0]


@pytest.mark.asyncio
async def test_batch_handles_partial_failures():
    from apps.api.models.schemas import AgentOutput
    from apps.api.core.hermes.orchestrator import get_orchestrator

    call_count = 0

    async def _handle(**kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            raise RuntimeError("LLM timeout")
        return AgentOutput(
            task_id=f"t{call_count}", agent_id="a", status="completed",
            summary="ok", confidence=0.90,
        )

    orch = get_orchestrator()
    with patch.object(orch, "handle", _handle):
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/research/batch",
                json={"prompts": ["p1", "p2", "p3"]},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["passed"] == 2  # one failed
    errors = [r for r in data["results"] if "error" in r]
    assert len(errors) == 1
    assert "LLM timeout" in errors[0]["error"]


@pytest.mark.asyncio
async def test_batch_min_confidence_filter():
    from apps.api.models.schemas import AgentOutput
    from apps.api.core.hermes.orchestrator import get_orchestrator

    results_conf = [0.95, 0.50, 0.85]
    idx = 0

    async def _handle(**kwargs):
        nonlocal idx
        c = results_conf[idx]
        idx += 1
        return AgentOutput(
            task_id=f"bt{idx}", agent_id="a", status="completed",
            summary="ok", confidence=c,
        )

    orch = get_orchestrator()
    with patch.object(orch, "handle", _handle):
        async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/research/batch",
                json={"prompts": ["p1", "p2", "p3"], "min_confidence": 0.80},
            )

    data = resp.json()
    assert data["passed"] == 2   # 0.95 and 0.85 pass; 0.50 does not
    assert data["total"] == 3
