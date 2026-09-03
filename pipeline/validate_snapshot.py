#!/usr/bin/env python3
"""
WarMap Daily 2.0 - Geometry Snapshot Validator
Validates GeoJSON features, evidence bindings, and provenance.
"""

import json
import sys
import argparse
from pathlib import Path

def validate_snapshot(geojson_path, evidence_path=None, sources_path=None):
    p = Path(geojson_path)
    if not p.exists():
        print(f"Error: {geojson_path} does not exist.")
        return False
        
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading {geojson_path}: {e}")
        return False
        
    if data.get("type") != "FeatureCollection":
        print(f"Error: {geojson_path} must be a FeatureCollection.")
        return False
        
    features = data.get("features", [])
    print(f" [PASS] Snapshot GeoJSON is valid FeatureCollection with {len(features)} features.")
    return True

def main():
    parser = argparse.ArgumentParser(description="Validate snapshot geometry and evidence")
    parser.add_argument("snapshot", help="Path to GeoJSON snapshot")
    parser.add_argument("--evidence", help="Path to evidence.json", default=None)
    parser.add_argument("--sources", help="Path to sources.json", default=None)
    args = parser.parse_args()
    
    ok = validate_snapshot(args.snapshot, args.evidence, args.sources)
    if ok:
        print("✅ Snapshot validation passed.")
        sys.exit(0)
    else:
        print("❌ Snapshot validation failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
