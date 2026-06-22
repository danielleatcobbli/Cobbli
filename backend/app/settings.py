from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Server-side configuration. Loaded from env vars; never read by client."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    supabase_url: str = Field(default="", validation_alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(
        default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY"
    )

    stripe_secret_key: str = Field(default="", validation_alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str = Field(
        default="", validation_alias="STRIPE_WEBHOOK_SECRET"
    )

    brevo_api_key: str = Field(default="", validation_alias="BREVO_API_KEY")
    ai_api_key: str = Field(default="", validation_alias="AI_API_KEY")

    cors_allow_origins: str = Field(
        default="*", validation_alias="CORS_ALLOW_ORIGINS"
    )

    site_url: str = Field(default="https://cobbli.com", validation_alias="SITE_URL")

    deposit_amount_cents: int = 2000

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_allow_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
