"""Turkish natural-language → cron expression parser.

Accepts informal scheduling phrases like "her gün saat 9'da" and returns a
standard 5-field cron string ("0 9 * * *"). Unrecognised phrases are passed
through unchanged so callers can use the result directly in APScheduler's
CronTrigger.from_crontab().

Recognised patterns (case-insensitive, accent-tolerant):
  • her saat / saatte bir              → 0 * * * *
  • her 30 dakikada / 15 dakikada bir  → */30 * * * *   (interval in minutes)
  • her gün [saat N]                   → 0 N * * *      (default 09:00)
  • her sabah [N'da]                   → 0 N * * *      (default 09:00)
  • her akşam [N'da]                   → 0 N * * *      (default 18:00)
  • her gece [yarısı|N'da]             → 0 N * * *      (default 00:00)
  • her pazartesi [N'da]               → 0 N * * 1
  • her salı [N'da]                    → 0 N * * 2
  • her çarşamba [N'da]               → 0 N * * 3
  • her perşembe [N'da]               → 0 N * * 4
  • her cuma [N'da]                    → 0 N * * 5
  • her cumartesi [N'da]               → 0 N * * 6
  • her pazar [N'da]                   → 0 N * * 0
  • haftalık                           → 0 9 * * 1      (Monday 09:00)
  • günlük                             → 0 9 * * *
  • aylık / her ayın 1'i               → 0 9 1 * *
"""
from __future__ import annotations

import re


_DAYS = {
    "pazartesi": 1, "salı": 2, "çarşamba": 3, "carsamba": 3,
    "perşembe": 4, "persembe": 4, "cuma": 5, "cumartesi": 6, "pazar": 0,
}

_HOUR_RE = re.compile(r"saat\s+(\d{1,2})")
_MIN_INT_RE = re.compile(r"(\d+)\s*dakika")


def _extract_hour(text: str, default: int) -> int:
    m = _HOUR_RE.search(text)
    if m:
        h = int(m.group(1))
        return h if 0 <= h <= 23 else default
    return default


def nl_to_cron(phrase: str) -> str:
    """Return a 5-field cron string from a Turkish scheduling phrase.

    Falls back to the original phrase if no pattern matches — callers that
    pass a raw cron string will get it back unchanged.
    """
    t = phrase.lower().strip()

    # Raw cron: 5 space-separated tokens with cron chars
    if re.fullmatch(r"[\d\*/,\-]+ [\d\*/,\-]+ [\d\*/,\-]+ [\d\*/,\-]+ [\d\*/,\-]+", t):
        return t

    # Every N minutes
    m = _MIN_INT_RE.search(t)
    if m and ("dakika" in t):
        n = int(m.group(1))
        return f"*/{n} * * * *"

    # Every hour
    if any(k in t for k in ("her saat", "saatte bir")):
        return "0 * * * *"

    # Weekly aliases
    if "haftalık" in t or "haftada bir" in t:
        return "0 9 * * 1"

    # Monthly aliases
    if "aylık" in t or "ayda bir" in t or "her ayın" in t:
        return "0 9 1 * *"

    # Daily aliases (check before day-of-week)
    if "günlük" in t or "her gün" in t:
        h = _extract_hour(t, 9)
        return f"0 {h} * * *"

    # Time-of-day aliases
    if "gece yarısı" in t:
        return "0 0 * * *"
    if "sabah" in t:
        h = _extract_hour(t, 9)
        return f"0 {h} * * *"
    if "akşam" in t or "aksam" in t:
        h = _extract_hour(t, 18)
        return f"0 {h} * * *"
    if "gece" in t:
        h = _extract_hour(t, 0)
        return f"0 {h} * * *"

    # Day of week
    for day_tr, dow in _DAYS.items():
        if day_tr in t:
            h = _extract_hour(t, 9)
            return f"0 {h} * * {dow}"

    # "her X saat"
    m2 = re.search(r"her\s+(\d+)\s*saat", t)
    if m2:
        n = int(m2.group(1))
        return f"0 */{n} * * *"

    return phrase  # pass-through if unrecognised
