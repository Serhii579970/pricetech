"""Перевіряє, що сервер віддає файли карти й не віддає зайвого.
Запуск із кореня проєкту: python3 -m unittest discover -s tests -v"""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402


class StaticFilesTest(unittest.TestCase):
    def test_map_files_are_served(self):
        for name in ("map.html", "map.css", "map.js"):
            self.assertEqual(server.static_file("/" + name), name)

    def test_whole_module_is_served(self):
        files = [p for p in (ROOT / "map-module").rglob("*")
                 if p.suffix in (".js", ".css", ".json") and p.name != "package.json"]
        self.assertTrue(files)
        for p in files:
            name = p.relative_to(ROOT).as_posix()
            with self.subTest(name):
                self.assertEqual(server.static_file("/" + name), name)
                self.assertIn(p.suffix, server.TYPES)

    def test_page_local_files_exist(self):
        html = (ROOT / "map.html").read_text(encoding="utf-8")
        for name in ("map.css", "map.js", "map-module/map-module.css"):
            self.assertIn(name, re.findall(r'(?:href|src)="([^"]+)"', html))

    def test_page_has_elements_used_by_module(self):
        html = (ROOT / "map.html").read_text(encoding="utf-8")
        code = (ROOT / "map-module" / "locator.js").read_text(encoding="utf-8")
        ids = set(re.findall(r'\$\("#([\w-]+)"\)', code))
        self.assertTrue(ids)
        for element_id in ids:
            with self.subTest(element_id):
                self.assertIn('id="%s"' % element_id, html)

    def test_private_files_are_not_served(self):
        for path in ("/server.py", "/.gitignore", "/tests/test_server.py",
                     "/map-module/../server.py", "/assets/../server.py"):
            with self.subTest(path):
                self.assertIsNone(server.static_file(path))


if __name__ == "__main__":
    unittest.main()
