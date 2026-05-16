"""Asenkron koordinasyon bus'ı — ajanlar arası mesaj kuyruğu.

Hafif, dağıtık-uyumlu pub/sub. `asyncio.Queue` üzerine kurulu; production'da
Redis Streams veya NATS ile değiştirilebilir bir abstraction. Her mesaj
:class:`CoordinationMessage` şemasıyla taşınır — gönderen, alıcı (veya
broadcast için `*`), topic, payload ve correlation_id.

Tasarım notu: bu bus _merkezi_ bir koordinatör _değildir_, sadece bir
taşıma katmanıdır. Karar mantığı her zaman ilgili ajanda kalır; bu sayede
sistem yatay olarak ölçeklenir ve tek nokta hatası (SPOF) oluşmaz.
"""
from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, AsyncIterator

BROADCAST = "*"


@dataclass
class CoordinationMessage:
    sender: str
    recipient: str  # agent_id veya BROADCAST
    topic: str
    payload: dict[str, Any]
    correlation_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    sent_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class CoordinationBus:
    """Asenkron, topic + recipient bazlı in-process mesaj kuyruğu."""

    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[CoordinationMessage]] = defaultdict(asyncio.Queue)
        self._broadcast: asyncio.Queue[CoordinationMessage] = asyncio.Queue()
        self._history: list[CoordinationMessage] = []

    async def publish(self, message: CoordinationMessage) -> None:
        self._history.append(message)
        if message.recipient == BROADCAST:
            await self._broadcast.put(message)
            for q in self._queues.values():
                await q.put(message)
        else:
            await self._queues[message.recipient].put(message)

    async def subscribe(
        self, agent_id: str, *, timeout: float | None = None
    ) -> CoordinationMessage | None:
        q = self._queues[agent_id]
        try:
            if timeout is None:
                return await q.get()
            return await asyncio.wait_for(q.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def stream(self, agent_id: str) -> AsyncIterator[CoordinationMessage]:
        q = self._queues[agent_id]
        while True:
            yield await q.get()

    @property
    def history(self) -> list[CoordinationMessage]:
        return list(self._history)

    def clear(self) -> None:
        self._queues.clear()
        self._history.clear()
        while not self._broadcast.empty():
            self._broadcast.get_nowait()
