"""Перевіряє відбір найпопулярніших товарів Сільпо (без звернень до мережі)."""
import sys
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import server  # noqa: E402


class SilpoTopTest(unittest.TestCase):
    def fetch(self, top, per_category=250, categories="a,b", out_of_stock=()):
        calls = []

        def fake(path):
            q = parse_qs(path.split("?")[1])
            slug, offset, limit = q["category"][0], int(q["offset"][0]), int(q["limit"][0])
            calls.append((slug, offset, limit))
            items = [{"id": "%s-%d" % (slug, i), "title": "Товар %d" % i, "price": 10,
                      "stock": 0 if i in out_of_stock else 5}
                     for i in range(offset, min(offset + limit, per_category))]
            return {"items": items, "total": per_category}

        with mock.patch.multiple(server, silpo_get=fake, silpo_section_titles=lambda: {},
                                 SILPO_TOP=top, SILPO_CATEGORIES=categories, log=lambda *a: None), \
                mock.patch.object(server.time, "sleep"):
            return server.fetch_silpo(), calls

    def test_takes_top_items_from_each_category(self):
        rows, calls = self.fetch(30)
        self.assertEqual(len(rows), 60)
        self.assertEqual(calls, [("a", 0, 30), ("b", 0, 30)])
        self.assertEqual(rows[0]["key"], "silpo:a-0")

    def test_out_of_stock_is_replaced_by_next_popular(self):
        rows, _ = self.fetch(3, categories="a", out_of_stock=(1,))
        self.assertEqual([r["key"] for r in rows], ["silpo:a-0", "silpo:a-2", "silpo:a-3"])

    def test_big_category_is_allowed_with_limit(self):
        rows, _ = self.fetch(5, per_category=4000, categories="a")
        self.assertEqual(len(rows), 5)

    def test_zero_means_all(self):
        rows, _ = self.fetch(0, categories="a")
        self.assertEqual(len(rows), 250)


if __name__ == "__main__":
    unittest.main()
