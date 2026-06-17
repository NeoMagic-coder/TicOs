"""Modal serverless sandbox backend.

Requires the ``modal`` package (``pip install modal``).
Sandboxes sleep when idle and wake on the next invocation — near-zero idle cost.
"""
from __future__ import annotations

import time

from apps.api.core.backends.base import CommandResult, ExecutionBackend, register_backend
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_DEFAULT_IMAGE = "python:3.12-slim"


@register_backend
class ModalBackend(ExecutionBackend):
    """Run commands in Modal.com serverless sandboxes."""

    backend_id = "modal"

    def __init__(self, image_name: str = _DEFAULT_IMAGE, timeout_s: float = 120.0) -> None:
        self._image_name = image_name
        self._timeout = timeout_s

    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        import asyncio
        import modal  # type: ignore[import]
        t0 = time.monotonic()
        try:
            image = modal.Image.from_registry(self._image_name)
            sb = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: modal.Sandbox.create(
                    image=image,
                    timeout=int(self._timeout),
                    **({"environment_variables": env} if env else {}),
                ),
            )
            proc = sb.exec("bash", "-c", cmd)
            stdout = proc.stdout.read()
            stderr = proc.stderr.read()
            proc.wait()
            await asyncio.get_event_loop().run_in_executor(None, sb.terminate)
            return CommandResult(
                exit_code=proc.returncode or 0,
                stdout=stdout,
                stderr=stderr,
                duration_ms=(time.monotonic() - t0) * 1000,
                backend_id=self.backend_id,
            )
        except Exception as exc:
            duration_ms = (time.monotonic() - t0) * 1000
            log.warning("backend.modal.error", cmd=cmd[:80], error=str(exc)[:200])
            return CommandResult(exit_code=1, stdout="", stderr=str(exc)[:500], duration_ms=duration_ms, backend_id=self.backend_id)

    async def health_check(self) -> bool:
        try:
            import modal  # type: ignore[import]
            return True
        except ImportError:
            return False

    async def cleanup(self) -> None:
        pass
