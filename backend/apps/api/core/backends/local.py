"""Local subprocess backend — wraps asyncio.create_subprocess_shell."""
from __future__ import annotations

import asyncio
import os
import time

from apps.api.core.backends.base import CommandResult, ExecutionBackend, register_backend
from apps.api.core.logging import get_logger

log = get_logger(__name__)


@register_backend
class LocalBackend(ExecutionBackend):
    """Run commands in the local process environment via asyncio subprocess."""

    backend_id = "local"

    def __init__(self, timeout_s: float = 30.0) -> None:
        self._timeout = timeout_s

    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        merged_env = {**os.environ, **(env or {})}
        t0 = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=merged_env,
            )
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=self._timeout)
            duration_ms = (time.monotonic() - t0) * 1000
            return CommandResult(
                exit_code=proc.returncode or 0,
                stdout=stdout_b.decode(errors="replace"),
                stderr=stderr_b.decode(errors="replace"),
                duration_ms=duration_ms,
                backend_id=self.backend_id,
            )
        except asyncio.TimeoutError:
            duration_ms = (time.monotonic() - t0) * 1000
            log.warning("backend.local.timeout", cmd=cmd[:80])
            return CommandResult(exit_code=124, stdout="", stderr="timeout", duration_ms=duration_ms, backend_id=self.backend_id)

    async def health_check(self) -> bool:
        result = await self.execute_command("echo ok")
        return result.ok

    async def cleanup(self) -> None:
        pass
