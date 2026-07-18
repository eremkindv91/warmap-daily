import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipeline.validate_snapshot import validate


def polygon(x0=30.0, y0=48.0, size=0.05):
    return {"type": "Polygon", "coordinates": [[[x0,y0],[x0+size,y0],[x0+size,y0+size],[x0,y0+size],[x0,y0]]]}


def valid_feature(feature_id="x", x0=30.0):
    old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    return {
        "type": "Feature",
        "properties": {
            "id": feature_id, "name": "Проверяемый полигон", "status": "control_ru",
            "valid_from": old, "confidence": .95, "evidence_ids": ["ev-1"],
            "source_ids": ["source-1"],
            "moderation": {"decision": "approved", "reviewer": "analyst", "reviewed_at": old, "rationale": "Проверено"},
        },
        "geometry": polygon(x0=x0),
    }


class SnapshotValidationTests(unittest.TestCase):
    def write(self, features):
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".geojson", delete=False, encoding="utf-8")
        json.dump({"type": "FeatureCollection", "metadata": {"snapshot_date": "2026-01-01"}, "features": features}, tmp)
        tmp.close()
        return Path(tmp.name)

    def test_empty_snapshot_is_valid(self):
        self.assertEqual(validate(self.write([])), [])

    def test_valid_feature_is_accepted(self):
        self.assertEqual(validate(self.write([valid_feature()])), [])

    def test_unmoderated_feature_is_rejected(self):
        feature = valid_feature()
        feature["properties"]["moderation"]["decision"] = "pending"
        errors = validate(self.write([feature]))
        self.assertTrue(any("moderation" in error for error in errors))

    def test_low_confidence_is_rejected(self):
        feature = valid_feature()
        feature["properties"]["confidence"] = .80
        errors = validate(self.write([feature]))
        self.assertTrue(any("threshold" in error for error in errors))

    def test_recent_geometry_is_rejected(self):
        feature = valid_feature()
        feature["properties"]["valid_from"] = datetime.now(timezone.utc).isoformat()
        errors = validate(self.write([feature]))
        self.assertTrue(any("public delay" in error for error in errors))

    def test_overlapping_features_are_rejected(self):
        errors = validate(self.write([valid_feature("a"), valid_feature("b", 30.02)]))
        self.assertTrue(any("overlaps" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
