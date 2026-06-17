"""Daytona workspace backend.

Uses the Daytona REST API to create or resume a workspace, execute commands,
and optionally stop the workspace after use. Set DAYTONA_API_KEY + DAYTONA_SERVER_URL.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from apps.api.core.backends.base import CommandResult, ExecutionBackend, register_backend
from apps.api.core.logging import get_logger

log = get_logger(__name__)


@register_backend
class DaytonaBackend(ExecutionBackend):
    """Run commands in a Daytona managed workspace."""

    backend_id = "daytona"

    def __init__(
        self,
        server_url: str = "",
        api_key: str = "",
        workspace_id: str = "",
        timeout_s: float = 60.0,
    ) -> None:
        self._url = server_url.rstrip("/")
        self._api_key = api_key
        self._workspace_id = workspace_id
        self._timeout = timeout_s

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        if not self._url or not self._api_key:
            return CommandResult(exit_code=1, stdout="", stderr="Daytona not configured", duration_ms=0, backend_id=self.backend_id)
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=self._timeout + 5) as client:
                resp = await client.post(
                    f"{self._url}/workspace/{self._workspace_id}/exec",
                    headers=self._headers(),
                    json={"command": cmd, "env": env or {}},
                )
                resp.raise_for_status()
                data: dict[str, Any] = resp.json()
            return CommandResult(
                exit_code=int(data.get("exit_code", 0)),
                stdout=str(data.get("stdout", "")),
                stderr=str(data.get("stderr", "")),
                duration_ms=(time.monotonic() - t0) * 1000,
                backend_id=self.backend_id,
            )
        except Exception as exc:
            duration_ms = (time.monotonic() - t0) * 1000
            log.warning("backend.daytona.error", cmd=cmd[:80], error=str(exc)[:200])
            return CommandResult(exit_code=1, stdout="", stderr=str(exc)[:500], duration_ms=duration_ms, backend_id=self.backend_id)

    async def health_check(self) -> bool:
        if not self._url:
            return False
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self._url}/health", headers=self._headers())
                return r.status_code < 400
        except Exception:
            return False

    async def cleanup(self) -> None:
        pass
