#!/usr/bin/env python3
"""Fail closed: validate a candidate snapshot before publication."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ALLOWED = {"control_ru", "control_ua", "contested", "unknown"}
REQUIRED_PROPERTIES = {"id", "status", "valid_from", "confidence", "evidence_ids", "moderation"}


def validate(path: Path, min_delay_hours: int = 24) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    if payload.get("type") != "FeatureCollection":
        errors.append("root.type must be FeatureCollection")
    ids: set[str] = set()
    now = datetime.now(timezone.utc)
    for idx, feature in enumerate(payload.get("features", [])):
        prefix = f"feature[{idx}]"
        props = feature.get("properties", {})
        missing = REQUIRED_PROPERTIES - props.keys()
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        fid = props.get("id")
        if fid in ids:
            errors.append(f"{prefix}: duplicate id {fid}")
        ids.add(fid)
        if props.get("status") not in ALLOWED:
            errors.append(f"{prefix}: invalid status")
        confidence = props.get("confidence")
        if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            errors.append(f"{prefix}: confidence must be between 0 and 1")
        if confidence is not None and confidence < 0.93:
            errors.append(f"{prefix}: confidence below publication threshold 0.93")
        if not props.get("evidence_ids"):
            errors.append(f"{prefix}: evidence bundle is empty")
        moderation = props.get("moderation", {})
        if moderation.get("decision") != "approved" or not moderation.get("reviewer"):
            errors.append(f"{prefix}: explicit moderation approval required")
        try:
            valid_from = datetime.fromisoformat(str(props.get("valid_from", "")).replace("Z", "+00:00"))
            age = (now - valid_from).total_seconds() / 3600
            if age < min_delay_hours:
                errors.append(f"{prefix}: public delay is {age:.1f}h, minimum is {min_delay_hours}h")
        except ValueError:
            errors.append(f"{prefix}: valid_from must be ISO-8601")
        geometry = feature.get("geometry")
        if not geometry or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
            errors.append(f"{prefix}: Polygon or MultiPolygon geometry required")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--min-delay-hours", type=int, default=24)
    args = parser.parse_args()
    errors = validate(args.snapshot, args.min_delay_hours)
    if errors:
        print("Snapshot rejected:")
        print("\n".join(f"- {e}" for e in errors))
        return 1
    print(f"Snapshot accepted: {args.snapshot}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
