"""Abstract base for all platform gateway adapters."""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import GatewaySessionRow
from apps.api.core.hermes.orchestrator import get_orchestrator
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_MAX_HISTORY = 50  # turns before capping


def _get_or_create_session(platform: str, platform_user_id: str, platform_chat_id: str) -> GatewaySessionRow:
    with session_scope() as db:
        row = db.execute(
            select(GatewaySessionRow).where(
                and_(
                    GatewaySessionRow.platform == platform,
                    GatewaySessionRow.platform_chat_id == platform_chat_id,
                )
            )
        ).scalars().first()
        if row is None:
            row = GatewaySessionRow(
                id=f"gw_{uuid.uuid4().hex[:12]}",
                platform=platform,
                platform_user_id=platform_user_id,
                platform_chat_id=platform_chat_id,
                history=[],
                product_context={},
                last_active_at=datetime.now(UTC),
            )
            db.add(row)
        return row


def _save_session(session: GatewaySessionRow) -> None:
    with session_scope() as db:
        row = db.get(GatewaySessionRow, session.id)
        if row:
            row.history = session.history[-_MAX_HISTORY:]
            row.product_context = session.product_context
            row.last_active_at = datetime.now(UTC)
        else:
            db.add(session)


class BaseGatewayAdapter(ABC):
    platform: str

    @abstractmethod
    async def start(self) -> None:
        """Initialise the platform connection (register webhooks, start listeners)."""

    @abstractmethod
    async def stop(self) -> None:
        """Graceful shutdown."""

    @abstractmethod
    async def send_message(self, chat_id: str, text: str) -> None:
        """Deliver a text message back to the originating chat."""

    async def handle_incoming(
        self,
        platform_user_id: str,
        chat_id: str,
        text: str,
        voice_url: str | None = None,
    ) -> None:
        """Receive an incoming message, run Hermes, and deliver the response."""
        if voice_url:
            from apps.api.gateway.transcriber import transcribe
            try:
                text = await transcribe(voice_url)
            except Exception as exc:
                log.warning("gateway.transcribe_failed", platform=self.platform, error=str(exc)[:120])

        session = _get_or_create_session(self.platform, platform_user_id, chat_id)
        orchestrator = get_orchestrator()

        log.info("gateway.incoming", platform=self.platform, chat_id=chat_id, text_len=len(text))
        try:
            result = await orchestrator.handle(
                message=text,
                history=session.history,
                product_context={**session.product_context, "source": f"gateway.{self.platform}"},
            )
            reply = result.summary or "İşlem tamamlandı."
        except Exception as exc:
            log.warning("gateway.orchestrator_failed", platform=self.platform, error=str(exc)[:200])
            reply = "Üzgünüm, isteğinizi işlerken bir sorun oluştu. Lütfen tekrar deneyin."

        session.history.append({"role": "user", "content": text})
        session.history.append({"role": "assistant", "content": reply})
        _save_session(session)

        try:
            await self.send_message(chat_id, reply)
        except Exception as exc:
            log.warning("gateway.send_failed", platform=self.platform, chat_id=chat_id, error=str(exc)[:120])
