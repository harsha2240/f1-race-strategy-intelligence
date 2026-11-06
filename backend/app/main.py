from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import admin, admin_results, admin_sessions, analytics, auth, health, ingestion, strategy_documents, strategy_plans, vector

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", description="Race performance and strategy analytics API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(admin_results.router)
app.include_router(admin_sessions.router)
app.include_router(strategy_documents.router)
app.include_router(strategy_plans.router)
app.include_router(ingestion.router)
app.include_router(vector.router)
