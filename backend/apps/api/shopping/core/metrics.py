"""EUV denklem metrikleri — oneri dogrulugu, zaman tasarrufu, memnuniyet (1-5).

Saf fonksiyon: veritabani satirlarindan turetilmis basit degerler alir, rapor dondurur.
"""

from __future__ import annotations

from apps.api.shopping.schemas import MetricsReport

_DONE_STATUSES = ("completed", "partial")


def build_metrics_report(
    *,
    durations: list[float],
    statuses: list[str],
    feedback: list[tuple[bool, int]],
    baseline_seconds: int,
) -> MetricsReport:
    completed = sum(1 for s in statuses if s in _DONE_STATUSES)
    fb_count = len(feedback)
    accurate = sum(1 for ok, _ in feedback if ok)
    return MetricsReport(
        total_runs=len(statuses),
        completed_runs=completed,
        accuracy_rate=round(accurate / fb_count, 3) if fb_count else None,
        avg_satisfaction=round(sum(s for _, s in feedback) / fb_count, 2) if fb_count else None,
        avg_duration_seconds=round(sum(durations) / len(durations), 2) if durations else None,
        avg_time_saved_seconds=(
            round(sum(max(0.0, baseline_seconds - d) for d in durations) / len(durations), 2)
            if durations
            else None
        ),
        feedback_count=fb_count,
    )

