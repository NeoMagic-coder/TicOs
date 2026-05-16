"""SSH remote execution backend via asyncssh.

Requires the ``asyncssh`` package (``pip install asyncssh``).
Connection is created per ``execute_command`` call; no persistent session.
"""
from __future__ import annotations

import time

from apps.api.core.backends.base import CommandResult, ExecutionBackend, register_backend
from apps.api.core.logging import get_logger

log = get_logger(__name__)


@register_backend
class SSHBackend(ExecutionBackend):
    """Execute commands on a remote host over SSH."""

    backend_id = "ssh"

    def __init__(
        self,
        host: str = "",
        port: int = 22,
        username: str = "",
        key_path: str = "",
        timeout_s: float = 30.0,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._key_path = key_path
        self._timeout = timeout_s

    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        import asyncssh  # type: ignore[import]
        t0 = time.monotonic()
        connect_opts: dict = {
            "host": self._host,
            "port": self._port,
            "known_hosts": None,
        }
        if self._username:
            connect_opts["username"] = self._username
        if self._key_path:
            connect_opts["client_keys"] = [self._key_path]
        if env:
            env_prefix = " ".join(f"{k}={v}" for k, v in env.items())
            cmd = f"{env_prefix} {cmd}"
        try:
            async with asyncssh.connect(**connect_opts) as conn:
                result = await conn.run(cmd, timeout=self._timeout)
            return CommandResult(
                exit_code=result.exit_status or 0,
                stdout=result.stdout or "",
                stderr=result.stderr or "",
                duration_ms=(time.monotonic() - t0) * 1000,
                backend_id=self.backend_id,
            )
        except Exception as exc:
            duration_ms = (time.monotonic() - t0) * 1000
            log.warning("backend.ssh.error", host=self._host, error=str(exc)[:200])
            return CommandResult(exit_code=1, stdout="", stderr=str(exc)[:500], duration_ms=duration_ms, backend_id=self.backend_id)

    async def health_check(self) -> bool:
        if not self._host:
            return False
        result = await self.execute_command("echo ok")
        return result.ok and "ok" in result.stdout

    async def cleanup(self) -> None:
        pass
