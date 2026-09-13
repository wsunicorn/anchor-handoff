"""Embedding qua Google Gemini (ADR-0001: một nhà cung cấp, định tuyến theo việc).
`gemini-embedding-001` hỗ trợ cắt chiều Matryoshka → 768 khớp `vector(768)` trong schema."""

from __future__ import annotations

import asyncio
import logging

from google import genai
from google.genai import types

from app.config import settings

log = logging.getLogger(__name__)

BATCH = 100  # giới hạn số nội dung mỗi lời gọi của API


class EmbeddingUnavailable(RuntimeError):
    pass


def _client() -> genai.Client:
    if not settings.llm_provider_api_key:
        raise EmbeddingUnavailable("missing_llm_provider_api_key")
    return genai.Client(api_key=settings.llm_provider_api_key)


def _fake_vector(text: str, dim: int) -> list[float]:
    """Vector tất định từ SHA-256 — cùng văn bản → cùng vector; không mang nghĩa. Chỉ dev/CI."""
    import hashlib
    import math

    seed = hashlib.sha256(text.encode("utf-8")).digest()
    raw = [((seed[i % 32] * (i + 1)) % 255) / 255.0 - 0.5 for i in range(dim)]
    norm = math.sqrt(sum(v * v for v in raw)) or 1.0
    return [v / norm for v in raw]


async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embedding cho đoạn tài liệu (task RETRIEVAL_DOCUMENT). Truy vấn ở G2 dùng RETRIEVAL_QUERY."""
    if not texts:
        return []
    if settings.embedding_provider == "fake":
        log.warning("EMBEDDING_PROVIDER=fake — vector giả, không dùng để đo chất lượng")
        return [_fake_vector(t, settings.embedding_dim) for t in texts]
    client = _client()
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        for attempt in range(4):
            try:
                resp = await client.aio.models.embed_content(
                    model=settings.embedding_model,
                    contents=batch,
                    config=types.EmbedContentConfig(
                        task_type="RETRIEVAL_DOCUMENT",
                        output_dimensionality=settings.embedding_dim,
                    ),
                )
                break
            except Exception as e:  # lỗi mạng/429: lùi luỹ thừa, tối đa 4 lần
                if attempt == 3:
                    raise
                wait = 2**attempt
                log.warning("embed lỗi (%s), thử lại sau %ss", e, wait)
                await asyncio.sleep(wait)
        for emb in resp.embeddings or []:
            values = list(emb.values or [])
            if len(values) != settings.embedding_dim:
                raise EmbeddingUnavailable(f"embedding_dim_mismatch:{len(values)}")
            out.append(values)
    return out
