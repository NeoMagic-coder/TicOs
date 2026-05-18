from __future__ import annotations

import asyncio

import pytest

from apps.api.core.openclaw.executor import (
    ExecutionContext, OpenClawExecutor, PermissionDenied, ToolNotFound,
)
from apps.api.core.openclaw.registry import get_registry


@pytest.mark.asyncio
async def test_execute_in_mock_mode():
    executor = OpenClawExecutor()
    result = await executor.execute(
        tool_id="competitor_profile_builder", agent_id="market_research_agent",
        payload={"niche": "yanmaz tencere"},
    )
    assert result.status == "success"
    assert result.duration_ms >= 0
    assert "tool_id" in result.output


@pytest.mark.asyncio
async def test_permission_denied():
    executor = OpenClawExecutor()
    with pytest.raises(PermissionDenied):
        await executor.execute(
            tool_id="competitor_profile_builder", agent_id="support_agent", payload={"niche": "x"},
        )


@pytest.mark.asyncio
async def test_unknown_tool_raises():
    executor = OpenClawExecutor()
    with pytest.raises(ToolNotFound):
        await executor.execute(
            tool_id="this_tool_does_not_exist", agent_id="supervisor", payload={},
        )


@pytest.mark.asyncio
async def test_audit_logging():
    executor = OpenClawExecutor()
    ctx = ExecutionContext(agent_id="market_research_agent", task_id="t_test")
    await executor.execute(
        tool_id="competitor_profile_builder", agent_id="market_research_agent",
        payload={"niche": "x"}, ctx=ctx,
    )
    assert len(ctx.audit) == 1
    assert ctx.audit[0].tool_id == "competitor_profile_builder"
    assert ctx.cost_so_far_usd > 0


@pytest.mark.asyncio
async def test_concurrent_executions():
    executor = OpenClawExecutor()
    results = await asyncio.gather(*[
        executor.execute(
            tool_id="competitor_profile_builder", agent_id="market_research_agent",
            payload={"niche": f"n{i}"},
        ) for i in range(5)
    ])
    assert all(r.status == "success" for r in results)
