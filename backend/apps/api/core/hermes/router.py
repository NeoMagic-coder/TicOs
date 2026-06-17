"""DEPRECATED — keyword-based intent classifier.

.. deprecated::
   Hermes artık `apps.api.core.planner.PlannerAgent` üzerinden LLM tabanlı
   planlama yapıyor (bkz. ``HermesOrchestrator.handle``). Bu modül şu üç
   nedenle hâlâ duruyor, yeni kodda kullanma:

   1. ``RoutingDecision`` dataclass'ı API response şemasıyla uyumluluk için
      `orchestrator._routing_from_plan` tarafından kullanılıyor.
   2. ``route()`` fonksiyonu test fixture'larında deterministik bir planner
      stub'ı olarak çağrılıyor (`apps/api/tests/test_orchestrator.py`'daki
      ``StubLLM``).
   3. Planner LLM çağrısı tamamen başarısız olursa son çare olarak fallback
      için bırakıldı.

   Yeni rota seçimi mantığı eklemek için ``planner.py``'a git.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass


@dataclass
class RoutingDecision:
    primary_agent: str
    supporting: list[str]
    rationale: str
    urgency: str  # low | medium | high | critical


_KEYWORDS = {
    "market_research_agent": ["pazar", "rakip", "trend", "talep", "niş", "araştır"],
    "brand_identity_agent": ["marka", "isim", "logo", "ton", "kimlik", "konumlandırma"],
    "product_development_agent": ["tedarikçi", "üretim", "numune", "rfq", "fabrika", "cogs"],
    "store_setup_agent": ["mağaza", "shopify", "kurulum", "ödeme altyapısı", "tema"],
    "catalog_agent": ["listing", "ürün açıklaması", "varyant", "kategori", "katalog"],
    "pricing_agent": ["fiyat", "marj", "indirim", "kampanya fiyat", "rakip fiyat"],
    "marketing_agent": ["reklam", "kampanya", "meta ads", "google ads", "tiktok ads", "bütçe"],
    "content_seo_agent": ["seo", "anahtar kelime", "blog", "içerik", "meta tag"],
    "email_crm_agent": ["e-posta", "email", "newsletter", "akış", "sadakat", "win-back"],
    "operations_agent": ["sipariş", "kargo", "stok", "iade", "fulfillment"],
    "support_agent": ["müşteri mesaj", "destek", "şikayet"],
    "review_reputation_agent": ["yorum", "değerlendirme", "itibar", "nps"],
    "analytics_agent": ["rapor", "analiz", "satış özeti", "performans"],
    "growth_agent": ["büyüme", "a/b", "bundle", "upsell", "cross-sell", "yeni kanal", "churn"],
    "compliance_agent": ["pazaryeri kural", "yasaklı"],
    "legal_compliance_agent": ["kvkk", "sözleşme", "iade politikası", "gizlilik politikası", "e-fatura"],
    "influencer_pr_agent": ["influencer", "basın", "pr", "marka elçisi"],
    "negotiation_agent": ["müzakere", "pazarlık", "anlaşma", "tedarikçi pazarlık", "karşı teklif", "batna"],
    "logistics_agent": ["lojistik", "kargo karşılaştır", "rota", "taşıyıcı", "gönderi takip", "carrier"],
    "dynamic_pricing_agent": ["dinamik fiyat", "fiyat ayarla", "anlık fiyat", "esneklik", "talep sinyali"],
    "autonomous_decision_agent": ["otonom karar", "otomatik onay", "karar politikası", "policy", "otonomi"],
}

_URGENCY_HINTS = {
    "critical": ["acil", "kriz", "çöktü", "hukuki risk"],
    "high": ["hızlı", "bugün", "şimdi", "kayıp"],
    "low": ["uzun vade", "ileride", "bir ara"],
}


def route(message: str, available_agents: list[str]) -> RoutingDecision:
    """DEPRECATED. Use :class:`apps.api.core.planner.PlannerAgent` instead."""
    warnings.warn(
        "hermes.router.route() is deprecated; use planner.PlannerAgent.plan() instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    msg = message.lower()
    scored: list[tuple[str, int]] = []
    for agent, kws in _KEYWORDS.items():
        if agent not in available_agents:
            continue
        score = sum(1 for kw in kws if kw in msg)
        if score:
            scored.append((agent, score))
    scored.sort(key=lambda x: -x[1])

    primary = scored[0][0] if scored else "supervisor"
    supporting = [a for a, _ in scored[1:4]]

    urgency = "medium"
    for level, hints in _URGENCY_HINTS.items():
        if any(h in msg for h in hints):
            urgency = level
            break

    rationale = (
        f"{len(scored)} ajan eşleşti; primary={primary}, supporting={supporting}, urgency={urgency}"
    )
    return RoutingDecision(primary_agent=primary, supporting=supporting, rationale=rationale, urgency=urgency)
