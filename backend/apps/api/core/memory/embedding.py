"""Embedding helper for the vector memory.

Uses Gemini's ``gemini-embedding-001`` with ``output_dimensionality=768`` to
keep the pgvector schema (768-dim) compatible; falls back to a deterministic
hash-based mock embedding when no ``GEMINI_API_KEY`` is configured or the
API call fails.
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

    if settings.gemini_api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.gemini_api_key)
            result = await client.aio.models.embed_content(
                model=settings.embedding_model,
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=dim),
            )
            vec = list(result.embeddings[0].values)
            if len(vec) == dim:
                # gemini-embedding-001 only normalizes the full 3072-dim output;
                # truncated dims must be L2-normalized client-side.
                norm = math.sqrt(sum(v * v for v in vec)) or 1.0
                return [v / norm for v in vec]
            log.warning("embedding.dim_mismatch", expected=dim, got=len(vec))
        except Exception as exc:
            log.warning("embedding.gemini_failed", error=str(exc)[:200])

    return _mock_embedding(text, dim)


def _mock_embedding(text: str, dim: int) -> list[float]:
    """Deterministic L2-normalised vector derived from SHA-256 bytes.

    Not semantically meaningful — only used to keep the pipeline functional
    when no Gemini key is configured (tests, MockProvider-only dev).
    """
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
