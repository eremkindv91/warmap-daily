import unittest
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

class TestWarMapScoringAndIntegrity(unittest.TestCase):
    def setUp(self):
        with open(ROOT / "data" / "news.json", "r", encoding="utf-8") as f:
            self.news = json.load(f)
        with open(ROOT / "data" / "youtube.json", "r", encoding="utf-8") as f:
            self.youtube = json.load(f)
        with open(ROOT / "data" / "daily-digest.json", "r", encoding="utf-8") as f:
            self.digest = json.load(f)
        with open(ROOT / "data" / "status.json", "r", encoding="utf-8") as f:
            self.status = json.load(f)

    def test_news_scoring_and_confidence(self):
        """Test that every news event has valid verification status and confidence."""
        valid_statuses = {"CONFIRMED", "PROBABLE", "UNCONFIRMED", "CONTRADICTED", "REJECTED"}
        for item in self.news:
            self.assertIn(item["verification_status"], valid_statuses)
            self.assertGreaterEqual(item["confidence"], 0.0)
            self.assertLessEqual(item["confidence"], 1.0)
            self.assertTrue(len(item["what_is_confirmed"]) > 0)
            self.assertTrue(len(item["what_is_not_confirmed"]) > 0)

    def test_source_independence_and_anti_repost(self):
        """Test that media reposts are not counted as independent sources."""
        for item in self.news:
            lineage = item.get("sources_lineage", [])
            self.assertTrue(len(lineage) > 0, f"News {item['id']} must have lineage matrix")
            actual_indep = sum(1 for s in lineage if s.get("independent") is True)
            self.assertEqual(actual_indep, item["independent_sources_count"])
            # Ensure compressed count >= independent sources
            self.assertGreaterEqual(item["raw_publications_compressed"], actual_indep)

    def test_youtube_ranking_formula(self):
        """Test VideoScore = 0.35R + 0.25Q + 0.20F + 0.10I + 0.10D."""
        self.assertLessEqual(len(self.youtube), 5, "Must not exceed 5 curated YouTube reviews")
        for v in self.youtube:
            score = v["score"]
            r = score["relevance"]
            q = score["source_quality"]
            f = score["freshness"]
            i = score["info_density"]
            d = score["diversity"]
            expected = round((0.35 * r + 0.25 * q + 0.20 * f + 0.10 * i + 0.10 * d) * 100, 1)
            self.assertAlmostEqual(score["total"], expected, places=1)
            self.assertTrue(len(v["why_watch"]) > 10, "Must have why_watch note")

    def test_daily_digest_structure(self):
        """Test daily digest contains essential sections and metrics."""
        self.assertIn("what_changed_24h", self.digest)
        self.assertIn("sections", self.digest)
        sec = self.digest["sections"]
        self.assertIn("military_situation", sec)
        self.assertIn("control_changes", sec)
        self.assertIn("strikes_and_attacks", sec)
        self.assertIn("aviation_uav", sec)
        self.assertIn("politics_diplomacy", sec)
        self.assertIn("vs_yesterday", sec)

    def test_date_handling_and_no_live_tracking_illusion(self):
        """Test that timestamps are explicit and status contains 24h delay warning."""
        self.assertIn("public_delay_hours", self.status)
        self.assertGreaterEqual(self.status["public_delay_hours"], 24)
        self.assertTrue(len(self.status["last_reviewed_formatted"]) > 0)

if __name__ == "__main__":
    unittest.main()
