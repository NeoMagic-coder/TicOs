"""Abstract execution backend contract."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    backend_id: str

    @property
    def ok(self) -> bool:
        return self.exit_code == 0


class ExecutionBackend(ABC):
    """Abstract base for all execution environments.

    Concrete backends implement command execution in a specific runtime
    (local subprocess, Docker container, SSH remote, serverless sandbox).

    The backend is stateless per-invocation — no session is expected to
    persist between calls unless the concrete implementation provides it.
    """

    backend_id: str

    @abstractmethod
    async def execute_command(self, cmd: str, env: dict[str, str] | None = None) -> CommandResult:
        """Run a shell command and return its output."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the backend is reachable and ready."""

    @abstractmethod
    async def cleanup(self) -> None:
        """Release any resources held by this backend instance."""

    def to_dict(self) -> dict[str, Any]:
        return {"backend_id": self.backend_id, "type": type(self).__name__}


# Registry of known backend constructors — populated by each module on import.
_BACKEND_REGISTRY: dict[str, type[ExecutionBackend]] = {}


def register_backend(cls: type[ExecutionBackend]) -> type[ExecutionBackend]:
    """Decorator to register a backend class under its backend_id."""
    _BACKEND_REGISTRY[cls.backend_id] = cls
    return cls


def get_backend_class(backend_id: str) -> type[ExecutionBackend] | None:
    return _BACKEND_REGISTRY.get(backend_id)


def list_backend_ids() -> list[str]:
    return sorted(_BACKEND_REGISTRY.keys())
