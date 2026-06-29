"""Vercel Sandbox backend (edge-function isolated execution).

Uses the Vercel Sandbox REST API. Requires VERCEL_TOKEN + VERCEL_TEAM_ID.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from apps.api.core.backends.base import CommandResult, ExecutionBackend, register_backend
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_VERCEL_API = "https://api.vercel.com"


@register_backend
class VercelBackend(ExecutionBackend):
    """Run commands in Vercel Sandbox environments."""

    backend_id = "vercel"

    def __init__(
        self,
        token: str = "",
        team_id: str = "",
        timeout_s: float = 30.0,
    ) -> None:
        self._token = token
        self._team_id = team_id
        self._timeout = timeout_s

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}

    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        if not self._token:
            return CommandResult(exit_code=1, stdout="", stderr="Vercel token not configured", duration_ms=0, backend_id=self.backend_id)
        t0 = time.monotonic()
        params = {"teamId": self._team_id} if self._team_id else {}
        try:
            async with httpx.AsyncClient(timeout=self._timeout + 5) as client:
                # Create sandbox
                create_resp = await client.post(
                    f"{_VERCEL_API}/v1/sandbox",
                    headers=self._headers(),
                    params=params,
                    json={"env": env or {}},
                )
                create_resp.raise_for_status()
                sandbox_id = create_resp.json()["id"]
                # Execute command
                exec_resp = await client.post(
                    f"{_VERCEL_API}/v1/sandbox/{sandbox_id}/exec",
                    headers=self._headers(),
                    params=params,
                    json={"command": cmd},
                )
                exec_resp.raise_for_status()
                data: dict[str, Any] = exec_resp.json()
                # Delete sandbox
                await client.delete(
                    f"{_VERCEL_API}/v1/sandbox/{sandbox_id}",
                    headers=self._headers(),
                    params=params,
                )
            return CommandResult(
                exit_code=int(data.get("exit_code", 0)),
                stdout=str(data.get("stdout", "")),
                stderr=str(data.get("stderr", "")),
                duration_ms=(time.monotonic() - t0) * 1000,
                backend_id=self.backend_id,
            )
        except Exception as exc:
            duration_ms = (time.monotonic() - t0) * 1000
            log.warning("backend.vercel.error", cmd=cmd[:80], error=str(exc)[:200])
            return CommandResult(exit_code=1, stdout="", stderr=str(exc)[:500], duration_ms=duration_ms, backend_id=self.backend_id)

    async def health_check(self) -> bool:
        return bool(self._token)

    async def cleanup(self) -> None:
        pass
