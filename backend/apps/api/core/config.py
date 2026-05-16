from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "OneProduct Agent OS API"
    environment: str = "development"
    debug: bool = True

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # Tried in order on 429/empty. First entry == primary model.
    gemini_fallback_models: list[str] = [
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
    ]
    # Max concurrent LLM requests (Gemini free tier RPM is tight).
    llm_max_concurrency: int = 2

    default_temperature: float = 0.7
    default_max_tokens: int = 1024

    tool_default_timeout_ms: int = 15_000
    tool_default_retry_attempts: int = 2

    orchestrator_max_iterations: int = 5
    orchestrator_low_confidence_threshold: float = 0.6

    # SQLite by default; override with e.g. postgresql+psycopg://... via env.
    database_url: str = "sqlite:///apps/api/data/app.db"

    # Vector memory
    embedding_model: str = "text-embedding-004"  # Gemini, 768-dim
    embedding_dim: int = 768
    memory_auto_write: bool = True

    # Critic / self-evaluation
    critic_enabled: bool = True
    critic_min_score: float = 0.6
    critic_max_retries: int = 1

    # Shopify Admin API (live tools). When shop/token are empty the adapters
    # gracefully degrade to mock_router output with ``degraded: true``.
    shopify_shop: str = ""              # e.g. "my-store" → my-store.myshopify.com
    shopify_access_token: str = ""      # X-Shopify-Access-Token
    shopify_api_version: str = "2024-10"
    shopify_webhook_secret: str = ""    # HMAC secret for /webhooks/shopify

    # Trendyol Partner API (live tools). When any field is empty the adapters
    # gracefully degrade to mock output with ``degraded: true``.
    trendyol_supplier_id: str = ""      # Trendyol seller/supplier ID
    trendyol_api_key: str = ""          # API key (used in Basic Auth)
    trendyol_api_secret: str = ""       # API secret (used in Basic Auth)

    # Google Analytics 4 Data API (live tools). When not configured the
    # adapters degrade to mock output with ``degraded: true``.
    ga4_property_id: str = ""           # Numeric GA4 property ID (e.g. "123456789")
    ga4_service_account_json: str = ""  # base64-encoded service account JSON
    ga4_access_token: str = ""          # Static OAuth2 bearer token (testing only)

    # Telegram Bot (Phase 2-B gateway). When token is empty the webhook returns 503.
    telegram_bot_token: str = ""         # From @BotFather
    telegram_webhook_secret: str = ""    # Secret token header value

    # Discord Bot (Phase 2-B gateway).
    discord_bot_token: str = ""          # From Discord Developer Portal

    # Slack Events API (Phase 2-B gateway).
    slack_bot_token: str = ""            # xoxb-... bot token
    slack_signing_secret: str = ""       # For request signature verification

    # Twilio WhatsApp (Phase 2-B gateway).
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = ""       # e.g. "whatsapp:+14155238886"

    # Phase 4: execution backends
    ssh_host: str = ""
    ssh_port: int = 22
    ssh_user: str = ""
    ssh_key_path: str = ""
    daytona_server_url: str = ""
    daytona_api_key: str = ""
    daytona_workspace_id: str = ""
    vercel_token: str = ""
    vercel_team_id: str = ""

    # Circuit breaker defaults — used by ToolBreaker for every live adapter.
    breaker_fail_max: int = 5
    breaker_reset_timeout_s: int = 30

    # Observability — OpenTelemetry + Prometheus.
    otel_enabled: bool = True
    otel_service_name: str = "oneproduct-api"
    # OTLP/HTTP traces endpoint (OTel Collector forwards to Tempo).
    otel_exporter_otlp_endpoint: str = "http://otel-collector:4318/v1/traces"

    @field_validator(
        "gemini_api_key",
        "gemini_model",
        mode="before",
    )
    @classmethod
    def _strip_quotes(cls, v: str | None) -> str:
        if not v:
            return ""
        return str(v).strip().strip('"').strip("'")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        # Project .env / .env.local must override stale system env vars.
        return (init_settings, dotenv_settings, env_settings, file_secret_settings)


@lru_cache
def get_settings() -> Settings:
    return Settings()
