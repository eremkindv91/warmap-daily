import unittest
from pathlib import Path

from pipeline.validate_data import validate_data


class PublicDataTests(unittest.TestCase):
    def test_repository_public_data_is_consistent(self):
        self.assertEqual(validate_data(Path("data")), [])


if __name__ == "__main__":
    unittest.main()
