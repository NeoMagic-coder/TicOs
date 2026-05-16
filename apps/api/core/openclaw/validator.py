"""JSON Schema-based input/output validation for tool calls."""
from __future__ import annotations

from typing import Any

from jsonschema import Draft202012Validator, ValidationError


class ToolValidationError(Exception):
    def __init__(self, message: str, path: list[Any] | None = None) -> None:
        super().__init__(message)
        self.path = path or []


def validate_payload(payload: dict[str, Any], schema: dict[str, Any]) -> None:
    if not schema:
        return
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if errors:
        first: ValidationError = errors[0]
        raise ToolValidationError(first.message, list(first.absolute_path))
