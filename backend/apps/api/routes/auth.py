"""Google OAuth/OIDC and Firebase Auth login backed by signed HttpOnly session cookies."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from apps.api.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_COOKIE = "ticos_session"
STATE_COOKIE = "ticos_oauth_state"
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _session_secret_configured() -> bool:
    return len(get_settings().auth_session_secret) >= 32


def oauth_configured() -> bool:
    settings = get_settings()
    return bool(
        _session_secret_configured()
        and settings.google_oauth_client_id
        and settings.google_oauth_client_secret
        and settings.google_oauth_redirect_uri
    )


def firebase_configured() -> bool:
    settings = get_settings()
    return bool(_session_secret_configured() and settings.firebase_project_id)


def auth_configured() -> bool:
    return oauth_configured() or firebase_configured()


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _sign_payload(payload: dict[str, Any]) -> str:
    secret = get_settings().auth_session_secret
    if len(secret) < 32:
        raise RuntimeError("AUTH_SESSION_SECRET must contain at least 32 characters")
    body = _b64encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64encode(signature)}"


def _verify_payload(token: str, expected_kind: str) -> dict[str, Any] | None:
    try:
        secret = get_settings().auth_session_secret
        if len(secret) < 32:
            return None
        body, supplied_signature = token.split(".", 1)
        expected_signature = hmac.new(
            secret.encode(),
            body.encode(),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_b64decode(supplied_signature), expected_signature):
            return None
        payload = json.loads(_b64decode(body))
        if payload.get("kind") != expected_kind:
            return None
        if int(payload.get("exp", 0)) <= int(time.time()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def current_user_from_request(request: Request) -> dict[str, str] | None:
    token = request.cookies.get(SESSION_COOKIE, "")
    payload = _verify_payload(token, "session") if token else None
    if not payload:
        return None
    return {
        "id": str(payload["sub"]),
        "email": str(payload["email"]),
        "name": str(payload.get("name") or payload["email"]),
        "picture": str(payload.get("picture") or ""),
    }


def _safe_next_path(value: str) -> str:
    if not value.startswith("/") or value.startswith("//") or "\\" in value:
        return "/"
    return value


def _cookie_secure() -> bool:
    settings = get_settings()
    return settings.auth_cookie_secure or settings.environment == "production"


def _validate_email_access(email: str) -> None:
    settings = get_settings()
    allowed_domains = {domain.lower() for domain in settings.oauth_allowed_email_domains}
    email_domain = email.rsplit("@", 1)[-1].lower()
    if allowed_domains and email_domain not in allowed_domains:
        raise HTTPException(status_code=403, detail="email domain is not allowed")


def _normalized_user(
    *,
    sub: str,
    email: str,
    name: str | None = None,
    picture: str | None = None,
) -> dict[str, str]:
    _validate_email_access(email)
    return {
        "id": sub,
        "email": email,
        "name": name or email,
        "picture": picture or "",
    }


def _attach_session_cookie(response: Response, user: dict[str, str]) -> None:
    settings = get_settings()
    now = int(time.time())
    session_token = _sign_payload(
        {
            "kind": "session",
            "sub": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user["picture"],
            "iat": now,
            "exp": now + settings.auth_session_ttl_seconds,
        }
    )
    response.set_cookie(
        SESSION_COOKIE,
        session_token,
        max_age=settings.auth_session_ttl_seconds,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        path="/",
    )


def _ensure_firebase_app() -> None:
    import firebase_admin

    settings = get_settings()
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})


def _verify_firebase_id_token(id_token: str) -> dict[str, str]:
    from firebase_admin import auth as firebase_auth

    _ensure_firebase_app()
    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid firebase token") from exc

    email = str(decoded.get("email") or "")
    if not decoded.get("uid") or not email or decoded.get("email_verified") is False:
        raise HTTPException(status_code=401, detail="firebase account is not verified")

    return _normalized_user(
        sub=str(decoded["uid"]),
        email=email,
        name=str(decoded.get("name") or email),
        picture=str(decoded.get("picture") or ""),
    )


async def _exchange_google_code(code: str) -> dict[str, Any]:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.google_oauth_redirect_uri,
            },
        )
        if token_response.is_error:
            raise HTTPException(status_code=401, detail="google oauth exchange failed")
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="google oauth token missing")
        user_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_response.is_error:
            raise HTTPException(status_code=401, detail="google user lookup failed")
        user = user_response.json()

    if not user.get("sub") or not user.get("email") or user.get("email_verified") is False:
        raise HTTPException(status_code=401, detail="google account is not verified")
    _validate_email_access(str(user["email"]))
    return user


class FirebaseLoginBody(BaseModel):
    id_token: str = Field(min_length=20)


@router.get("/session")
async def session(request: Request) -> dict[str, Any]:
    settings = get_settings()
    user = current_user_from_request(request) if settings.auth_enabled else None
    return {
        "enabled": settings.auth_enabled,
        "configured": auth_configured(),
        "oauth_configured": oauth_configured(),
        "firebase_configured": firebase_configured(),
        "authenticated": user is not None,
        "user": user,
    }


@router.post("/firebase")
async def firebase_login(body: FirebaseLoginBody) -> dict[str, Any]:
    settings = get_settings()
    if not settings.auth_enabled or not firebase_configured():
        raise HTTPException(status_code=503, detail="firebase auth is not configured")

    user = _verify_firebase_id_token(body.id_token)
    response = JSONResponse(
        {
            "authenticated": True,
            "user": user,
        }
    )
    _attach_session_cookie(response, user)
    return response


@router.get("/login")
async def login(next: str = "/") -> RedirectResponse:
    settings = get_settings()
    if not settings.auth_enabled or not oauth_configured():
        raise HTTPException(status_code=503, detail="oauth is not configured")

    nonce = secrets.token_urlsafe(32)
    now = int(time.time())
    state = _sign_payload(
        {
            "kind": "oauth_state",
            "nonce": nonce,
            "next": _safe_next_path(next),
            "exp": now + 600,
        }
    )
    location = f"{GOOGLE_AUTHORIZE_URL}?{urlencode({
        'client_id': settings.google_oauth_client_id,
        'redirect_uri': settings.google_oauth_redirect_uri,
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'prompt': 'select_account',
    })}"
    response = RedirectResponse(location, status_code=307)
    response.set_cookie(
        STATE_COOKIE,
        nonce,
        max_age=600,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        path="/api/v1/auth",
    )
    return response


@router.get("/callback")
async def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    settings = get_settings()
    if not settings.auth_enabled or not oauth_configured():
        raise HTTPException(status_code=503, detail="oauth is not configured")
    if error:
        raise HTTPException(status_code=401, detail=f"google oauth error: {error}")
    payload = _verify_payload(state, "oauth_state")
    cookie_nonce = request.cookies.get(STATE_COOKIE, "")
    if (
        not payload
        or not cookie_nonce
        or not secrets.compare_digest(str(payload.get("nonce", "")), cookie_nonce)
        or not code
    ):
        raise HTTPException(status_code=400, detail="invalid oauth state")

    user = await _exchange_google_code(code)
    response = RedirectResponse(
        f"{settings.frontend_url.rstrip('/')}{_safe_next_path(str(payload.get('next', '/')))}",
        status_code=303,
    )
    _attach_session_cookie(
        response,
        _normalized_user(
            sub=str(user["sub"]),
            email=str(user["email"]),
            name=str(user.get("name") or user["email"]),
            picture=str(user.get("picture") or ""),
        ),
    )
    response.delete_cookie(STATE_COOKIE, path="/api/v1/auth")
    return response


@router.post("/logout", status_code=204)
async def logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response
