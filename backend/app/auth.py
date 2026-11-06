from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text

from app.db import engine

password_hasher = PasswordHasher()
SESSION_COOKIE = "f1_session"
CSRF_COOKIE = "f1_csrf"
SESSION_HOURS = 8


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def issue_session(user_id: int) -> tuple[str, str, datetime]:
    session_token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=SESSION_HOURS)
    with engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO auth_sessions (user_id, token_hash, csrf_hash, expires_at)
            VALUES (:user_id, :token_hash, :csrf_hash, :expires_at)
        """), {
            "user_id": user_id,
            "token_hash": _digest(session_token),
            "csrf_hash": _digest(csrf_token),
            "expires_at": expires_at,
        })
    return session_token, csrf_token, expires_at


def current_session(request: Request) -> dict[str, Any]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        with engine.connect() as connection:
            row = connection.execute(text("""
                SELECT u.user_id, u.email, u.display_name, s.auth_session_id, s.csrf_hash
                FROM auth_sessions s
                JOIN users u ON u.user_id = s.user_id
                WHERE s.token_hash = :token_hash AND s.revoked_at IS NULL
                  AND s.expires_at > UTC_TIMESTAMP() AND u.is_active = TRUE
            """), {"token_hash": _digest(token)}).mappings().first()
    except Exception as exc:
        from sqlalchemy.exc import SQLAlchemyError

        if isinstance(exc, SQLAlchemyError):
            raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return dict(row)


def require_permission(permission_key: str, require_csrf: bool = False) -> Callable[..., dict[str, Any]]:
    def dependency(request: Request, user: dict[str, Any] = Depends(current_session)) -> dict[str, Any]:
        if require_csrf:
            verify_csrf(request, user)
        try:
            with engine.connect() as connection:
                allowed = connection.execute(text("""
                    SELECT 1
                    FROM auth_sessions s
                    JOIN user_roles ur ON ur.user_id = s.user_id
                    JOIN role_permissions rp ON rp.role_id = ur.role_id
                    JOIN permissions p ON p.permission_id = rp.permission_id
                    WHERE s.auth_session_id = :session_id AND p.permission_key = :permission
                    LIMIT 1
                """), {"session_id": user["auth_session_id"], "permission": permission_key}).first()
        except Exception as exc:
            from sqlalchemy.exc import SQLAlchemyError

            if isinstance(exc, SQLAlchemyError):
                raise HTTPException(status_code=503, detail="Authorization service unavailable") from exc
            raise
        if allowed is None:
            raise HTTPException(status_code=403, detail="Permission denied")
        return user

    return dependency


def verify_csrf(request: Request, user: dict[str, Any]) -> None:
    cookie_token = request.cookies.get(CSRF_COOKIE, "")
    header_token = request.headers.get("X-CSRF-Token", "")
    if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    if not hmac.compare_digest(_digest(cookie_token), user["csrf_hash"]):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
