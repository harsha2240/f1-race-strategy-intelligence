import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth import hash_password, require_permission
from app.db import engine
from app.schemas_admin import UserCreate, UserRoleUpdate

router = APIRouter(prefix="/api/admin", tags=["administration"])


@router.get("/users")
def list_users(
    _: dict = Depends(require_permission("users:manage")),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("""
                SELECT u.user_id, u.email, u.display_name, u.is_active, u.created_at,
                       GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',') AS role_names
                FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.user_id
                LEFT JOIN roles r ON r.role_id = ur.role_id
                GROUP BY u.user_id, u.email, u.display_name, u.is_active, u.created_at
                ORDER BY u.user_id LIMIT :limit OFFSET :offset
            """), {"limit": limit, "offset": offset}).mappings().all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Administration service unavailable") from exc
    return [{**dict(row), "roles": (row["role_names"] or "").split(",") if row["role_names"] else []}
            for row in rows]


@router.post("/users", status_code=201)
def create_user(payload: UserCreate, actor: dict = Depends(require_permission("users:manage", require_csrf=True))) -> dict:
    try:
        with engine.begin() as connection:
            result = connection.execute(text("""
                INSERT INTO users (email, password_hash, display_name)
                VALUES (:email, :password_hash, :display_name)
            """), {"email": payload.email, "password_hash": hash_password(payload.password),
                  "display_name": payload.display_name.strip()})
            user_id = result.lastrowid
            role_rows = connection.execute(
                text("SELECT role_id, name FROM roles WHERE name IN :roles").bindparams(
                    bindparam("roles", expanding=True)
                ), {"roles": payload.roles}
            ).mappings().all()
            if {row["name"] for row in role_rows} != set(payload.roles):
                raise HTTPException(status_code=400, detail="A requested role is not configured")
            for row in role_rows:
                connection.execute(text("INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"),
                                   {"uid": user_id, "rid": row["role_id"]})
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_key, details)
                VALUES (:actor, 'user.created', 'user', :entity_key, :details)
            """), {"actor": actor["user_id"], "entity_key": str(user_id),
                  "details": json.dumps({"email": payload.email, "roles": payload.roles})})
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="A user with that email already exists") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Administration service unavailable") from exc
    return {"user_id": user_id, "email": payload.email, "display_name": payload.display_name.strip(),
            "roles": payload.roles}


@router.put("/users/{user_id}/roles")
def update_user_roles(
    user_id: int,
    payload: UserRoleUpdate,
    actor: dict = Depends(require_permission("users:manage", require_csrf=True)),
) -> dict:
    try:
        with engine.begin() as connection:
            exists = connection.execute(text("SELECT 1 FROM users WHERE user_id = :uid"), {"uid": user_id}).first()
            if exists is None:
                raise HTTPException(status_code=404, detail="User not found")
            role_rows = connection.execute(
                text("SELECT role_id, name FROM roles WHERE name IN :roles").bindparams(
                    bindparam("roles", expanding=True)
                ), {"roles": payload.roles}
            ).mappings().all()
            if {row["name"] for row in role_rows} != set(payload.roles):
                raise HTTPException(status_code=400, detail="A requested role is not configured")
            if user_id == actor["user_id"] and "ADMIN" not in payload.roles:
                raise HTTPException(status_code=400, detail="You cannot remove your own ADMIN role")
            if "ADMIN" not in payload.roles:
                admin_count = connection.execute(text("""
                    SELECT COUNT(DISTINCT ur.user_id)
                    FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                    WHERE r.name = 'ADMIN'
                """)).scalar_one()
                target_is_admin = connection.execute(text("""
                    SELECT 1 FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
                    WHERE ur.user_id = :uid AND r.name = 'ADMIN'
                """), {"uid": user_id}).first()
                if target_is_admin is not None and admin_count <= 1:
                    raise HTTPException(status_code=400, detail="At least one ADMIN account must remain")
            connection.execute(text("DELETE FROM user_roles WHERE user_id = :uid"), {"uid": user_id})
            for row in role_rows:
                connection.execute(text("INSERT INTO user_roles (user_id, role_id) VALUES (:uid, :rid)"),
                                   {"uid": user_id, "rid": row["role_id"]})
            connection.execute(text("""
                INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_key, details)
                VALUES (:actor, 'user.roles_updated', 'user', :entity_key, :details)
            """), {"actor": actor["user_id"], "entity_key": str(user_id),
                  "details": json.dumps({"roles": payload.roles})})
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Administration service unavailable") from exc
    return {"user_id": user_id, "roles": payload.roles}


@router.get("/audit")
def read_audit(
    _: dict = Depends(require_permission("audit:read")),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    try:
        with engine.connect() as connection:
            return [dict(row) for row in connection.execute(text("""
                SELECT audit_id, actor_user_id, action, entity_type, entity_key, occurred_at, details
                FROM audit_logs ORDER BY occurred_at DESC, audit_id DESC
                LIMIT :limit OFFSET :offset
            """), {"limit": limit, "offset": offset}).mappings().all()]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Audit service unavailable") from exc
