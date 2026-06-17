"""Multi-language output support — helper unit tests + orchestrator threading."""
from __future__ import annotations

from apps.api.core.llm.language import (
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    language_directive,
    normalize_language,
)


def test_normalize_known_codes():
    assert normalize_language("en") == "en"
    assert normalize_language("EN ") == "en"
    assert normalize_language("de") == "de"


def test_normalize_unknown_falls_back_to_turkish():
    assert normalize_language("xx") == DEFAULT_LANGUAGE
    assert normalize_language(None) == DEFAULT_LANGUAGE
    assert normalize_language("") == DEFAULT_LANGUAGE


def test_directive_empty_for_turkish():
    # Turkish is the platform default — prompts must stay byte-for-byte intact.
    assert language_directive("tr") == ""
    assert language_directive(None) == ""
    assert language_directive("unknown") == ""


def test_directive_names_target_language():
    for code, name in SUPPORTED_LANGUAGES.items():
        if code == DEFAULT_LANGUAGE:
            continue
        directive = language_directive(code)
        assert name in directive
        assert code in directive
