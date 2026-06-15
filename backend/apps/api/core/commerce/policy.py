"""Commerce control policy — thresholds for module automation levels."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class CommerceControlPolicy:
    """Per-tenant commerce automation limits.

    Values are upper bounds; exceeding them routes actions to human approval.
    """

    low_stock_threshold: int = 10
    fraud_score_review_threshold: float = 0.55
    fraud_score_hold_threshold: float = 0.75
    high_value_order_try: float = 5_000.0
    min_action_confidence: float = 0.65
    auto_restock_suggestion: bool = True
    auto_flag_fraud: bool = True
    support_sla_hours: int = 24

    limitations: tuple[str, ...] = field(
        default=(
            "Dolandırıcılık skoru kural tabanlıdır; yanlış pozitif meşru siparişleri geciktirebilir.",
            "Destek modülü gerçek ticket entegrasyonu olmadan görev/onay sinyallerine dayanır.",
            "Ürün içerik önerileri marka tonu ve yasal uyumluluğu garanti etmez.",
            "Stok tahmini geçmiş sipariş verisine bağlıdır; ani kampanyalar tahmini bozar.",
            "Ödeme kararları nihai olarak ödeme sağlayıcısı kurallarına tabidir.",
        ),
        repr=False,
    )


_POLICY = CommerceControlPolicy()


def get_commerce_policy() -> CommerceControlPolicy:
    return _POLICY


def patch_commerce_policy(**kwargs: object) -> CommerceControlPolicy:
    global _POLICY
    data = {k: getattr(_POLICY, k) for k in _POLICY.__dataclass_fields__ if k != "limitations"}
    for key, val in kwargs.items():
        if key in data and val is not None:
            data[key] = val
    _POLICY = CommerceControlPolicy(**data)
    return _POLICY
