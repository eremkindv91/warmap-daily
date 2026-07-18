#!/usr/bin/env python3
"""Publish an approved candidate, preserving previous and dated snapshots."""
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from validate_snapshot import validate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--approved", action="store_true", help="required explicit publication gate")
    args = parser.parse_args()
    if not args.approved:
        raise SystemExit("Refusing publication: pass --approved only after human review")
    errors = validate(args.candidate)
    if errors:
        raise SystemExit("Snapshot rejected:\n" + "\n".join(errors))
    payload = json.loads(args.candidate.read_text(encoding="utf-8"))
    date = payload.get("metadata", {}).get("snapshot_date")
    if not date:
        raise SystemExit("metadata.snapshot_date is required")
    args.data_dir.mkdir(parents=True, exist_ok=True)
    current = args.data_dir / "current.geojson"
    previous = args.data_dir / "previous.geojson"
    if current.exists():
        shutil.copy2(current, previous)
    archive = args.data_dir / "snapshots" / date
    archive.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.candidate, current)
    shutil.copy2(args.candidate, archive / "current.geojson")
    status = {
        "state": "current",
        "snapshot_date": date,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "area_change_km2": payload.get("metadata", {}).get("area_change_km2", 0),
        "methodology_version": payload.get("metadata", {}).get("methodology_version", "1.0"),
    }
    (args.data_dir / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Published snapshot {date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
