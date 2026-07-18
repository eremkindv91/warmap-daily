import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pipeline.validate_snapshot import validate


class SnapshotValidationTests(unittest.TestCase):
    def write(self, features):
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".geojson", delete=False, encoding="utf-8")
        json.dump({"type": "FeatureCollection", "features": features}, tmp)
        tmp.close()
        return Path(tmp.name)

    def test_empty_snapshot_is_valid(self):
        self.assertEqual(validate(self.write([])), [])

    def test_unmoderated_feature_is_rejected(self):
        old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        feature = {"type":"Feature","properties":{"id":"x","status":"control_ru","valid_from":old,"confidence":.95,"evidence_ids":["ev-1"],"moderation":{"decision":"pending"}},"geometry":{"type":"Polygon","coordinates":[]}}
        errors = validate(self.write([feature]))
        self.assertTrue(any("moderation" in error for error in errors))

    def test_low_confidence_is_rejected(self):
        old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        feature = {"type":"Feature","properties":{"id":"x","status":"control_ru","valid_from":old,"confidence":.80,"evidence_ids":["ev-1"],"moderation":{"decision":"approved","reviewer":"analyst"}},"geometry":{"type":"Polygon","coordinates":[]}}
        errors = validate(self.write([feature]))
        self.assertTrue(any("threshold" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
