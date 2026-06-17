"""Output-language helpers for multi-language content generation.

The platform is Turkish-first: when the requested language is ``tr`` every
prompt stays exactly as it is today. For any other supported code a single
directive line is appended to the system prompt so agents, the Hermes merge
step and LLM-only tools produce their *user-visible* text in that language.
Internal event names, log fields and JSON keys stay untouched.
"""
from __future__ import annotations

DEFAULT_LANGUAGE = "tr"

# code → (native name, directive shown to the LLM)
SUPPORTED_LANGUAGES: dict[str, str] = {
    "tr": "Türkçe",
    "en": "English",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "ar": "العربية",
}


def normalize_language(code: str | None) -> str:
    """Lowercase + strip a language code; unknown codes fall back to Turkish."""
    normalized = (code or "").strip().lower()
    return normalized if normalized in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def language_directive(code: str | None) -> str:
    """Directive line appended to system prompts. Empty string for Turkish so
    existing prompts (already Turkish) are byte-for-byte unchanged."""
    lang = normalize_language(code)
    if lang == DEFAULT_LANGUAGE:
        return ""
    name = SUPPORTED_LANGUAGES[lang]
    return (
        f"\n\nÇIKTI DİLİ: Kullanıcıya görünen TÜM metni {name} ({lang}) dilinde üret. "
        f"JSON anahtarları, alan adları ve event isimleri değişmez — yalnızca "
        f"içerik metni {name} olur."
    )
