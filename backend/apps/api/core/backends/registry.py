"""Backend registry — loads and health-checks all registered backends.

Import this module to trigger registration of all concrete backends.
"""
from __future__ import annotations

import asyncio
from typing import Any

from apps.api.core.backends.base import ExecutionBackend, get_backend_class, list_backend_ids
from apps.api.core.logging import get_logger

log = get_logger(__name__)

# Import all backend modules to trigger @register_backend decorators
from apps.api.core.backends import (  # noqa: F401, E402
    local,
    docker_backend,
    ssh_backend,
    modal_backend,
    daytona_backend,
    vercel_backend,
)

_instances: dict[str, ExecutionBackend] = {}


def get_backend(backend_id: str) -> ExecutionBackend | None:
    """Return a singleton backend instance, constructing it on first use."""
    if backend_id not in _instances:
        cls = get_backend_class(backend_id)
        if cls is None:
            return None
        _instances[backend_id] = _build_instance(backend_id, cls)
    return _instances.get(backend_id)


def _build_instance(backend_id: str, cls: type[ExecutionBackend]) -> ExecutionBackend:
    """Construct a backend, injecting credentials from settings where available."""
    from apps.api.core.config import get_settings
    s = get_settings()

    if backend_id == "local":
        return cls()  # type: ignore[call-arg]
    if backend_id == "docker":
        return cls()  # type: ignore[call-arg]
    if backend_id == "ssh":
        return cls(  # type: ignore[call-arg]
            host=getattr(s, "ssh_host", ""),
            port=int(getattr(s, "ssh_port", 22) or 22),
            username=getattr(s, "ssh_user", ""),
            key_path=getattr(s, "ssh_key_path", ""),
        )
    if backend_id == "modal":
        return cls()  # type: ignore[call-arg]
    if backend_id == "daytona":
        return cls(  # type: ignore[call-arg]
            server_url=getattr(s, "daytona_server_url", ""),
            api_key=getattr(s, "daytona_api_key", ""),
            workspace_id=getattr(s, "daytona_workspace_id", ""),
        )
    if backend_id == "vercel":
        return cls(  # type: ignore[call-arg]
            token=getattr(s, "vercel_token", ""),
            team_id=getattr(s, "vercel_team_id", ""),
        )
    return cls()  # type: ignore[call-arg]


async def health_check_all() -> list[dict[str, Any]]:
    """Parallel health check across all registered backends."""
    ids = list_backend_ids()

    async def _check(bid: str) -> dict[str, Any]:
        backend = get_backend(bid)
        if backend is None:
            return {"backend_id": bid, "healthy": False, "error": "not found"}
        try:
            healthy = await asyncio.wait_for(backend.health_check(), timeout=5.0)
            return {"backend_id": bid, "healthy": healthy, "type": type(backend).__name__}
        except Exception as exc:
            return {"backend_id": bid, "healthy": False, "error": str(exc)[:120]}

    return await asyncio.gather(*[_check(bid) for bid in ids])
