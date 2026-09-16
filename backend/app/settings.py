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
    # Anon/publishable key — used for RLS-respecting, user-JWT-scoped clients.
    # Without this, a user-scoped client would fall back to the service-role
    # key and silently BYPASS RLS. Falls back to the service key only if unset
    # (keeps local/dev working) but production must set it.
    supabase_anon_key: str = Field(
        default="", validation_alias="SUPABASE_ANON_KEY"
    )

    stripe_secret_key: str = Field(default="", validation_alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str = Field(
        default="", validation_alias="STRIPE_WEBHOOK_SECRET"
    )

    brevo_api_key: str = Field(default="", validation_alias="BREVO_API_KEY")

    # Shoe-photo analysis now runs on AWS Bedrock (Claude vision) instead of the
    # Lovable AI gateway. Auth is IAM (instance role), so no API key. AWS_REGION
    # is provided by App Runner automatically; default keeps local dev working.
    bedrock_region: str = Field(
        default="us-east-1", validation_alias="BEDROCK_REGION"
    )
    bedrock_model_id: str = Field(
        default="us.anthropic.claude-haiku-4-5-20251001-v1:0",
        validation_alias="BEDROCK_MODEL_ID",
    )

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
