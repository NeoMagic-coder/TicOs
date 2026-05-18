"""Run the per-agent LLM test endpoint against every configured agent.

Usage:
    python scripts/test_all_agent_llms.py [--base http://localhost:8000]

Prints one row per agent with ok/err, model, latency, and a snippet of the
returned text. Exit code is 0 if every agent returns ok=true, 1 otherwise.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


def http_get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_post(url: str, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {
            "ok": False,
            "provider": "?",
            "model": "?",
            "text": "",
            "tokens_used": None,
            "duration_ms": 0,
            "error": f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}",
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument(
        "--prompt",
        default='Tek kelime cevap ver: "hazır".',
    )
    ap.add_argument("--max-tokens", type=int, default=16)
    args = ap.parse_args()

    cfgs = http_get(f"{args.base}/api/v1/agents/llm-configs")
    print(f"Loaded {len(cfgs)} agent config(s)\n")

    fmt = "{ok:<4} {agent:<28} {model:<28} {dur:>6}ms  {note}"
    print(fmt.format(ok="STAT", agent="AGENT", model="MODEL", dur="TIME", note="DETAIL"))
    print("-" * 110)

    failures: list[str] = []
    total_started = time.monotonic()
    for c in cfgs:
        agent_id = c["agent_id"]
        if not c.get("enabled"):
            print(fmt.format(ok="skip", agent=agent_id, model=c.get("model", "?"), dur=0, note="enabled=false"))
            continue

        result = http_post(
            f"{args.base}/api/v1/agents/{agent_id}/llm-config/test",
            {"prompt": args.prompt, "max_tokens": args.max_tokens},
        )
        ok = bool(result.get("ok"))
        note = (result.get("text") or "").strip().replace("\n", " ")[:60]
        if not ok:
            err = (result.get("error") or "").replace("\n", " ")[:80]
            note = f"ERR: {err}"
            failures.append(f"{agent_id}: {err}")
        print(
            fmt.format(
                ok="OK" if ok else "FAIL",
                agent=agent_id,
                model=result.get("model", "?")[:28],
                dur=result.get("duration_ms", 0),
                note=note,
            )
        )

    print("-" * 110)
    elapsed = time.monotonic() - total_started
    print(
        f"\nDone in {elapsed:.1f}s · {len(cfgs) - len(failures)}/{len(cfgs)} ok · {len(failures)} failed"
    )
    if failures:
        print("\nFailed agents:")
        for f in failures:
            print(f"  - {f}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
