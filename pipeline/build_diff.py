#!/usr/bin/env python3
"""Calculate audited territorial and settlement changes between snapshots."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

from shapely.geometry import Point, shape

try:
    from .geometry import area_km2, as_geojson, features_by_status, polygon_parts
except ImportError:  # direct script execution
    from geometry import area_km2, as_geojson, features_by_status, polygon_parts

LABELS = {
    "control_ru": "контроль российских сил",
    "control_ua": "контроль украинских сил",
    "contested": "оспариваемая зона",
    "unknown": "неопределённый статус",
    None: "без опубликованного статуса",
}


def _origin_status(part, previous: dict[str, object]) -> str | None:
    intersections = [(area_km2(part.intersection(geom)), status) for status, geom in previous.items()]
    intersections = [(area, status) for area, status in intersections if area > 0.001]
    return max(intersections, default=(0, None))[1]


def _evidence_for(part, current: dict, status: str) -> tuple[list[str], list[str], float, list[dict]]:
    evidence: set[str] = set()
    sources: set[str] = set()
    confidence: list[float] = []
    reviews: list[dict] = []
    for feature in current.get("features", []):
        props = feature.get("properties", {})
        if props.get("status") != status or not part.intersects(shape(feature["geometry"])):
            continue
        evidence.update(props.get("evidence_ids", []))
        sources.update(props.get("source_ids", []))
        if isinstance(props.get("confidence"), (int, float)):
            confidence.append(float(props["confidence"]))
        if props.get("moderation"):
            reviews.append(props["moderation"])
    return sorted(evidence), sorted(sources), min(confidence, default=0.93), reviews


def build_changes(previous: dict, current: dict, snapshot_date: str | None = None) -> dict:
    snapshot_date = snapshot_date or current.get("metadata", {}).get("snapshot_date") or date.today().isoformat()
    old = features_by_status(previous)
    new = features_by_status(current)
    features: list[dict] = []
    totals: dict[str, float] = {}
    for to_status, current_geometry in new.items():
        delta = current_geometry.difference(old.get(to_status, shape({"type": "Polygon", "coordinates": []})))
        for part in polygon_parts(delta):
            surface = area_km2(part)
            if surface < 0.001:
                continue
            from_status = _origin_status(part, old)
            evidence_ids, source_ids, confidence, reviews = _evidence_for(part, current, to_status)
            digest = hashlib.sha256(part.wkb + snapshot_date.encode() + to_status.encode()).hexdigest()[:16]
            features.append({
                "type": "Feature",
                "properties": {
                    "id": f"chg-{snapshot_date}-{digest}",
                    "date": snapshot_date,
                    "layer": "change",
                    "from_status": from_status,
                    "to_status": to_status,
                    "status": to_status,
                    "name": "Изменение территориального статуса",
                    "summary": f"{LABELS.get(from_status, from_status)} → {LABELS.get(to_status, to_status)}",
                    "area_km2": round(surface, 3),
                    "confidence": round(confidence, 3),
                    "evidence_ids": evidence_ids,
                    "source_ids": source_ids,
                    "reviews": reviews,
                },
                "geometry": as_geojson(part),
            })
            totals[to_status] = totals.get(to_status, 0) + surface
    total = sum(totals.values())
    return {
        "type": "FeatureCollection",
        "metadata": {
            "from": previous.get("metadata", {}).get("snapshot_date"),
            "to": snapshot_date,
            "area_change_km2": round(total, 3),
            "by_status_km2": {key: round(value, 3) for key, value in sorted(totals.items())},
            "feature_count": len(features),
        },
        "features": features,
    }


def settlement_changes(previous: dict, current: dict, registry: list[dict], snapshot_date: str) -> list[dict]:
    old = features_by_status(previous)
    new = features_by_status(current)

    def locate(point: Point, groups: dict[str, object]) -> str | None:
        matches = [status for status, geometry in groups.items() if geometry.covers(point)]
        return "contested" if len(matches) > 1 else (matches[0] if matches else None)

    changed = []
    for settlement in registry:
        point = Point(float(settlement["lon"]), float(settlement["lat"]))
        before, after = locate(point, old), locate(point, new)
        if before == after:
            continue
        changed.append({
            **settlement,
            "previous_status": before,
            "status": after or "unknown",
            "changed_at": snapshot_date,
        })
    return changed


def settlement_index(current: dict, registry: list[dict], snapshot_date: str) -> list[dict]:
    groups = features_by_status(current)
    indexed = []
    for settlement in registry:
        point = Point(float(settlement["lon"]), float(settlement["lat"]))
        matches = [status for status, geometry in groups.items() if geometry.covers(point)]
        status = "contested" if len(matches) > 1 else (matches[0] if matches else "unknown")
        indexed.append({**settlement, "status": status, "snapshot_date": snapshot_date})
    return indexed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("previous", type=Path)
    parser.add_argument("current", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/changes.geojson"))
    args = parser.parse_args()
    previous = json.loads(args.previous.read_text(encoding="utf-8"))
    current = json.loads(args.current.read_text(encoding="utf-8"))
    changes = build_changes(previous, current)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(changes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Calculated {len(changes['features'])} changes, {changes['metadata']['area_change_km2']} km²")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
