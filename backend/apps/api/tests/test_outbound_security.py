"""Security tests for user-controlled outbound URLs."""
from __future__ import annotations

import socket

import pytest

from apps.api.core.outbound import UnsafeOutboundURL, validate_public_http_url


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/admin",
        "http://[::1]/admin",
        "http://169.254.169.254/latest/meta-data",
        "file:///etc/passwd",
        "http://user:pass@example.com/",
    ],
)
async def test_validate_public_http_url_rejects_unsafe_targets(url: str) -> None:
    with pytest.raises(UnsafeOutboundURL):
        await validate_public_http_url(url)


@pytest.mark.asyncio
async def test_validate_public_http_url_accepts_public_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
        ],
    )

    assert await validate_public_http_url("https://example.com/product") == (
        "https://example.com/product"
    )


@pytest.mark.asyncio
async def test_validate_public_http_url_rejects_dns_to_private_address(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.8", 80)),
        ],
    )

    with pytest.raises(UnsafeOutboundURL):
        await validate_public_http_url("http://attacker.example/internal")
