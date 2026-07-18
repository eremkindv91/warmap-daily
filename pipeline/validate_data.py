#!/usr/bin/env python3
"""Validate public records and their provenance links."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

EVENT_STATUSES = {"claim", "disputed", "probable", "confirmed", "corrected", "withdrawn"}
SIDES = {"russian", "ukrainian", "independent", "multiple"}


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _valid_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def validate_data(data_dir: Path) -> list[str]:
    errors: list[str] = []
    sources = _read(data_dir / "sources.json")
    evidence = _read(data_dir / "evidence.json")
    events = _read(data_dir / "events.json")
    claims = _read(data_dir / "claims.json")
    manifest = _read(data_dir / "snapshots" / "index.json")
    source_ids = [item.get("id") for item in sources]
    evidence_ids = [item.get("id") for item in evidence]
    if len(source_ids) != len(set(source_ids)):
        errors.append("sources: duplicate ids")
    if len(evidence_ids) != len(set(evidence_ids)):
        errors.append("evidence: duplicate ids")
    for idx, source in enumerate(sources):
        for field in ("id", "name", "role", "url", "side", "kind", "usage_note", "license_status"):
            if not source.get(field):
                errors.append(f"sources[{idx}]: missing {field}")
        if source.get("side") not in SIDES:
            errors.append(f"sources[{idx}]: invalid side")
        if not _valid_url(source.get("url", "")):
            errors.append(f"sources[{idx}]: url must be HTTPS")
    for idx, item in enumerate(evidence):
        for field in ("id", "source_id", "published_at", "url", "evidence_type"):
            if not item.get(field):
                errors.append(f"evidence[{idx}]: missing {field}")
        if item.get("source_id") not in source_ids:
            errors.append(f"evidence[{idx}]: unknown source_id")
        if not _valid_url(item.get("url", "")):
            errors.append(f"evidence[{idx}]: url must be HTTPS")
    for collection_name, collection in (("events", events), ("claims", claims)):
        for idx, item in enumerate(collection):
            for field in ("id", "title", "summary", "event_date", "verification_status", "source_ids", "evidence_ids"):
                if field not in item or item.get(field) in (None, ""):
                    errors.append(f"{collection_name}[{idx}]: missing {field}")
            if item.get("verification_status") not in EVENT_STATUSES:
                errors.append(f"{collection_name}[{idx}]: invalid verification_status")
            unknown_sources = set(item.get("source_ids", [])) - set(source_ids)
            unknown_evidence = set(item.get("evidence_ids", [])) - set(evidence_ids)
            if unknown_sources:
                errors.append(f"{collection_name}[{idx}]: unknown sources {sorted(unknown_sources)}")
            if unknown_evidence:
                errors.append(f"{collection_name}[{idx}]: unknown evidence {sorted(unknown_evidence)}")
    dates = [item.get("date") for item in manifest]
    if dates != sorted(dates, reverse=True):
        errors.append("snapshots/index.json: dates must be reverse chronological")
    if len(dates) != len(set(dates)):
        errors.append("snapshots/index.json: duplicate dates")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    args = parser.parse_args()
    errors = validate_data(args.data_dir)
    if errors:
        print("Public data rejected:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Public records and provenance links are valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
