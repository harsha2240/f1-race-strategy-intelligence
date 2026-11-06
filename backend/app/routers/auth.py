from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth import (
    CSRF_COOKIE,
    SESSION_COOKIE,
    current_session,
    hash_password,
    issue_session,
    verify_csrf,
    verify_password,
)
from app.config import get_settings
from app.db import engine
from app.schemas_auth import CurrentUser, LoginInput, RegisterInput

router = APIRouter(prefix="/api/auth", tags=["authentication"])
settings = get_settings()


def _cookie_options(max_age: int) -> dict[str, object]:
    return {
        "max_age": max_age,
        "httponly": True,
        "secure": settings.environment.lower() == "production",
        "samesite": "lax",
        "path": "/",
    }


@router.post("/register", status_code=201)
def register(payload: RegisterInput) -> dict:
    try:
        with engine.begin() as connection:
            user_id = connection.execute(text("""
                INSERT INTO users (email,password_hash,display_name)
                VALUES (:email,:password_hash,:display_name)
            """), {"email": payload.email, "password_hash": hash_password(payload.password),
                  "display_name": payload.display_name}).lastrowid
            role_id = connection.execute(text("SELECT role_id FROM roles WHERE name='ANALYST'")).scalar_one_or_none()
            if role_id is None:
                raise HTTPException(status_code=503, detail="Analyst role is not configured")
            connection.execute(text("INSERT INTO user_roles(user_id,role_id) VALUES (:uid,:rid)"),
                               {"uid": user_id, "rid": role_id})
            connection.execute(text("""
                INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_key,details)
                VALUES (NULL,'user.registered','user',:entity_key,:details)
            """), {"entity_key": str(user_id), "details": '{"role":"ANALYST"}'})
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="An account with that email already exists") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Account service unavailable") from exc
    return {"user_id": user_id, "email": payload.email, "display_name": payload.display_name,
            "roles": ["ANALYST"]}


@router.post("/login", response_model=CurrentUser)
def login(payload: LoginInput, response: Response) -> CurrentUser:
    try:
        with engine.connect() as connection:
            user = connection.execute(text("""
                SELECT user_id, email, display_name, password_hash
                FROM users WHERE email = :email AND is_active = TRUE
            """), {"email": payload.email}).mappings().first()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    if user is None or not verify_password(user["password_hash"], payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_token, csrf_token, expires_at = issue_session(user["user_id"])
    age = int((expires_at - datetime.now(timezone.utc).replace(tzinfo=None)).total_seconds())
    response.set_cookie(SESSION_COOKIE, session_token, **_cookie_options(age))
    response.set_cookie(CSRF_COOKIE, csrf_token, **{**_cookie_options(age), "httponly": False})
    with engine.connect() as connection:
        roles = connection.execute(text("""
            SELECT r.name FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = :user_id ORDER BY r.name
        """), {"user_id": user["user_id"]}).scalars().all()
    return CurrentUser(user_id=user["user_id"], email=user["email"],
                       display_name=user["display_name"], roles=list(roles), csrf_token=csrf_token)


@router.get("/me", response_model=CurrentUser)
def me(request: Request, user: dict = Depends(current_session)) -> CurrentUser:
    csrf_token = request.cookies.get(CSRF_COOKIE, "")
    from app.auth import _digest

    if not csrf_token or _digest(csrf_token) != user["csrf_hash"]:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        with engine.connect() as connection:
            roles = connection.execute(text("""
                SELECT r.name FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                WHERE ur.user_id = :user_id ORDER BY r.name
            """), {"user_id": user["user_id"]}).scalars().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    return CurrentUser(user_id=user["user_id"], email=user["email"],
                       display_name=user["display_name"], roles=list(roles), csrf_token=csrf_token)


@router.post("/logout", status_code=204)
def logout(response: Response, request: Request, user: dict = Depends(current_session)) -> Response:
    verify_csrf(request, user)
    try:
        with engine.begin() as connection:
            connection.execute(text("""
                UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
                WHERE auth_session_id = :session_id AND revoked_at IS NULL
            """), {"session_id": user["auth_session_id"]})
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True,
                           secure=settings.environment.lower() == "production", samesite="lax")
    response.delete_cookie(CSRF_COOKIE, path="/", httponly=False,
                           secure=settings.environment.lower() == "production", samesite="lax")
    # FastAPI/Starlette may leave the injected Response status unset for a 204 route;
    # explicitly set it so the cookie-clearing response is valid on all supported versions.
    response.status_code = 204
    return response
