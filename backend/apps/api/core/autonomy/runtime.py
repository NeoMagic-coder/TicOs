"""In-process autonomy runtime flags (scheduler + API share this state)."""
from __future__ import annotations

from typing import Any

_RUNTIME: dict[str, Any] = {
    "enabled": True,
    "auto_sync": True,
    "auto_brief": True,
    "auto_approve_low_risk": True,
    "auto_goal_loop": True,
}


def get_autonomy_mode() -> dict[str, Any]:
    return dict(_RUNTIME)


def patch_autonomy_mode(**updates: Any) -> dict[str, Any]:
    for key, val in updates.items():
        if key in _RUNTIME and val is not None:
            _RUNTIME[key] = bool(val) if isinstance(_RUNTIME[key], bool) else val
    return get_autonomy_mode()


def autonomy_enabled() -> bool:
    return bool(_RUNTIME.get("enabled", True))
