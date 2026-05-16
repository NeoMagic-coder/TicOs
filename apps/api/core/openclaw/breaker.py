"""Circuit-breaker wrapper for live tool adapters.

Every live adapter should call :func:`with_breaker` once at registration time::

    from apps.api.core.openclaw.breaker import with_breaker
    from apps.api.core.openclaw.executor import register_live_adapter

    register_live_adapter(
        "shopify_get_orders",
        with_breaker(
            tool_id="shopify_get_orders",
            adapter=_get_orders_live,
            mock_fallback=_get_orders_mock,
        ),
    )

State machine (pybreaker semantics):

- CLOSED  → calls pass through
- OPEN    → calls short-circuit straight to ``mock_fallback`` with a
            ``degraded=True`` envelope; the user-visible bar in the UI can
            light up to say "şu anda simülasyon modunda".
- HALF_OPEN → one trial call after ``reset_timeout`` seconds.

We catch *every* exception from the live call (network, 5xx mapped to
``HTTPStatusError``, parsing) and let the breaker count it as a failure.
Successful calls reset the counter automatically.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

import pybreaker

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

Adapter = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


_breakers: dict[str, pybreaker.CircuitBreaker] = {}


def get_breaker(tool_id: str) -> pybreaker.CircuitBreaker:
    """One breaker per tool_id, shared across calls and processes."""
    settings = get_settings()
    if tool_id not in _breakers:
        _breakers[tool_id] = pybreaker.CircuitBreaker(
            fail_max=settings.breaker_fail_max,
            reset_timeout=settings.breaker_reset_timeout_s,
            name=tool_id,
        )
    return _breakers[tool_id]


def with_breaker(
    *,
    tool_id: str,
    adapter: Adapter,
    mock_fallback: Adapter,
) -> Adapter:
    """Wrap ``adapter`` so failures trip a per-tool breaker and divert to
    ``mock_fallback``. Returned wrapper is itself an :data:`Adapter` and can
    be passed directly to ``register_live_adapter``.
    """
    breaker = get_breaker(tool_id)

    async def wrapped(payload: dict[str, Any]) -> dict[str, Any]:
        if breaker.current_state == pybreaker.STATE_OPEN:
            log.warning("breaker.open.short_circuit", tool_id=tool_id)
            data = await mock_fallback(payload)
            return _degraded(data, "circuit_open")

        try:
            # pybreaker's `call_async` runs the coroutine and updates state.
            return await breaker.call_async(adapter, payload)
        except pybreaker.CircuitBreakerError:
            log.warning("breaker.tripped", tool_id=tool_id)
            data = await mock_fallback(payload)
            return _degraded(data, "circuit_open")
        except Exception as exc:
            log.warning("breaker.adapter_failed", tool_id=tool_id, error=str(exc)[:200])
            data = await mock_fallback(payload)
            return _degraded(data, f"adapter_error: {type(exc).__name__}")

    return wrapped


def _degraded(data: dict[str, Any], reason: str) -> dict[str, Any]:
    """Stamp a degraded response so the orchestrator/UI can surface a banner."""
    return {**(data or {}), "degraded": True, "degraded_reason": reason}
