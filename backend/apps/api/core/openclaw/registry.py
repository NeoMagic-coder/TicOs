"""Self-describing tool registry. Loads manifests from JSON files on disk."""
from __future__ import annotations

import json
from pathlib import Path

from apps.api.core.logging import get_logger
from apps.api.models.schemas import ToolManifest

log = get_logger(__name__)

MANIFEST_DIR = Path(__file__).parent.parent.parent / "tools" / "manifests"


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolManifest] = {}
        self._loaded = False

    def load_manifests(self, directory: Path | None = None) -> int:
        target = directory or MANIFEST_DIR
        count = 0
        if not target.exists():
            log.warning("registry.no_manifest_dir", path=str(target))
            self._loaded = True
            return 0

        for path in target.rglob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(payload, list):
                    for item in payload:
                        tool = ToolManifest.model_validate(item)
                        self._tools[tool.tool_id] = tool
                        count += 1
                else:
                    tool = ToolManifest.model_validate(payload)
                    self._tools[tool.tool_id] = tool
                    count += 1
            except Exception as exc:
                log.error("registry.bad_manifest", path=str(path), error=str(exc))

        self._loaded = True
        log.info("registry.loaded", count=count, dir=str(target))
        return count

    def get(self, tool_id: str) -> ToolManifest | None:
        if not self._loaded:
            self.load_manifests()
        return self._tools.get(tool_id)

    def all(self) -> list[ToolManifest]:
        if not self._loaded:
            self.load_manifests()
        return list(self._tools.values())

    def search(self, *, category: str | None = None, tag: str | None = None, agent_id: str | None = None) -> list[ToolManifest]:
        results = self.all()
        if category:
            results = [t for t in results if t.category == category]
        if tag:
            results = [t for t in results if tag in t.tags]
        if agent_id:
            results = [t for t in results if agent_id in t.allowed_agents or not t.allowed_agents]
        return results

    def is_allowed(self, tool_id: str, agent_id: str) -> bool:
        tool = self.get(tool_id)
        if tool is None:
            return False
        if not tool.allowed_agents:
            return True
        return agent_id in tool.allowed_agents


_registry: ToolRegistry | None = None


def get_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
        _registry.load_manifests()
    return _registry
