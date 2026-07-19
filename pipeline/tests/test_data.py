import json
import unittest
from pathlib import Path

from shapely.geometry import shape

from pipeline.validate_data import validate_data


class PublicDataTests(unittest.TestCase):
    def test_repository_public_data_is_consistent(self):
        self.assertEqual(validate_data(Path("data")), [])

    def test_reference_control_layer_is_dated_valid_and_attributed(self):
        collection = json.loads(Path("data/reference-control.geojson").read_text(encoding="utf-8"))
        self.assertEqual(collection["metadata"]["reference_date"], "2026-04-24")
        self.assertEqual(collection["metadata"]["license"], "CC BY-SA 4.0")
        self.assertEqual(len(collection["features"]), 1)
        feature = collection["features"][0]
        geometry = shape(feature["geometry"])
        self.assertTrue(geometry.is_valid)
        self.assertFalse(geometry.is_empty)
        self.assertEqual(feature["properties"]["source_ids"], ["wikimedia-control-map"])
        west, south, east, north = geometry.bounds
        self.assertGreaterEqual(west, 21.5)
        self.assertGreaterEqual(south, 44.1)
        self.assertLessEqual(east, 40.7)
        self.assertLessEqual(north, 52.7)


if __name__ == "__main__":
    unittest.main()
