#!/usr/bin/env python3
"""Publish an approved snapshot with diff, archive, manifest and immutable audit hash."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

try:
    from .build_diff import build_changes, settlement_changes, settlement_index
    from .validate_snapshot import validate
except ImportError:  # direct script execution
    from build_diff import build_changes, settlement_changes, settlement_index
    from validate_snapshot import validate


def _read(path: Path, fallback):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def _write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--settlement-registry", type=Path, default=Path("config/settlements.json"))
    parser.add_argument("--approved", action="store_true", help="explicit human publication gate")
    args = parser.parse_args()
    if not args.approved:
        raise SystemExit("Refusing publication: pass --approved only after human review")
    errors = validate(
        args.candidate,
        evidence_path=args.data_dir / "evidence.json",
        sources_path=args.data_dir / "sources.json",
    )
    if errors:
        raise SystemExit("Snapshot rejected:\n" + "\n".join(errors))
    candidate = _read(args.candidate, {})
    snapshot_date = candidate.get("metadata", {}).get("snapshot_date")
    if not snapshot_date:
        raise SystemExit("metadata.snapshot_date is required")
    current_path = args.data_dir / "current.geojson"
    previous = _read(current_path, {"type": "FeatureCollection", "metadata": {}, "features": []})
    changes = build_changes(previous, candidate, snapshot_date)
    registry = _read(args.settlement_registry, [])
    changed_settlements = settlement_changes(previous, candidate, registry, snapshot_date)
    indexed_settlements = settlement_index(candidate, registry, snapshot_date)
    published_at = datetime.now(timezone.utc).isoformat()
    archive = args.data_dir / "snapshots" / snapshot_date
    if current_path.exists():
        shutil.copy2(current_path, args.data_dir / "previous.geojson")
    _write(current_path, candidate)
    _write(args.data_dir / "changes.geojson", changes)
    _write(args.data_dir / "settlements.json", changed_settlements)
    _write(args.data_dir / "settlements-index.json", indexed_settlements)
    for name, payload in (
        ("current.geojson", candidate), ("changes.geojson", changes),
        ("settlements.json", changed_settlements), ("events.json", _read(args.data_dir / "events.json", [])),
    ):
        _write(archive / name, payload)
    digest = hashlib.sha256(args.candidate.read_bytes()).hexdigest()
    status = {
        "state": "current",
        "snapshot_date": snapshot_date,
        "published_at": published_at,
        "area_change_km2": changes["metadata"]["area_change_km2"],
        "new_settlements": len(changed_settlements),
        "methodology_version": candidate.get("metadata", {}).get("methodology_version", "1.0"),
        "snapshot_sha256": digest,
        "public_delay_hours": 24,
        "warning": "Аналитическая оценка по открытым источникам. Не используйте для решений, связанных с безопасностью.",
    }
    _write(args.data_dir / "status.json", status)
    _write(archive / "status.json", status)
    manifest_path = args.data_dir / "snapshots" / "index.json"
    manifest = _read(manifest_path, [])
    manifest = [item for item in manifest if item.get("date") != snapshot_date]
    manifest.append({
        "date": snapshot_date,
        "published_at": published_at,
        "area_change_km2": changes["metadata"]["area_change_km2"],
        "change_count": len(changes["features"]),
        "settlement_count": len(changed_settlements),
        "sha256": digest,
    })
    manifest.sort(key=lambda item: item["date"], reverse=True)
    _write(manifest_path, manifest)
    audit_path = args.data_dir / "audit-log.json"
    audit = _read(audit_path, [])
    audit.append({
        "action": "publish_snapshot", "snapshot_date": snapshot_date,
        "published_at": published_at, "sha256": digest,
        "reviewers": sorted({f["properties"]["moderation"]["reviewer"] for f in candidate["features"]}),
    })
    _write(audit_path, audit)
    print(f"Published {snapshot_date}: {len(changes['features'])} changes, sha256 {digest[:12]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
