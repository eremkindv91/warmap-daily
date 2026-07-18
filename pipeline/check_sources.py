#!/usr/bin/env python3
"""Check source availability without ingesting or republishing their content."""
from __future__ import annotations

import argparse
import json
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def check(url: str, timeout: int) -> tuple[str, int | None, str | None]:
    request = Request(url, headers={"User-Agent": "WarMap-Daily-source-health/1.0 (+https://github.com/eremkindv91/warmap-daily)"})
    try:
        with urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
            code = response.getcode()
            return ("ok" if 200 <= code < 400 else "degraded", code, None)
    except HTTPError as exc:
        return ("degraded", exc.code, f"HTTP {exc.code}")
    except (URLError, TimeoutError, OSError) as exc:
        return ("unavailable", None, type(exc).__name__)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=Path, default=Path("data/sources.json"))
    parser.add_argument("--output", type=Path, default=Path("data/source-health.json"))
    parser.add_argument("--timeout", type=int, default=15)
    args = parser.parse_args()
    sources = json.loads(args.sources.read_text(encoding="utf-8"))
    checked_at = datetime.now(timezone.utc).isoformat()
    results = []
    for source in sources:
        if not source.get("monitor", True):
            continue
        state, code, error = check(source["url"], args.timeout)
        results.append({"source_id": source["id"], "state": state, "http_status": code, "checked_at": checked_at, "error": error})
        print(f"{source['id']}: {state} ({code or error})")
    monitor_state = "ok"
    if results and all(item["state"] == "unavailable" and item["http_status"] is None for item in results):
        monitor_state = "monitor_error"
        for item in results:
            item["state"] = "unknown"
            item["error"] = "monitor_network_error"
        print("All checks failed at the network layer; source states left unknown")
    args.output.write_text(json.dumps({"checked_at": checked_at, "monitor_state": monitor_state, "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
