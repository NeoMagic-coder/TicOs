"""Pydantic V2 semalari — kullanici hedefi, teklif, skor ve rapor modelleri."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"  # bazi siteler hata verdi, akis kalan sitelerle tamamlandi
    FAILED = "failed"


class ShoppingGoal(BaseModel):
    """Kullanici hedefi: urun, butce, lokasyon ve tercihler."""

    product_query: str = Field(min_length=2, max_length=200)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    location: str | None = None
    require_in_stock: bool = True
    require_fast_delivery: bool = False
    require_warranty: bool = False

    @model_validator(mode="after")
    def check_budget_range(self) -> ShoppingGoal:
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_max < self.budget_min
        ):
            raise ValueError("budget_max, budget_min degerinden kucuk olamaz")
        return self


class Offer(BaseModel):
    """Tek bir siteden cikarilmis urun teklifi."""

    site: str
    title: str
    url: str = ""
    price: float = Field(ge=0)
    currency: str = "TRY"
    in_stock: bool = True
    stock_level: int | None = None  # None = bilinmiyor
    delivery_days: int | None = None  # None = bilinmiyor
    warranty_months: int | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    extracted_via: str = "dom"  # "dom" | "llm"


class ScoredOffer(BaseModel):
    offer: Offer
    score: float
    breakdown: dict[str, float]
    reasons: list[str] = []


class SiteError(BaseModel):
    site: str
    error: str


class WebSearchSource(BaseModel):
    uri: str
    title: str
    snippet: str = ""


class WebSearchMeta(BaseModel):
    """Web arama ciktisi — pazar yeri + genel web kaynaklari."""

    query: str
    queries: list[str] = []
    sources: list[WebSearchSource] = []
    market_sources: list[str] = []
    offer_count: int = 0
    answer: str = ""
    degraded: bool = False
    degraded_reason: str | None = None
    errors: list[str] = []


class AgentRunResult(BaseModel):
    """Bir ajan kosusunun tam sonucu: oneri + alternatifler + hata/sure raporu."""

    run_id: str
    status: RunStatus
    goal: ShoppingGoal
    best: ScoredOffer | None = None
    alternatives: list[ScoredOffer] = []
    all_offers: list[ScoredOffer] = []
    site_errors: list[SiteError] = []
    duration_seconds: float = 0.0
    time_saved_seconds: float = 0.0
    summary: str = ""
    web_search: WebSearchMeta | None = None
    created_at: datetime | None = None


class RunCreatedOut(BaseModel):
    run_id: str
    status: RunStatus


class RunSummary(BaseModel):
    run_id: str
    status: RunStatus
    product_query: str
    duration_seconds: float
    created_at: datetime | None = None


class FeedbackIn(BaseModel):
    """EUV anketi: oneri dogrulugu + kullanici memnuniyeti (1-5)."""

    recommendation_accurate: bool
    satisfaction: int = Field(ge=1, le=5)
    comment: str | None = None


class FeedbackOut(BaseModel):
    id: int
    run_id: str
    recommendation_accurate: bool
    satisfaction: int


class MetricsReport(BaseModel):
    """EUV denklem metrikleri: dogruluk, zaman tasarrufu, memnuniyet."""

    total_runs: int
    completed_runs: int
    accuracy_rate: float | None = None
    avg_satisfaction: float | None = None
    avg_duration_seconds: float | None = None
    avg_time_saved_seconds: float | None = None
    feedback_count: int = 0
