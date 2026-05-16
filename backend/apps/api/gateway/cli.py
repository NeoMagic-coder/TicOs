"""CLI gateway adapter — stdin/stdout for local terminal use.

Start it with:
    python -m apps.api.gateway.cli

Reads one prompt per line from stdin, runs it through Hermes, and prints
the Turkish summary to stdout. Ctrl+C exits cleanly.
"""
from __future__ import annotations

import asyncio
import sys

from apps.api.core.logging import get_logger
from apps.api.gateway.base import BaseGatewayAdapter

log = get_logger(__name__)

_SYSTEM_USER_ID = "cli_user"
_SYSTEM_CHAT_ID = "cli_session"


class CLIAdapter(BaseGatewayAdapter):
    platform = "cli"

    async def start(self) -> None:
        log.info("gateway.cli.ready")
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)
        print("OneProduct Agent OS — CLI Gateway. Çıkmak için Ctrl+C.\n", flush=True)
        try:
            while True:
                line = await reader.readline()
                if not line:
                    break
                text = line.decode().rstrip("\n")
                if text:
                    await self.handle_incoming(_SYSTEM_USER_ID, _SYSTEM_CHAT_ID, text)
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass

    async def stop(self) -> None:
        pass

    async def send_message(self, chat_id: str, text: str) -> None:
        print(f"\n{text}\n", flush=True)


if __name__ == "__main__":
    from apps.api.core.db import init_db
    from apps.api.core.openclaw.registry import get_registry

    init_db()
    get_registry().load_manifests()
    asyncio.run(CLIAdapter().start())
