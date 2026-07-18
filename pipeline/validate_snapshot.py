#!/usr/bin/env python3
"""Fail closed: validate schema, provenance, geometry and publication delay."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import shape
from shapely.validation import explain_validity

try:
    from .geometry import area_km2
except ImportError:  # direct script execution
    from geometry import area_km2

ALLOWED = {"control_ru", "control_ua", "contested", "unknown"}
REQUIRED_PROPERTIES = {
    "id", "status", "name", "valid_from", "confidence", "evidence_ids", "source_ids", "moderation"
}


def _load_ids(path: Path | None) -> set[str] | None:
    if not path or not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {str(item["id"]) for item in payload}


def validate(
    path: Path,
    min_delay_hours: int = 24,
    evidence_path: Path | None = None,
    sources_path: Path | None = None,
    max_feature_area_km2: float = 150_000,
) -> list[str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot read snapshot: {exc}"]
    errors: list[str] = []
    if payload.get("type") != "FeatureCollection":
        errors.append("root.type must be FeatureCollection")
    metadata = payload.get("metadata", {})
    if payload.get("features") and not metadata.get("snapshot_date"):
        errors.append("metadata.snapshot_date is required for non-empty snapshots")
    known_evidence = _load_ids(evidence_path)
    known_sources = _load_ids(sources_path)
    ids: set[str] = set()
    geometries: list[tuple[str, object]] = []
    now = datetime.now(timezone.utc)
    for idx, feature in enumerate(payload.get("features", [])):
        prefix = f"feature[{idx}]"
        props = feature.get("properties", {})
        missing = REQUIRED_PROPERTIES - props.keys()
        if missing:
            errors.append(f"{prefix}: missing {sorted(missing)}")
        fid = str(props.get("id", ""))
        if not fid:
            errors.append(f"{prefix}: id must not be empty")
        if fid in ids:
            errors.append(f"{prefix}: duplicate id {fid}")
        ids.add(fid)
        if props.get("status") not in ALLOWED:
            errors.append(f"{prefix}: invalid status")
        confidence = props.get("confidence")
        if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
            errors.append(f"{prefix}: confidence must be between 0 and 1")
        elif confidence < 0.93:
            errors.append(f"{prefix}: confidence below publication threshold 0.93")
        evidence_ids = props.get("evidence_ids", [])
        source_ids = props.get("source_ids", [])
        if not evidence_ids:
            errors.append(f"{prefix}: evidence bundle is empty")
        if len(set(evidence_ids)) != len(evidence_ids):
            errors.append(f"{prefix}: duplicate evidence ids")
        if known_evidence is not None:
            unknown = set(evidence_ids) - known_evidence
            if unknown:
                errors.append(f"{prefix}: unknown evidence ids {sorted(unknown)}")
        if not source_ids:
            errors.append(f"{prefix}: source ids are empty")
        if known_sources is not None:
            unknown = set(source_ids) - known_sources
            if unknown:
                errors.append(f"{prefix}: unknown source ids {sorted(unknown)}")
        moderation = props.get("moderation", {})
        if moderation.get("decision") != "approved" or not moderation.get("reviewer") or not moderation.get("reviewed_at"):
            errors.append(f"{prefix}: explicit moderation approval, reviewer and reviewed_at required")
        try:
            valid_from = datetime.fromisoformat(str(props.get("valid_from", "")).replace("Z", "+00:00"))
            if valid_from.tzinfo is None:
                raise ValueError("timezone required")
            age = (now - valid_from.astimezone(timezone.utc)).total_seconds() / 3600
            if age < min_delay_hours:
                errors.append(f"{prefix}: public delay is {age:.1f}h, minimum is {min_delay_hours}h")
        except (ValueError, TypeError):
            errors.append(f"{prefix}: valid_from must be timezone-aware ISO-8601")
        geometry_json = feature.get("geometry")
        if not geometry_json or geometry_json.get("type") not in {"Polygon", "MultiPolygon"}:
            errors.append(f"{prefix}: Polygon or MultiPolygon geometry required")
            continue
        try:
            geometry = shape(geometry_json)
            if geometry.is_empty:
                errors.append(f"{prefix}: geometry is empty")
            if not geometry.is_valid:
                errors.append(f"{prefix}: invalid geometry: {explain_validity(geometry)}")
            minx, miny, maxx, maxy = geometry.bounds
            if minx < -180 or maxx > 180 or miny < -90 or maxy > 90:
                errors.append(f"{prefix}: coordinates outside WGS84 bounds")
            surface = area_km2(geometry)
            if surface <= 0:
                errors.append(f"{prefix}: geometry has zero area")
            if surface > max_feature_area_km2:
                errors.append(f"{prefix}: anomalous area {surface:.1f} km²")
            geometries.append((prefix, geometry))
        except (TypeError, ValueError, KeyError) as exc:
            errors.append(f"{prefix}: unreadable geometry: {exc}")
    for left in range(len(geometries)):
        for right in range(left + 1, len(geometries)):
            left_name, left_geometry = geometries[left]
            right_name, right_geometry = geometries[right]
            overlap = area_km2(left_geometry.intersection(right_geometry))
            if overlap > 0.001:
                errors.append(f"{left_name} overlaps {right_name} by {overlap:.3f} km²")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--min-delay-hours", type=int, default=24)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--sources", type=Path)
    parser.add_argument("--max-feature-area-km2", type=float, default=150_000)
    args = parser.parse_args()
    errors = validate(
        args.snapshot, args.min_delay_hours, args.evidence, args.sources, args.max_feature_area_km2
    )
    if errors:
        print("Snapshot rejected:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print(f"Snapshot accepted: {args.snapshot}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
