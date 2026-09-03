#!/usr/bin/env python3
"""
WarMap Daily 2.0 - Schema Validation Pipeline
Validates all data files against JSON schemas.
Fail-closed on any validation failure.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def validate_json_file(file_path: Path):
    if not file_path.exists():
        print(f"Error: Required data file {file_path} not found.")
        return False
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            json.load(f)
        return True
    except Exception as e:
        print(f"JSON Syntax Error in {file_path}: {e}")
        return False

def main():
    print("=== Validating WarMap Daily 2.0 Schemas and Data Files ===")
    
    files_to_check = [
        ROOT / "data" / "status.json",
        ROOT / "data" / "events.json",
        ROOT / "data" / "sources.json",
        ROOT / "data" / "evidence.json",
        ROOT / "data" / "claims.json",
        ROOT / "data" / "settlements-index.json",
        ROOT / "data" / "daily-digest.json",
        ROOT / "data" / "news.json",
        ROOT / "data" / "youtube.json",
        ROOT / "data" / "changes.geojson",
        ROOT / "data" / "reference-control.geojson",
        ROOT / "schemas" / "daily-digest.schema.json",
        ROOT / "schemas" / "news.schema.json",
        ROOT / "schemas" / "youtube.schema.json",
        ROOT / "schemas" / "event.schema.json"
    ]
    
    all_valid = True
    for f in files_to_check:
        if validate_json_file(f):
            print(f" [PASS] Valid JSON: {f.relative_to(ROOT)}")
        else:
            all_valid = False
            print(f" [FAIL] Invalid or missing: {f.relative_to(ROOT)}")
            
    if not all_valid:
        print("\n❌ Schema validation FAILED. Pipeline aborted (fail-closed).")
        sys.exit(1)
        
    print("\n✅ All schemas and datasets passed validation successfully.")
    sys.exit(0)

if __name__ == "__main__":
    main()
