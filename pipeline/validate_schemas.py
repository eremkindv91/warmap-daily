#!/usr/bin/env python3
"""Validate public JSON files against the published JSON Schemas."""
from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


def main() -> int:
    pairs = [
        (Path("schemas/snapshot.schema.json"), Path("data/current.geojson")),
        (Path("schemas/event.schema.json"), Path("data/events.json")),
        (Path("schemas/evidence.schema.json"), Path("data/evidence.json")),
    ]
    errors: list[str] = []
    for schema_path, data_path in pairs:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        data = json.loads(data_path.read_text(encoding="utf-8"))
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for error in sorted(validator.iter_errors(data), key=lambda item: list(item.path)):
            location = ".".join(map(str, error.path)) or "root"
            errors.append(f"{data_path}:{location}: {error.message}")
    if errors:
        print("Schema validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Published JSON Schemas accepted all public data")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
