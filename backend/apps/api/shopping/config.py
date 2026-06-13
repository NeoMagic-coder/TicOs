"""Alisveris ajani ayarlari."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        env_prefix="SHOPPING_",
        extra="ignore",
    )

    database_url: str = "sqlite+aiosqlite:///./apps/api/data/shopping_agent.db"

    # LLM saglayici: "bedrock" | "openai" | "ollama" | "mock"
    llm_provider: str = "mock"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # Crawler
    sites: str = "web_search,mockstore"  # virgulle: "web_search,trendyol,hepsiburada,mockstore"
    web_search_sources: str = "trendyol,hepsiburada,n11"
    web_search_general: bool = True  # DuckDuckGo genel web aramasi
    headless: bool = True
    nav_timeout_ms: int = 20_000
    max_offers_per_site: int = 8

    # EUV metrigi: manuel karsilastirmanin varsayilan suresi (zaman tasarrufu hesabi)
    manual_baseline_seconds: int = 900


@lru_cache
def get_settings() -> Settings:
    return Settings()
