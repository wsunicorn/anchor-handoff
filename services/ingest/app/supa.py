"""Client Supabase tối giản qua REST (PostgREST, Storage, Auth) — không dùng SDK Python
(bản đang phát hành bị yanked, phụ thuộc không cố định). Chỉ những gì pipeline cần."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


class SupabaseError(RuntimeError):
    pass


class Supabase:
    def __init__(self, url: str, service_key: str) -> None:
        self._url = url.rstrip("/")
        self._key = service_key
        self._http = httpx.AsyncClient(
            base_url=self._url,
            headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
            timeout=httpx.Timeout(60.0, connect=10.0),
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    # ---------- Auth ----------
    async def user_from_jwt(self, jwt: str) -> dict[str, Any]:
        """Xác minh JWT của người dùng bằng chính GoTrue; trả về object user (có `id`)."""
        r = await self._http.get(
            "/auth/v1/user", headers={"Authorization": f"Bearer {jwt}", "apikey": self._key}
        )
        if r.status_code != 200:
            raise PermissionError("invalid_jwt")
        return r.json()

    # ---------- PostgREST ----------
    async def select(self, table: str, **params: str) -> list[dict[str, Any]]:
        r = await self._http.get(f"/rest/v1/{table}", params=params)
        self._raise(r)
        return r.json()

    async def insert(self, table: str, rows: list[dict[str, Any]] | dict[str, Any]) -> list[dict[str, Any]]:
        r = await self._http.post(
            f"/rest/v1/{table}", json=rows, headers={"Prefer": "return=representation"}
        )
        self._raise(r)
        return r.json()

    async def update(self, table: str, patch: dict[str, Any], **filters: str) -> list[dict[str, Any]]:
        r = await self._http.patch(
            f"/rest/v1/{table}", json=patch, params=filters, headers={"Prefer": "return=representation"}
        )
        self._raise(r)
        return r.json()

    async def delete(self, table: str, **filters: str) -> None:
        r = await self._http.delete(f"/rest/v1/{table}", params=filters)
        self._raise(r)

    # ---------- Storage ----------
    async def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        r = await self._http.post(
            f"/storage/v1/object/{bucket}/{path}",
            content=data,
            headers={"Content-Type": content_type, "x-upsert": "true"},
        )
        self._raise(r)

    async def download(self, bucket: str, path: str) -> bytes:
        r = await self._http.get(f"/storage/v1/object/{bucket}/{path}")
        self._raise(r)
        return r.content

    @staticmethod
    def _raise(r: httpx.Response) -> None:
        if r.status_code >= 400:
            raise SupabaseError(f"{r.request.method} {r.request.url.path} → {r.status_code}: {r.text[:300]}")


supabase = Supabase(settings.supabase_url, settings.supabase_service_role_key)
