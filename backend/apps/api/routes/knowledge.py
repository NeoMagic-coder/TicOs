"""Knowledge base: document upload + RAG search.

Documents are chunked (~800 chars), each chunk gets its own embedding via
`add_memory(kind="knowledge")`. Search delegates to `search_memory` so it
uses pgvector when available and falls back to in-Python cosine.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from apps.api.core.memory.store import add_memory, search_memory

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

_CHUNK_SIZE = 800
_CHUNK_OVERLAP = 100


def _chunk_text(text: str) -> list[str]:
    """Sliding-window chunking. Keeps a small overlap so semantic boundaries
    that fall on a chunk edge still have a chance to be retrieved."""
    text = (text or "").strip()
    if not text:
        return []
    chunks: list[str] = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + _CHUNK_SIZE])
        if i + _CHUNK_SIZE >= len(text):
            break
        i += _CHUNK_SIZE - _CHUNK_OVERLAP
    return chunks


class UploadBody(BaseModel):
    title: str
    content: str
    tags: list[str] = []


@router.post("/upload")
async def upload_doc(body: UploadBody) -> dict[str, Any]:
    """Index a document as RAG-searchable knowledge."""
    chunks = _chunk_text(body.content)
    if not chunks:
        raise HTTPException(status_code=400, detail="content is empty")
    written: list[str] = []
    for idx, chunk in enumerate(chunks):
        row_id = await add_memory(
            text=chunk,
            kind="knowledge",
            metadata={"title": body.title, "chunk_index": idx, "tags": body.tags},
        )
        if row_id:
            written.append(row_id)
    return {
        "title": body.title,
        "chunks_total": len(chunks),
        "chunks_indexed": len(written),
        "ids": written,
    }


@router.post("/upload-file")
async def upload_file(file: UploadFile) -> dict[str, Any]:
    """Same as /upload but accepts a .txt or .md file directly."""
    raw = (await file.read()).decode("utf-8", errors="ignore")
    body = UploadBody(title=file.filename or "untitled", content=raw, tags=[])
    return await upload_doc(body)


@router.get("/search")
async def search(q: str, k: int = 5) -> dict[str, Any]:
    matches = await search_memory(query=q, k=k, kind="knowledge")
    return {"query": q, "matches": matches}
