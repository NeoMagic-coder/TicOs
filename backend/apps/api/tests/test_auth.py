"""Integration tests for the Google OAuth session flow."""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.main import create_app


def _fresh_app():
    get_settings.cache_clear()  # type: ignore[attr-defined]
    return create_app()


def _configure_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("AUTH_SESSION_SECRET", "test-session-secret-with-at-least-32-characters")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "google-client-id")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "google-client-secret")
    monkeypatch.setenv("GOOGLE_OAUTH_REDIRECT_URI", "http://test/api/v1/auth/callback")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:5173")
    monkeypatch.delenv("API_KEY", raising=False)


@pytest.mark.asyncio
async def test_auth_disabled_preserves_local_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.delenv("API_KEY", raising=False)

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
    ) as client:
        session = await client.get("/api/v1/auth/session")
        agents = await client.get("/api/v1/agents")

    assert session.status_code == 200
    assert session.json() == {
        "enabled": False,
        "configured": False,
        "oauth_configured": False,
        "firebase_configured": False,
        "authenticated": False,
        "user": None,
    }
    assert agents.status_code == 200


@pytest.mark.asyncio
async def test_auth_enabled_requires_session_for_api_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_auth(monkeypatch)

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
    ) as client:
        session = await client.get("/api/v1/auth/session")
        agents = await client.get("/api/v1/agents")

    assert session.status_code == 200
    assert session.json()["authenticated"] is False
    assert agents.status_code == 401
    assert agents.json()["detail"] == "authentication required"


@pytest.mark.asyncio
async def test_login_redirects_to_google_and_sets_state_cookie(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_auth(monkeypatch)

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
        follow_redirects=False,
    ) as client:
        response = await client.get("/api/v1/auth/login", params={"next": "/pricing"})

    assert response.status_code == 307
    location = urlparse(response.headers["location"])
    query = parse_qs(location.query)
    assert f"{location.scheme}://{location.netloc}{location.path}" == (
        "https://accounts.google.com/o/oauth2/v2/auth"
    )
    assert query["client_id"] == ["google-client-id"]
    assert query["redirect_uri"] == ["http://test/api/v1/auth/callback"]
    assert query["scope"] == ["openid email profile"]
    assert query["state"][0]
    assert "ticos_oauth_state=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]


@pytest.mark.asyncio
async def test_callback_creates_session_and_logout_clears_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_auth(monkeypatch)
    app = _fresh_app()

    from apps.api.routes import auth

    async def fake_exchange(_code: str):
        return {
            "sub": "google-user-123",
            "email": "owner@example.com",
            "name": "Store Owner",
            "picture": "https://example.com/avatar.png",
        }

    monkeypatch.setattr(auth, "_exchange_google_code", fake_exchange)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=False,
    ) as client:
        login = await client.get("/api/v1/auth/login", params={"next": "/pricing"})
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]

        callback = await client.get(
            "/api/v1/auth/callback",
            params={"code": "oauth-code", "state": state},
        )
        agents = await client.get("/api/v1/agents")
        session = await client.get("/api/v1/auth/session")
        logout = await client.post("/api/v1/auth/logout")
        session_after_logout = await client.get("/api/v1/auth/session")

    assert callback.status_code == 303
    assert callback.headers["location"] == "http://localhost:5173/pricing"
    assert agents.status_code == 200
    assert session.json()["user"]["email"] == "owner@example.com"
    assert logout.status_code == 204
    assert session_after_logout.json()["authenticated"] is False


@pytest.mark.asyncio
async def test_callback_rejects_invalid_state(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure_auth(monkeypatch)

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/api/v1/auth/callback",
            params={"code": "oauth-code", "state": "tampered"},
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "invalid oauth state"


@pytest.mark.asyncio
async def test_short_session_secret_is_not_considered_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_auth(monkeypatch)
    monkeypatch.setenv("AUTH_SESSION_SECRET", "too-short")

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
    ) as client:
        session = await client.get("/api/v1/auth/session")
        login = await client.get("/api/v1/auth/login")

    assert session.json()["configured"] is False
    assert login.status_code == 503


def _configure_firebase_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("AUTH_SESSION_SECRET", "test-session-secret-with-at-least-32-characters")
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "ticosclaw")
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("GOOGLE_OAUTH_REDIRECT_URI", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)


@pytest.mark.asyncio
async def test_firebase_login_creates_session_and_logout_clears_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_firebase_auth(monkeypatch)
    app = _fresh_app()

    from apps.api.routes import auth

    def fake_verify(_id_token: str) -> dict[str, str]:
        return {
            "id": "firebase-user-123",
            "email": "owner@example.com",
            "name": "Store Owner",
            "picture": "https://example.com/avatar.png",
        }

    monkeypatch.setattr(auth, "_verify_firebase_id_token", fake_verify)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        session_before = await client.get("/api/v1/auth/session")
        login = await client.post(
            "/api/v1/auth/firebase",
            json={"id_token": "firebase-id-token-with-enough-length"},
        )
        agents = await client.get("/api/v1/agents")
        session = await client.get("/api/v1/auth/session")
        logout = await client.post("/api/v1/auth/logout")
        session_after_logout = await client.get("/api/v1/auth/session")

    assert session_before.json()["firebase_configured"] is True
    assert session_before.json()["oauth_configured"] is False
    assert login.status_code == 200
    assert login.json()["user"]["email"] == "owner@example.com"
    assert agents.status_code == 200
    assert session.json()["user"]["email"] == "owner@example.com"
    assert logout.status_code == 204
    assert session_after_logout.json()["authenticated"] is False


@pytest.mark.asyncio
async def test_firebase_login_rejects_invalid_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_firebase_auth(monkeypatch)
    app = _fresh_app()

    from apps.api.routes import auth

    def fake_verify(_id_token: str) -> dict[str, str]:
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="invalid firebase token")

    monkeypatch.setattr(auth, "_verify_firebase_id_token", fake_verify)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/v1/auth/firebase",
            json={"id_token": "bad-token-with-enough-length"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "invalid firebase token"


@pytest.mark.asyncio
async def test_auth_enabled_with_firebase_requires_session_for_api_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _configure_firebase_auth(monkeypatch)

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
    ) as client:
        session = await client.get("/api/v1/auth/session")
        agents = await client.get("/api/v1/agents")

    assert session.status_code == 200
    assert session.json()["configured"] is True
    assert session.json()["authenticated"] is False
    assert agents.status_code == 401


@pytest.mark.asyncio
async def test_callback_is_unavailable_when_auth_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.delenv("API_KEY", raising=False)

    async with AsyncClient(
        transport=ASGITransport(app=_fresh_app()),
        base_url="http://test",
    ) as client:
        response = await client.get(
            "/api/v1/auth/callback",
            params={"code": "oauth-code", "state": "untrusted"},
        )

    assert response.status_code == 503
    assert response.json()["detail"] == "oauth is not configured"
