"""Circuit-breaker state machine tests for the OpenClaw live-adapter wrapper.

Covers the three transitions that matter operationally:

  1. CLOSED → OPEN after N consecutive failures (fail_max).
  2. OPEN short-circuits to mock fallback with degraded=True flag (does
     NOT call the live adapter).
  3. OPEN → HALF_OPEN → CLOSED when the trial call succeeds after the
     reset_timeout window.
  4. OPEN → HALF_OPEN → OPEN when the trial call fails again.

The pybreaker library does not expose a public clock; we patch its
internal monotonic clock to fast-forward through reset_timeout so the
tests don't have to sleep.

Run:
    pytest apps/api/tests/test_breaker.py -q
"""
from __future__ import annotations

import asyncio

import pybreaker
import pytest

from apps.api.core.openclaw import breaker as breaker_mod


@pytest.fixture(autouse=True)
def reset_breakers():
    """Each test starts with a fresh per-tool breaker + status table."""
    breaker_mod._breakers.clear()
    breaker_mod.last_status.clear()
    yield
    breaker_mod._breakers.clear()
    breaker_mod.last_status.clear()


async def _ok_mock(payload):
    return {"ok": True, "source": "mock"}


def _failing_adapter(*, n_failures: int):
    """Adapter that raises ConnectionError on the first ``n_failures`` calls,
    then succeeds. Lets each test simulate a flaky upstream."""
    state = {"calls": 0}

    async def adapter(payload):
        state["calls"] += 1
        if state["calls"] <= n_failures:
            raise ConnectionError(f"upstream down (call #{state['calls']})")
        return {"ok": True, "source": "live", "call": state["calls"]}

    return adapter, state


@pytest.mark.asyncio
async def test_closed_to_open_after_fail_max() -> None:
    """N consecutive adapter errors should trip the breaker to OPEN."""
    fail_max = 5  # matches Settings.breaker_fail_max default
    adapter, state = _failing_adapter(n_failures=fail_max + 5)
    wrapped = breaker_mod.with_breaker(
        tool_id="t_flaky_open",
        adapter=adapter,
        mock_fallback=_ok_mock,
    )
    br = breaker_mod.get_breaker("t_flaky_open")

    # Drive fail_max failures.
    for i in range(fail_max):
        out = await wrapped({})
        assert out["degraded"] is True, f"call {i} should fall back to mock"
        assert out["source"] == "mock"

    # After fail_max consecutive failures the breaker must be OPEN.
    assert br.current_state == pybreaker.STATE_OPEN
    # Subsequent call short-circuits — the live adapter is NOT invoked.
    calls_before = state["calls"]
    out = await wrapped({})
    assert out["degraded"] is True
    assert out["degraded_reason"] == "circuit_open"
    assert state["calls"] == calls_before, "OPEN must short-circuit; adapter not called"
    assert breaker_mod.last_status["t_flaky_open"]["degraded"] is True


@pytest.mark.asyncio
async def test_half_open_trial_success_closes_breaker(monkeypatch) -> None:
    """After reset_timeout, the next call is a HALF_OPEN trial; if it
    succeeds, the breaker closes and degraded flag clears."""
    fail_max = 5
    # 5 failures then permanent success.
    adapter, state = _failing_adapter(n_failures=fail_max)
    wrapped = breaker_mod.with_breaker(
        tool_id="t_recovery",
        adapter=adapter,
        mock_fallback=_ok_mock,
    )
    br = breaker_mod.get_breaker("t_recovery")

    for _ in range(fail_max):
        await wrapped({})
    assert br.current_state == pybreaker.STATE_OPEN

    # Fast-forward past reset_timeout by rewinding the breaker's opened_at
    # timestamp. pybreaker's CircuitOpenState compares
    # ``datetime.utcnow() - opened_at`` against reset_timeout to gate
    # HALF_OPEN, so we make `opened_at` look ancient.
    from datetime import datetime, timedelta
    br._state_storage.opened_at = datetime.utcnow() - timedelta(seconds=br.reset_timeout + 1)

    # Trial call: adapter succeeds → breaker closes.
    out = await wrapped({})
    assert out.get("source") == "live", f"trial call should hit live adapter, got {out}"
    assert "degraded" not in out or out.get("degraded") is False
    assert br.current_state == pybreaker.STATE_CLOSED
    assert breaker_mod.last_status["t_recovery"]["degraded"] is False


@pytest.mark.asyncio
async def test_half_open_trial_failure_returns_to_open(monkeypatch) -> None:
    """If the HALF_OPEN trial call fails, breaker must re-OPEN (not close)
    and subsequent calls keep short-circuiting."""
    fail_max = 5
    # 5 + 1 + many failures so the trial call also fails.
    adapter, _ = _failing_adapter(n_failures=fail_max + 100)
    wrapped = breaker_mod.with_breaker(
        tool_id="t_relapse",
        adapter=adapter,
        mock_fallback=_ok_mock,
    )
    br = breaker_mod.get_breaker("t_relapse")

    for _ in range(fail_max):
        await wrapped({})
    assert br.current_state == pybreaker.STATE_OPEN

    from datetime import datetime, timedelta
    br._state_storage.opened_at = datetime.utcnow() - timedelta(seconds=br.reset_timeout + 1)

    # Trial call: adapter still failing → breaker should snap back to OPEN.
    out = await wrapped({})
    assert out["degraded"] is True
    assert br.current_state == pybreaker.STATE_OPEN, (
        f"After failed HALF_OPEN trial, breaker should re-OPEN, got {br.current_state}"
    )

    # Stay-OPEN guarantee: an immediate follow-up call must still short-circuit.
    out2 = await wrapped({})
    assert out2["degraded"] is True
    assert out2["degraded_reason"] == "circuit_open"


@pytest.mark.asyncio
async def test_intermittent_failures_under_fail_max_keep_breaker_closed() -> None:
    """4 fails / 1 success / 4 fails should NOT trip a breaker with
    fail_max=5, because pybreaker counts consecutive failures and a
    success resets the counter."""
    fail_max = 5
    state = {"i": 0}

    async def adapter(payload):
        state["i"] += 1
        # Pattern: fail, fail, fail, fail, ok, fail, fail, fail, fail
        if state["i"] in {5}:
            return {"ok": True, "source": "live", "call": state["i"]}
        raise ConnectionError("flaky")

    wrapped = breaker_mod.with_breaker(
        tool_id="t_intermittent",
        adapter=adapter,
        mock_fallback=_ok_mock,
    )
    br = breaker_mod.get_breaker("t_intermittent")

    for _ in range(9):
        await wrapped({})

    # 4 consecutive fails after the reset, < fail_max=5 → still CLOSED.
    assert br.current_state == pybreaker.STATE_CLOSED


@pytest.mark.asyncio
async def test_open_response_carries_degraded_envelope() -> None:
    """User-facing contract: when degraded, the response always includes
    `degraded: True` and a machine-readable `degraded_reason` (the UI
    shows the 'simülasyon modu' banner from this flag)."""
    fail_max = 5
    adapter, _ = _failing_adapter(n_failures=fail_max + 1)
    wrapped = breaker_mod.with_breaker(
        tool_id="t_envelope",
        adapter=adapter,
        mock_fallback=_ok_mock,
    )
    for _ in range(fail_max):
        await wrapped({})
    out = await wrapped({})
    assert out["degraded"] is True
    assert isinstance(out["degraded_reason"], str)
    assert out["degraded_reason"]
