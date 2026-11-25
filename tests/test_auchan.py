"""Перевіряє імпорт товарів Ашан (без звернень до мережі)."""
import sys
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import server  # noqa: E402


def item(i, **kw):
    d = {"ean": "482000%04d" % i, "title": "Товар  %d" % i, "price": 4990, "unit": "pcs", "weight": 300,
         "in_stock": True, "web_url": "https://auchan.zakaz.ua/uk/products/x--482000%04d/" % i,
         "img": {"s350x350": "https://img3.zakaz.ua/x-s350x350.jpg"}}
    d.update(kw)
    return d


class AuchanTest(unittest.TestCase):
    def fetch(self, top, per_category=100, categories="a,b", page_size=30, **item_kw):
        calls = []

        def fake(path):
            u = urlparse(path)
            q = parse_qs(u.query)
            slug = u.path.split("/categories/")[1].split("/")[0]
            page, size = int(q["page"][0]), int(q["per_page"][0])
            calls.append((slug, page))
            start = (page - 1) * size
            items = [item(i + (1000 if slug == "b" else 0), **item_kw) for i in range(start, min(start + size, per_category))]
            return {"count": per_category, "results": items}

        with mock.patch.multiple(server, auchan_get=fake, AUCHAN_TOP=top, AUCHAN_CATEGORIES=categories,
                                 AUCHAN_PAGE_SIZE=page_size, log=lambda *a: None), \
                mock.patch.object(server.time, "sleep"):
            return server.fetch_auchan(), calls

    def test_takes_top_items_from_each_category(self):
        rows, calls = self.fetch(40)
        self.assertEqual(len(rows), 80)
        self.assertEqual(calls, [("a", 1), ("a", 2), ("b", 1), ("b", 2)])

    def test_price_in_kopecks_and_fields(self):
        rows, _ = self.fetch(1, categories="dairy-and-eggs-auchan")
        r = rows[0]
        self.assertEqual(r["price"], 49.9)
        self.assertEqual(r["key"], "auchan:4820000000")
        self.assertEqual(r["store"], "Ашан")
        self.assertEqual(r["category"], "Молочні продукти та яйця")
        self.assertEqual(r["brand"], "300 г · Молочні продукти та яйця")
        self.assertEqual(r["name"], "Товар 0")
        self.assertTrue(r["image"].startswith("https://"))

    def test_discount_becomes_old_price_and_label(self):
        rows, _ = self.fetch(1, categories="a", discount={"status": True, "old_price": 6990})
        out = server.normalize(rows)[0]
        self.assertEqual(out["price"], 49.9)
        self.assertEqual(out["old"], 69.9)
        self.assertEqual(out["deal"], "−29%")

    def test_out_of_stock_is_replaced_by_next(self):
        calls = []

        def fake(path):
            calls.append(path)
            return {"count": 3, "results": [item(0, in_stock=False), item(1), item(2)]}

        with mock.patch.multiple(server, auchan_get=fake, AUCHAN_TOP=2, AUCHAN_CATEGORIES="a",
                                 log=lambda *a: None), mock.patch.object(server.time, "sleep"):
            rows = server.fetch_auchan()
        self.assertEqual([r["key"][-4:] for r in rows], ["0001", "0002"])

    def test_units(self):
        self.assertEqual(server.auchan_unit({"unit": "kg"}), "кг")
        self.assertEqual(server.auchan_unit({"unit": "pcs", "weight": 1500}), "1,5 кг")
        self.assertEqual(server.auchan_unit({"unit": "pcs"}), "шт")

    def test_empty_response_is_error(self):
        with mock.patch.multiple(server, auchan_get=lambda p: {"count": 0, "results": []},
                                 AUCHAN_CATEGORIES="a", log=lambda *a: None):
            with self.assertRaises(ValueError):
                server.fetch_auchan()

    def test_failed_auchan_keeps_previous_products(self):
        prev = server.normalize([{"key": "auchan:1", "name": "Старий", "price": 10, "store": "Ашан"}])
        with mock.patch.multiple(server, load_previous=lambda: prev, fetch_auchan=mock.Mock(side_effect=OSError("x")),
                                 fetch_rows=lambda: ([{"name": "Хліб", "price": 20, "key": "k", "store": "АТБ"}], "t"),
                                 read_silpo_pages=lambda: [], SILPO_ENABLED=False, AUCHAN_ENABLED=True,
                                 backup_data=lambda: None, log=lambda *a: None):
            with mock.patch.object(server, "DATA_DIR", Path("/tmp")), \
                    mock.patch.object(server, "DATA_FILE", Path("/tmp/pricetech_test_products.json")):
                server.update()
                import json
                saved = json.loads(Path("/tmp/pricetech_test_products.json").read_text(encoding="utf-8"))
        stores = sorted(p["store"] for p in saved["products"])
        self.assertEqual(stores, ["АТБ", "Ашан"])


if __name__ == "__main__":
    unittest.main()
