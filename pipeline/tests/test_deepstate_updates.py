import unittest
from datetime import datetime, timezone

from pipeline.fetch_deepstate_updates import parse_updates


class DeepStateUpdateTests(unittest.TestCase):
    def test_parses_delayed_coordinate_link_and_skips_fresh_post(self):
        document = """
        <div class="tgme_widget_message_wrap js-widget_message_wrap" data-post="DeepStateUA/100">
          <div class="tgme_widget_message_text">🔄 Мапу оновлено ⚔️ Ворог просунувся поблизу
          <a href="https://deepstatemap.live/#14/48.4627320/37.7395391">Іванопілля</a>.
          💬 У випадку неточностей</div>
          <time datetime="2026-07-17T05:04:15+00:00"></time>
        </div>
        <div class="tgme_widget_message_wrap js-widget_message_wrap" data-post="DeepStateUA/101">
          <div class="tgme_widget_message_text">🔄 Мапу оновлено
          <a href="https://deepstatemap.live/#14/48.5000/37.8000">Нова точка</a></div>
          <time datetime="2026-07-18T12:00:00+00:00"></time>
        </div>
        """
        now = datetime(2026, 7, 18, 13, 30, tzinfo=timezone.utc)
        updates = parse_updates(document, now=now, delay_hours=24)
        self.assertEqual(len(updates), 1)
        self.assertEqual(updates[0]["post_id"], "100")
        self.assertEqual(updates[0]["lat"], 48.462732)
        self.assertEqual(updates[0]["lon"], 37.7395391)
        self.assertNotIn("неточностей", updates[0]["summary"])


if __name__ == "__main__":
    unittest.main()
