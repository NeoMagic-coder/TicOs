"""Embedding helper for the vector memory.

Uses Amazon Bedrock Titan embeddings when ``AWS_BEARER_TOKEN_BEDROCK`` is set;
falls back to a deterministic hash-based mock embedding when the API call fails
or no token is configured.
"""
from __future__ import annotations

import hashlib
import math

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)


async def embed_text(text: str) -> list[float]:
    settings = get_settings()
    dim = settings.embedding_dim
    text = (text or "").strip()
    if not text:
        return [0.0] * dim

    if settings.aws_bearer_token_bedrock:
        try:
            from apps.api.core.llm.bedrock_runtime import embed_text as bedrock_embed

            return await bedrock_embed(text, dim=dim)
        except Exception as exc:
            log.warning("embedding.bedrock_failed", error=str(exc)[:200])

    return _mock_embedding(text, dim)


def _mock_embedding(text: str, dim: int) -> list[float]:
    """Deterministic L2-normalised vector derived from SHA-256 bytes."""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    raw = (digest * ((dim // len(digest)) + 1))[:dim]
    vec = [(b / 255.0) * 2.0 - 1.0 for b in raw]
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
