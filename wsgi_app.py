"""WSGI-вхід для хостингу (PythonAnywhere тощо). Віддає сайт і /api/products з data/products.json.
Оновлення цін тут не робиться — його запускає планувальник: python3 update_once.py"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402  (server.py при імпорті нічого не запускає)

server.migrate_legacy()


def _respond(start_response, code, body, ctype, extra=()):
    start_response(code, [("Content-Type", ctype), ("Content-Length", str(len(body))),
                          ("Access-Control-Allow-Origin", "*")] + list(extra))
    return [body]


def application(environ, start_response):
    path = (environ.get("PATH_INFO") or "/").split("?")[0]
    if path == "/api/products":
        try:
            body = server.DATA_FILE.read_bytes()
        except OSError:
            return _respond(start_response, "503 Service Unavailable", b'{"error":"data not ready"}',
                            "application/json")
        return _respond(start_response, "200 OK", body, "application/json; charset=utf-8",
                        [("Cache-Control", "no-store")])
    name = server.static_file(path)  # лише дозволені файли
    if name:
        return _respond(start_response, "200 OK", (ROOT / name).read_bytes(), server.TYPES[Path(name).suffix.lower()])
    return _respond(start_response, "404 Not Found", b"Not found", "text/plain; charset=utf-8")
