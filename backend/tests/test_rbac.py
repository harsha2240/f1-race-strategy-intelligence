from fastapi.testclient import TestClient

from app import auth
from app.auth import CSRF_COOKIE, SESSION_COOKIE, _digest, current_session
from app.main import app
from app.routers import admin, auth as auth_router


class _Rows:
    def __init__(self, allowed: bool):
        self.allowed = allowed

    def first(self):
        return (1,) if self.allowed else None

    def mappings(self):
        return self

    def all(self):
        return []


class _Connection:
    def __init__(self, allowed: bool):
        self.allowed = allowed

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, *_args, **_kwargs):
        return _Rows(self.allowed)


class _Engine:
    def __init__(self, allowed: bool):
        self.allowed = allowed

    def connect(self):
        return _Connection(self.allowed)


def _request_admin_users(monkeypatch, allowed: bool):
    monkeypatch.setattr(auth, "engine", _Engine(allowed))
    monkeypatch.setattr(admin, "engine", _Engine(allowed))
    app.dependency_overrides[current_session] = lambda: {"auth_session_id": 7, "user_id": 3}
    try:
        return TestClient(app).get("/api/admin/users")
    finally:
        app.dependency_overrides.clear()


def test_rbac_denies_user_without_permission(monkeypatch):
    response = _request_admin_users(monkeypatch, allowed=False)
    assert response.status_code == 403


def test_rbac_allows_user_with_permission(monkeypatch):
    response = _request_admin_users(monkeypatch, allowed=True)
    assert response.status_code == 200
    assert response.json() == []


def test_jolpica_season_import_requires_data_permission(monkeypatch):
    csrf_token = "test-csrf-token"
    monkeypatch.setattr(auth, "engine", _Engine(allowed=False))
    app.dependency_overrides[current_session] = lambda: {
        "auth_session_id": 7,
        "user_id": 3,
        "csrf_hash": _digest(csrf_token),
    }
    try:
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE, "test-session")
        client.cookies.set(CSRF_COOKIE, csrf_token)
        response = client.post(
            "/api/ingestion/jolpica/season",
            json={"season": 2018, "include_laps": False},
            headers={"X-CSRF-Token": csrf_token},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


def test_logout_revokes_session_and_returns_204(monkeypatch):
    class _Transaction:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, *_args, **_kwargs):
            return None

    class _LogoutEngine:
        def begin(self):
            return _Transaction()

    csrf_token = "test-csrf-token"
    monkeypatch.setattr(auth_router, "engine", _LogoutEngine())
    app.dependency_overrides[current_session] = lambda: {
        "auth_session_id": 7,
        "user_id": 3,
        "csrf_hash": _digest(csrf_token),
    }
    try:
        client = TestClient(app)
        client.cookies.set(SESSION_COOKIE, "test-session")
        client.cookies.set(CSRF_COOKIE, csrf_token)
        response = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf_token})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204
    assert response.content == b""
    assert SESSION_COOKIE in response.headers.get("set-cookie", "")
    assert CSRF_COOKIE in response.headers.get("set-cookie", "")
