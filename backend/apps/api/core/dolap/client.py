"""Dolap mobile API client.

Ported from community ``dolap_flask`` patterns (``api.dolap.com``). This is
**not** an official Trendyol/Dolap Partner API — it mimics the iOS app headers.
Configure via ``DOLAP_USERNAME`` + ``DOLAP_PASSWORD`` or ``DOLAP_ACCESS_TOKEN``.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any

import httpx
import requests

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_API = "https://api.dolap.com"
_PROFILE = "https://dolap.com/profil"
_TIMEOUT = httpx.Timeout(connect=8.0, read=25.0, write=12.0, pool=5.0)
_HTTP = {"timeout": _TIMEOUT, "http2": False}

# Default from dolap_flask; override with DOLAP_SIGNATURE when Dolap rotates it.
_DEFAULT_SIGNATURE = (
    "5cab951838fadd0cfe570febf21b1a04aa71bff90faafc47e1d3a6b730d3da493f43d76a26fb4dd6c79930d145e5bfa8762466d9cc9ab983e5eb0872f7b8d1c0"
)


def dolap_configured() -> bool:
    s = get_settings()
    return bool(
        (s.dolap_access_token and s.dolap_access_token.strip())
        or (s.dolap_username.strip() and s.dolap_password.strip())
    )


class DolapClient:
    def __init__(self) -> None:
        self._token_cache: str | None = None
        self._member_nickname: str | None = None
        self._member_id: str | None = None

    def _settings(self):
        return get_settings()

    def _resolve_nickname(self, nickname: str | None = None) -> str:
        s = self._settings()
        if nickname:
            return nickname.strip().lower()
        if s.dolap_nickname:
            return s.dolap_nickname.strip().lower()
        if self._member_nickname:
            return self._member_nickname
        raw = (s.dolap_username or "").strip().lower()
        if "@" in raw:
            raise RuntimeError(
                "DOLAP_NICKNAME gerekli — giriş e-postası ile profil bulunamaz. "
                ".env.local'a Dolap @kullanıcı adınızı ekleyin."
            )
        return raw

    async def _resolve_owner_id(self, nickname: str) -> str:
        if self._member_id and nickname == (self._member_nickname or nickname):
            return self._member_id
        return await self.member_id_from_nickname(nickname)

    def _epoch(self) -> str:
        return str(int(time.time()))

    def _headers(self, *, access_token: str, json_body: bool = False) -> dict[str, str]:
        s = self._settings()
        h: dict[str, str] = {
            "Accept": "*/*",
            "X-Epoch-Seconds": self._epoch(),
            "X-Signature": s.dolap_signature or _DEFAULT_SIGNATURE,
            "AppVersion": s.dolap_app_version,
            "Accept-Language": "tr-tr",
            "Accept-Encoding": "gzip, deflate",
            "Access-Token": access_token,
            "User-Agent": s.dolap_user_agent,
            "Connection": "close",
            "AppPlatform": s.dolap_app_platform,
        }
        if s.dolap_category_group and access_token:
            h["CategoryGroup"] = s.dolap_category_group
        if json_body:
            h["Content-Type"] = "application/json"
        return h

    async def resolve_token(self, *, force_login: bool = False) -> str:
        s = self._settings()
        if s.dolap_access_token and not force_login:
            return s.dolap_access_token
        if self._token_cache and not force_login:
            return self._token_cache
        if not (s.dolap_username and s.dolap_password):
            raise RuntimeError("DOLAP_USERNAME and DOLAP_PASSWORD required when DOLAP_ACCESS_TOKEN is empty")
        token = await self.login(s.dolap_username, s.dolap_password)
        self._token_cache = token
        return token

    async def login(self, username: str, password: str) -> str:
        return await asyncio.to_thread(self._login_sync, username, password)

    def _login_sync(self, username: str, password: str) -> str:
        s = self._settings()
        body = {
            "username": username.strip().lower(),
            "password": password,
            "memberCookie": s.dolap_member_cookie,
            "advertisingId": "00000000-0000-0000-0000-000000000000",
        }
        payload = json.dumps(body, separators=(",", ":"))
        headers = {
            "Host": "api.dolap.com",
            "Accept": "*/*",
            "X-Epoch-Seconds": str(int(time.time())),
            "X-Signature": s.dolap_signature or _DEFAULT_SIGNATURE,
            "AppVersion": s.dolap_app_version,
            "Accept-Language": "tr-tr",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
            "Access-Token": "",
            "User-Agent": s.dolap_user_agent,
            "Connection": "close",
            "AppPlatform": s.dolap_app_platform,
        }
        resp = requests.post(
            f"{_API}/member/login/",
            headers=headers,
            data=payload,
            timeout=15,
        )
        if resp.status_code != 200:
            log.warning("dolap.login_failed", status=resp.status_code, body=resp.text[:200])
            raise RuntimeError(f"Dolap login failed: HTTP {resp.status_code}")
        data = resp.json()
        token = data.get("accessToken")
        if not token:
            raise RuntimeError("Dolap login response missing accessToken")
        member = data.get("member") or {}
        if member.get("nickname"):
            self._member_nickname = str(member["nickname"]).strip().lower()
        if member.get("id"):
            self._member_id = str(member["id"])
        return str(token)

    async def member_id_from_nickname(self, nickname: str) -> str:
        nick = nickname.strip().lower()
        url = f"{_PROFILE}/{nick}"
        async with httpx.AsyncClient(**_HTTP, follow_redirects=True) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            raise RuntimeError(f"Dolap profile not found for '{nick}': HTTP {resp.status_code}")
        m = re.search(r'data-member-id=["\'](\d+)["\']', resp.text)
        if not m:
            raise RuntimeError(f"Could not parse member id for '{nick}'")
        return m.group(1)

    async def get_profile(self, nickname: str | None = None) -> dict[str, Any]:
        nick = self._resolve_nickname(nickname)
        token = await self.resolve_token()
        member_id = await self._resolve_owner_id(nick)
        headers = self._headers(access_token=token, json_body=True)
        body = {"memberId": int(member_id)}
        async with httpx.AsyncClient(**_HTTP) as client:
            resp = await client.post(
                f"{_API}/member/closet",
                headers=headers,
                content=json.dumps(body, separators=(",", ":")),
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Dolap closet failed: HTTP {resp.status_code}")
        data = resp.json()
        member = data.get("member") or {}
        return {
            "nickname": nick,
            "member_id": member.get("id") or int(member_id),
            "follower_count": data.get("followerCount", 0),
            "followee_count": data.get("followeeCount", 0),
            "display_name": member.get("nickname") or nick,
        }

    async def get_products(
        self,
        nickname: str | None = None,
        *,
        max_pages: int = 20,
    ) -> dict[str, Any]:
        nick = self._resolve_nickname(nickname)
        token = await self.resolve_token()
        owner_id = await self._resolve_owner_id(nick)
        headers = self._headers(access_token=token, json_body=True)
        products: list[dict[str, Any]] = []
        page = 0
        while page < max_pages:
            body = {
                "clearFilter": False,
                "showSoldItems": False,
                "sortField": "ID",
                "page": page,
                "ascending": False,
                "mySizeSelection": False,
                "ownerId": int(owner_id),
                "aggregation": False,
            }
            async with httpx.AsyncClient(**_HTTP) as client:
                resp = await client.post(
                    f"{_API}/search",
                    headers=headers,
                    content=json.dumps(body, separators=(",", ":")),
                )
            if resp.status_code != 200:
                raise RuntimeError(f"Dolap search failed: HTTP {resp.status_code}")
            data = resp.json()
            batch = data.get("products") or []
            if not batch:
                break
            for item in batch:
                thumb = (item.get("thumbnailImage") or {}).get("path")
                products.append(
                    {
                        "id": item.get("id"),
                        "title": item.get("title"),
                        "price": item.get("price"),
                        "like_count": item.get("likeCount", 0),
                        "comment_count": item.get("commentCount", 0),
                        "thumbnail_url": thumb,
                        "url": f"https://dolap.com/urun/{item.get('id')}" if item.get("id") else None,
                    }
                )
            page += 1
        return {
            "nickname": nick,
            "owner_id": int(owner_id),
            "total": len(products),
            "products": products,
        }

    async def close_listing(self, product_id: int | str) -> dict[str, Any]:
        token = await self.resolve_token()
        headers = self._headers(access_token=token, json_body=True)
        body = {"productId": int(product_id)}
        async with httpx.AsyncClient(**_HTTP) as client:
            resp = await client.post(
                f"{_API}/product/close",
                headers=headers,
                content=json.dumps(body, separators=(",", ":")),
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Dolap close listing failed: HTTP {resp.status_code}")
        return {"product_id": str(product_id), "status": "closed", "ok": True}

    async def probe(self) -> dict[str, Any]:
        """Lightweight connectivity check for integrations page."""
        profile = await self.get_profile()
        return {
            "ok": True,
            "nickname": profile.get("nickname"),
            "member_id": profile.get("member_id"),
            "follower_count": profile.get("follower_count"),
        }
