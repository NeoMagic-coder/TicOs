"""Docker container backend — runs commands in ephemeral containers.

Requires the ``docker`` Python package (``pip install docker``).
Falls back gracefully to unavailable status if Docker socket is absent.
"""
from __future__ import annotations

import time
from typing import Any

from apps.api.core.backends.base import CommandResult, ExecutionBackend, register_backend
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_DEFAULT_IMAGE = "python:3.12-slim"


@register_backend
class DockerBackend(ExecutionBackend):
    """Run commands inside ephemeral Docker containers.

    Each ``execute_command`` call spins up a fresh container, runs the
    command, and removes the container on exit.
    """

    backend_id = "docker"

    def __init__(self, image: str = _DEFAULT_IMAGE, timeout_s: float = 60.0) -> None:
        self._image = image
        self._timeout = timeout_s
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            import docker  # type: ignore[import]
            self._client = docker.from_env()
        return self._client

    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        import asyncio
        t0 = time.monotonic()
        try:
            client = self._get_client()
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.containers.run(
                    self._image,
                    cmd,
                    remove=True,
                    environment=env or {},
                    stdout=True,
                    stderr=True,
                    timeout=int(self._timeout),
                ),
            )
            stdout = result.decode(errors="replace") if isinstance(result, bytes) else str(result)
            return CommandResult(
                exit_code=0,
                stdout=stdout,
                stderr="",
                duration_ms=(time.monotonic() - t0) * 1000,
                backend_id=self.backend_id,
            )
        except Exception as exc:
            duration_ms = (time.monotonic() - t0) * 1000
            log.warning("backend.docker.error", cmd=cmd[:80], error=str(exc)[:200])
            exit_code = getattr(exc, "exit_status", 1)
            stderr = str(exc)[:500]
            return CommandResult(exit_code=exit_code, stdout="", stderr=stderr, duration_ms=duration_ms, backend_id=self.backend_id)

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            client.ping()
            return True
        except Exception:
            return False

    async def cleanup(self) -> None:
        self._client = None
