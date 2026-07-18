import unittest

from pipeline.build_diff import build_changes, settlement_changes


def collection(status=None, x0=30.0, snapshot_date="2026-01-01"):
    features = []
    if status:
        features.append({
            "type": "Feature",
            "properties": {"id":"area","status":status,"confidence":.96,"evidence_ids":["ev-1"],"source_ids":["source-1"]},
            "geometry": {"type":"Polygon","coordinates":[[[x0,48],[x0+.05,48],[x0+.05,48.05],[x0,48.05],[x0,48]]]},
        })
    return {"type":"FeatureCollection","metadata":{"snapshot_date":snapshot_date},"features":features}


class DiffTests(unittest.TestCase):
    def test_new_area_creates_change(self):
        changes = build_changes(collection(), collection("control_ru", snapshot_date="2026-01-02"))
        self.assertEqual(len(changes["features"]), 1)
        self.assertGreater(changes["metadata"]["area_change_km2"], 0)
        self.assertEqual(changes["features"][0]["properties"]["to_status"], "control_ru")

    def test_unchanged_area_has_no_diff(self):
        changes = build_changes(collection("control_ru"), collection("control_ru", snapshot_date="2026-01-02"))
        self.assertEqual(changes["features"], [])

    def test_settlement_status_change(self):
        registry = [{"id":"town","name":"Тест","lat":48.02,"lon":30.02}]
        changes = settlement_changes(collection(), collection("control_ru"), registry, "2026-01-02")
        self.assertEqual(changes[0]["status"], "control_ru")


if __name__ == "__main__":
    unittest.main()
