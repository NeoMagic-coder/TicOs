"""Module analyzers — read TIC data and emit structured signals."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select

from apps.api.core.commerce.policy import CommerceControlPolicy, get_commerce_policy
from apps.api.core.db import session_scope
from apps.api.core.db.models import ProductRow
from apps.api.core.db.tic_models import TicCustomerRow, TicOrderRow, TicProductRow
from apps.api.services.task_store import get_approval_store, get_task_store

_DEFAULT_TENANT_ID = "tenant_default"
_SUPPORT_KEYWORDS = ("destek", "şikayet", "iade", "müşteri", "support", "iptal")


def _module(
    module_id: str,
    label: str,
    *,
    status: str,
    automation_level: str,
    ai_technique: str,
    score: float,
    signals: list[dict[str, Any]],
    recommendations: list[str],
) -> dict[str, Any]:
    return {
        "module_id": module_id,
        "label": label,
        "status": status,
        "automation_level": automation_level,
        "ai_technique": ai_technique,
        "health_score": round(max(0.0, min(1.0, score)), 2),
        "signals": signals,
        "recommendations": recommendations,
    }


def analyze_products(policy: CommerceControlPolicy | None = None) -> dict[str, Any]:
    """Product listing health — descriptions, images, active state."""
    _ = policy or get_commerce_policy()
    with session_scope() as s:
        rows = (
            s.execute(
                select(TicProductRow).where(TicProductRow.tenant_id == _DEFAULT_TENANT_ID)
            )
            .scalars()
            .all()
        )
        ws_count = s.execute(select(func.count()).select_from(ProductRow)).scalar() or 0

    total = len(rows)
    inactive = sum(1 for r in rows if not r.is_active)
    missing_desc = sum(1 for r in rows if len((r.description or "").strip()) < 20)
    missing_images = sum(1 for r in rows if not r.images)
    unlinked_ws = ws_count > 0 and sum(1 for r in rows if r.workspace_product_name) < ws_count

    signals: list[dict[str, Any]] = []
    if missing_desc:
        signals.append({"type": "content_gap", "count": missing_desc, "severity": "medium"})
    if missing_images:
        signals.append({"type": "missing_images", "count": missing_images, "severity": "low"})
    if inactive:
        signals.append({"type": "inactive_products", "count": inactive, "severity": "low"})
    if unlinked_ws:
        signals.append({"type": "workspace_unlinked", "severity": "medium"})

    penalty = (missing_desc * 0.08 + missing_images * 0.05 + inactive * 0.03) / max(total, 1)
    score = 1.0 - min(0.9, penalty)

    recs: list[str] = []
    if missing_desc:
        recs.append(f"{missing_desc} ürün için açıklama zenginleştirme öner.")
    if missing_images:
        recs.append(f"{missing_images} ürüne görsel analizi ile kalite kontrolü uygula.")
    if unlinked_ws:
        recs.append("Ürün OS → Envanter senkronizasyonunu çalıştır.")

    status = "healthy" if score >= 0.75 else "attention" if score >= 0.5 else "critical"
    return _module(
        "products",
        "Ürün Yönetimi",
        status=status,
        automation_level="suggest",
        ai_technique="nlp,image_analysis",
        score=score,
        signals=signals,
        recommendations=recs,
    )


def analyze_stock(policy: CommerceControlPolicy | None = None) -> dict[str, Any]:
    pol = policy or get_commerce_policy()
    with session_scope() as s:
        rows = (
            s.execute(
                select(TicProductRow)
                .where(TicProductRow.tenant_id == _DEFAULT_TENANT_ID)
                .where(TicProductRow.is_active.is_(True))
            )
            .scalars()
            .all()
        )

    low = [r for r in rows if 0 < r.stock < pol.low_stock_threshold]
    out = [r for r in rows if r.stock <= 0]
    total = len(rows)

    signals: list[dict[str, Any]] = []
    for r in low[:5]:
        signals.append(
            {
                "type": "low_stock",
                "product_id": r.id,
                "sku": r.sku,
                "stock": r.stock,
                "severity": "high" if r.stock < 3 else "medium",
            }
        )
    for r in out[:5]:
        signals.append(
            {"type": "out_of_stock", "product_id": r.id, "sku": r.sku, "severity": "critical"}
        )

    score = 1.0 - (len(low) * 0.06 + len(out) * 0.12) / max(total, 1)
    recs: list[str] = []
    if out:
        recs.append(f"{len(out)} ürün stokta yok — acil tedarik veya satışı durdur.")
    if low:
        recs.append(f"{len(low)} ürün düşük stok — yeniden sipariş öner.")

    status = "healthy" if not out and len(low) <= 1 else "attention" if not out else "critical"
    return _module(
        "stock",
        "Stok Takibi",
        status=status,
        automation_level="alert" if pol.auto_restock_suggestion else "monitor",
        ai_technique="predictive_analytics",
        score=score,
        signals=signals,
        recommendations=recs,
    )


def _fraud_score_for_order(order: TicOrderRow, customer_order_count: int) -> tuple[float, list[str]]:
    """Heuristic fraud score — not ML; explainable rule stack."""
    score = 0.0
    reasons: list[str] = []

    if order.total_amount >= 5_000:
        score += 0.25
        reasons.append("yüksek_tutar")
    if order.discount_amount > 0 and order.discount_amount / max(order.total_amount, 1) > 0.4:
        score += 0.2
        reasons.append("yüksek_indirim_oranı")
    if customer_order_count <= 1 and order.total_amount >= 2_000:
        score += 0.2
        reasons.append("yeni_müşteri_yüksek_tutar")
    if order.status == "PENDING" and order.total_amount >= 3_000:
        score += 0.15
        reasons.append("bekleyen_yüksek_tutar")
    if not order.payment_method or order.payment_method.upper() in ("COD", "KAPIDA"):
        score += 0.1
        reasons.append("kapıda_ödeme")

    return min(1.0, score), reasons


def analyze_orders(policy: CommerceControlPolicy | None = None) -> dict[str, Any]:
    pol = policy or get_commerce_policy()
    with session_scope() as s:
        orders = (
            s.execute(
                select(TicOrderRow)
                .where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
                .order_by(TicOrderRow.created_at.desc())
                .limit(100)
            )
            .scalars()
            .all()
        )
        customer_counts: dict[str, int] = {}
        for o in orders:
            customer_counts[o.customer_id] = customer_counts.get(o.customer_id, 0) + 1

    pending = [o for o in orders if o.status == "PENDING"]
    high_value = [o for o in orders if o.total_amount >= pol.high_value_order_try]

    signals: list[dict[str, Any]] = []
    if len(pending) > 5:
        signals.append({"type": "pending_backlog", "count": len(pending), "severity": "medium"})
    for o in high_value[:3]:
        signals.append(
            {
                "type": "high_value_order",
                "order_id": o.id,
                "order_number": o.order_number,
                "amount": o.total_amount,
                "severity": "medium",
            }
        )

    score = 1.0 - min(0.8, len(pending) * 0.04 + len(high_value) * 0.03)
    recs: list[str] = []
    if pending:
        recs.append(f"{len(pending)} bekleyen sipariş — operasyon ajanına yönlendir.")
    if high_value:
        recs.append(f"{len(high_value)} yüksek tutarlı sipariş — manuel doğrulama öner.")

    status = "healthy" if len(pending) <= 3 else "attention"
    return _module(
        "orders",
        "Sipariş Yönetimi",
        status=status,
        automation_level="suggest",
        ai_technique="rule_engine,predictive_analytics",
        score=score,
        signals=signals,
        recommendations=recs,
    )


def analyze_fraud(policy: CommerceControlPolicy | None = None) -> dict[str, Any]:
    pol = policy or get_commerce_policy()
    with session_scope() as s:
        orders = (
            s.execute(
                select(TicOrderRow)
                .where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
                .where(TicOrderRow.status.in_(("PENDING", "CONFIRMED", "PROCESSING")))
                .order_by(TicOrderRow.created_at.desc())
                .limit(50)
            )
            .scalars()
            .all()
        )
        cust_ids = {o.customer_id for o in orders}
        counts: dict[str, int] = {}
        if cust_ids:
            rows = (
                s.execute(
                    select(TicOrderRow.customer_id, func.count())
                    .where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
                    .where(TicOrderRow.customer_id.in_(cust_ids))
                    .group_by(TicOrderRow.customer_id)
                )
                .all()
            )
            counts = {cid: cnt for cid, cnt in rows}

    flagged: list[dict[str, Any]] = []
    for o in orders:
        fscore, reasons = _fraud_score_for_order(o, counts.get(o.customer_id, 1))
        if fscore >= pol.fraud_score_review_threshold:
            flagged.append(
                {
                    "type": "fraud_risk",
                    "order_id": o.id,
                    "order_number": o.order_number,
                    "fraud_score": round(fscore, 2),
                    "reasons": reasons,
                    "severity": "critical" if fscore >= pol.fraud_score_hold_threshold else "high",
                }
            )

    signals = flagged[:10]
    score = 1.0 - min(0.95, len(flagged) * 0.15)
    recs: list[str] = []
    if flagged:
        recs.append(
            f"{len(flagged)} sipariş inceleme eşiğini aştı — yanlış pozitif riskiyle dikkatli değerlendir."
        )
    else:
        recs.append("Aktif siparişlerde belirgin dolandırıcılık sinyali yok.")

    status = "healthy" if not flagged else "attention" if len(flagged) <= 2 else "critical"
    return _module(
        "fraud",
        "Dolandırıcılık Tespiti",
        status=status,
        automation_level="alert" if pol.auto_flag_fraud else "monitor",
        ai_technique="anomaly_detection,behavioral_scoring",
        score=score,
        signals=signals,
        recommendations=recs,
    )


def analyze_support(policy: CommerceControlPolicy | None = None) -> dict[str, Any]:
    pol = policy or get_commerce_policy()
    tasks = get_task_store().all()
    approvals = get_approval_store().all()
    cutoff = datetime.now(UTC) - timedelta(hours=pol.support_sla_hours)

    support_tasks = [
        t
        for t in tasks
        if any(kw in (t.title + t.description).lower() for kw in _SUPPORT_KEYWORDS)
        and (t.status.value if hasattr(t.status, "value") else str(t.status)) != "completed"
    ]
    overdue = [t for t in support_tasks if t.created_at < cutoff]
    pending_support_approvals = [
        a
        for a in approvals
        if a.status == "pending" and any(kw in a.description.lower() for kw in _SUPPORT_KEYWORDS)
    ]

    signals: list[dict[str, Any]] = []
    if support_tasks:
        signals.append({"type": "open_support_tasks", "count": len(support_tasks), "severity": "medium"})
    if overdue:
        signals.append({"type": "sla_breach", "count": len(overdue), "severity": "high"})
    if pending_support_approvals:
        signals.append(
            {"type": "pending_support_approvals", "count": len(pending_support_approvals), "severity": "medium"}
        )

    score = 1.0 - min(0.85, len(overdue) * 0.2 + len(support_tasks) * 0.05)
    recs: list[str] = []
    if overdue:
        recs.append(f"{len(overdue)} destek görevi SLA süresini aştı — önceliklendir.")
    if support_tasks:
        recs.append("Açık destek görevleri için taslak yanıt üretimi öner.")
    if not support_tasks and not overdue:
        recs.append("Destek kuyruğu sakin — proaktif NPS takibi yapılabilir.")

    status = "healthy" if not overdue else "attention" if len(overdue) <= 2 else "critical"
    return _module(
        "support",
        "Müşteri Desteği",
        status=status,
        automation_level="suggest",
        ai_technique="nlp,sentiment_analysis",
        score=score,
        signals=signals,
        recommendations=recs,
    )


def analyze_payment(policy: CommerceControlPolicy | None = None) -> dict[str, Any]:
    pol = policy or get_commerce_policy()
    with session_scope() as s:
        recent = (
            s.execute(
                select(TicOrderRow)
                .where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
                .order_by(TicOrderRow.created_at.desc())
                .limit(30)
            )
            .scalars()
            .all()
        )

    missing_pm = [o for o in recent if not (o.payment_method or "").strip()]
    cod = [o for o in recent if (o.payment_method or "").upper() in ("COD", "KAPIDA", "KAPIDA ÖDEME")]

    signals: list[dict[str, Any]] = []
    if missing_pm:
        signals.append({"type": "missing_payment_method", "count": len(missing_pm), "severity": "low"})
    if cod:
        signals.append({"type": "cod_orders", "count": len(cod), "severity": "medium"})

    score = 1.0 - min(0.5, len(missing_pm) * 0.03 + len(cod) * 0.04)
    recs: list[str] = []
    if cod:
        recs.append(f"{len(cod)} kapıda ödeme siparişi — teslimat riski için fraud skoru ile çapraz kontrol.")
    if missing_pm:
        recs.append("Ödeme yöntemi eksik siparişleri tamamla.")

    status = "healthy" if score >= 0.8 else "attention"
    return _module(
        "payment",
        "Ödeme İşleme",
        status=status,
        automation_level="monitor",
        ai_technique="anomaly_detection",
        score=score,
        signals=signals,
        recommendations=recs,
    )


def run_all_analyzers(policy: CommerceControlPolicy | None = None) -> list[dict[str, Any]]:
    pol = policy or get_commerce_policy()
    return [
        analyze_products(pol),
        analyze_stock(pol),
        analyze_orders(pol),
        analyze_payment(pol),
        analyze_support(pol),
        analyze_fraud(pol),
    ]
