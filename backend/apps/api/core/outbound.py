"""Restricted outbound HTTP fetches for user-controlled URLs."""
from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import httpx


class UnsafeOutboundURL(ValueError):
    """Raised when an outbound URL could reach a non-public network."""


class OutboundResponseTooLarge(ValueError):
    """Raised when an outbound response exceeds its configured byte limit."""


@dataclass(frozen=True)
class FetchedResource:
    url: str
    content: bytes
    content_type: str

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")


async def validate_public_http_url(url: str) -> str:
    """Return *url* when every resolved address is globally routable."""
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise UnsafeOutboundURL("only public http(s) URLs are allowed")
    if parsed.username or parsed.password:
        raise UnsafeOutboundURL("URL credentials are not allowed")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo,
            parsed.hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise UnsafeOutboundURL("host could not be resolved") from exc
    if not infos:
        raise UnsafeOutboundURL("host could not be resolved")

    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            raise UnsafeOutboundURL("private or reserved network targets are not allowed")
    return url


async def fetch_public_resource(
    url: str,
    *,
    timeout_s: float,
    max_bytes: int,
    headers: dict[str, str] | None = None,
    max_redirects: int = 3,
) -> FetchedResource:
    """Fetch a public URL while validating every redirect and limiting bytes."""
    current = url
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout_s),
        follow_redirects=False,
        trust_env=False,
    ) as client:
        for redirect_count in range(max_redirects + 1):
            await validate_public_http_url(current)
            async with client.stream("GET", current, headers=headers) as response:
                if response.is_redirect:
                    if redirect_count >= max_redirects:
                        raise UnsafeOutboundURL("too many redirects")
                    location = response.headers.get("location")
                    if not location:
                        raise UnsafeOutboundURL("redirect without location")
                    current = urljoin(current, location)
                    continue

                response.raise_for_status()
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > max_bytes:
                    raise OutboundResponseTooLarge("response exceeds byte limit")

                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > max_bytes:
                        raise OutboundResponseTooLarge("response exceeds byte limit")
                    chunks.append(chunk)
                return FetchedResource(
                    url=str(response.url),
                    content=b"".join(chunks),
                    content_type=response.headers.get("content-type", "").split(";", 1)[0].strip(),
                )
    raise UnsafeOutboundURL("redirect limit exceeded")
