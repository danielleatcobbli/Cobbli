from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Cobbli API",
        version="0.1.0",
        description="Backend service migrated off Supabase Edge Functions.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": app.version}

    # Routes registered here as TDD agents complete each one.
    from app.routes import (  # noqa: PLC0415
        analyze_shoe_photos,
        create_checkout,
        ops_assessments,
        ops_blog,
        ops_profiles,
        ops_service_admin,
        send_account_locked,
        send_order_confirmation,
        send_password_updated,
        send_service_unavailable,
        send_walkup_welcome,
        stripe_webhook,
    )

    app.include_router(create_checkout.router)
    app.include_router(stripe_webhook.router)
    app.include_router(analyze_shoe_photos.router)
    app.include_router(send_order_confirmation.router)
    app.include_router(send_account_locked.router)
    app.include_router(send_password_updated.router)
    app.include_router(send_walkup_welcome.router)
    app.include_router(send_service_unavailable.router)

    # Operations dashboard routes (staff/admin gated) + public blog reads.
    app.include_router(ops_assessments.router)
    app.include_router(ops_blog.router)
    app.include_router(ops_profiles.router)
    app.include_router(ops_service_admin.router)

    return app


app = create_app()
