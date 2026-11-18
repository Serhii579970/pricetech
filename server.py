#!/usr/bin/env python3
"""PriceTech: щодобове оновлення цін і віддача їх сайту у JSON.

Запуск:   python3 server.py        ->  http://localhost:8000
Сільпо: товари тягнуться автоматично з офіційного JSON API silpo.ua
  (sf-ecom-api.silpo.ua) при кожному оновленні й додаються до решти даних.
Інші джерела (за пріоритетом):
  1) ATB_FEED_URL  - офіційний/партнерський фід (JSON або CSV)
  2) папка pages/  - збережені вами сторінки категорій atbmarket.com
  3) atb_export.csv - ваш файл експорту поруч зі скриптом
Лише стандартна бібліотека Python 3.8+.
"""
import csv, hashlib, html as htmllib, io, json, os, re, shutil, threading, time, urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Дані живуть у data/ (або DATA_DIR) — ця папка НЕ входить в оновлення сайту: розпаковуючи нову версію
# поверх старої, data/ не чіпайте, і всі товари/ціни збережуться.
DATA_DIR = Path(os.environ.get("DATA_DIR", "") or (ROOT / "data")).resolve()
DATA_FILE = DATA_DIR / "products.json"
LEGACY_FILE = ROOT / "products.json"  # місце збереження в старих версіях — переноситься в data/ автоматично
BACKUP_DIR = DATA_DIR / "backup"
BACKUP_KEEP = int(os.environ.get("BACKUP_KEEP", "14"))  # скільки добових копій тримати
SILPO_PAGES_DIR = ROOT / "pages_silpo"  # збережені сторінки silpo.ua/category/... (.html/.htm/.txt)
CSV_FILE = ROOT / "atb_export.csv"
ATB_SITE = "https://www.atbmarket.com"
PAGES_DIR = ROOT / "pages"  # збережені сторінки категорій atbmarket.com (.html/.htm/.txt)
FEED_URL = os.environ.get("ATB_FEED_URL", "").strip()
PORT = int(os.environ.get("PORT", "8000"))
UPDATE_HOURS = float(os.environ.get("UPDATE_HOURS", "24"))
DEFAULT_STORE = "АТБ"
EMOJI = {"Молочні": "🥛", "Напої": "🥤", "Бакалія": "🛒", "М'ясні": "🍖", "Інше": "🛍️"}
# Можливі назви полів у зовнішньому фіді -> наші поля (підкоригуйте під реальний фід)
ALIASES = {
    "name": ["name", "title", "назва"],
    "brand": ["brand", "unit", "опис", "вага"],
    "category": ["category", "категорія"],
    "price": ["price", "ціна", "sale_price"],
    "old": ["old", "old_price", "стара_ціна", "regular_price"],
    "deal": ["deal", "discount", "знижка"],
    "emoji": ["emoji"],
    "store": ["store", "магазин"],
    "key": ["key", "url", "sku"],
    "image": ["image", "img", "фото"],
    "link": ["link", "product_url", "посилання"],
}
lock = threading.Lock()

# --- Сільпо: автоматичне оновлення з API silpo.ua -----------------------------
SILPO_ENABLED = os.environ.get("SILPO_ENABLED", "1").strip().lower() not in ("0", "false", "no", "")
SILPO_API = os.environ.get("SILPO_API", "https://sf-ecom-api.silpo.ua").rstrip("/")
SILPO_BRANCH = os.environ.get("SILPO_BRANCH", "00000000-0000-0000-0000-000000000000")  # 0000… = «усі філії»
SILPO_STORE = "Сільпо"
# Категорії для імпорту: slug з адреси silpo.ua/category/<slug>, через кому; "slug=Мітка" задає
# підпис на картці для товарів без знижки. Приклад: SILPO_CATEGORIES="15-povertayemo-balobonusamy=15% балобонусами,pyvo-100"
SILPO_CATEGORIES = os.environ.get("SILPO_CATEGORIES", "15-povertayemo-balobonusamy=15% балобонусами")
SILPO_PAGE_SIZE = int(os.environ.get("SILPO_PAGE_SIZE", "100"))
SILPO_MAX_ITEMS = int(os.environ.get("SILPO_MAX_ITEMS", "3000"))  # запобіжник на категорію
# Параметри запиту товарів (як у запиті, який робить сам сайт у DevTools → Network → /products)
SILPO_QUERY = os.environ.get(
    "SILPO_QUERY",
    "limit={limit}&offset={offset}&deliveryType=DeliveryHome&category={slug}"
    "&includeChildCategories=true&inStock=true&sortBy=popularity&sortDirection=desc")
SILPO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "uk-UA,uk;q=0.9",
    "Origin": "https://silpo.ua",
    "Referer": "https://silpo.ua/",
}
SILPO_IMG = "https://images.silpo.ua/v2/products/300x300/webp/"
SILPO_SITE = "https://silpo.ua/product/"


def log(*a):
    print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def num(v):
    if v is None or str(v).strip() == "":
        return None
    try:
        return float(str(v).replace("\u00a0", "").replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def pick(row, field):
    low = {str(k).strip().lower(): v for k, v in row.items()}
    for key in ALIASES[field]:
        if key in low and low[key] not in (None, ""):
            return low[key]
    return None


def stable_id(name, brand, store, seen):
    h = hashlib.md5(('%s|%s|%s' % (name, brand, store)).lower().encode('utf-8')).hexdigest()
    n = int(h[:8], 16)
    while n in seen:
        n += 1
    seen.add(n)
    return n


def safe_url(v):
    """Пропускаємо лише абсолютні https-посилання (значення йде в HTML сайту)."""
    v = str(v or "").strip()
    return esc(v) if v.startswith("https://") else None


def normalize(rows):
    out, seen = [], set()
    for row in rows:
        name, price = pick(row, "name"), num(pick(row, "price"))
        if not name or price is None:
            continue  # пропускаємо неповні рядки
        old = num(pick(row, "old"))
        if old is not None and old <= price:
            old = None
        category = str(pick(row, "category") or "Інше").strip()
        deal = pick(row, "deal")
        if not deal and old:
            deal = "−%d%%" % round((1 - price / old) * 100)
        name = esc(str(name).strip())
        brand = esc(pick(row, "brand") or category)
        store = esc(pick(row, "store") or DEFAULT_STORE)
        out.append({
            "id": stable_id(str(pick(row, "key") or name), "" if pick(row, "key") else brand, store, seen),
            "name": name,
            "brand": brand,
            "category": esc(category),
            "emoji": pick(row, "emoji") or EMOJI.get(category, "🛍️"),
            "price": round(price, 2),
            "old": round(old, 2) if old else None,
            "store": store,
            "deal": esc(deal or "Вигідно"),
            "image": safe_url(pick(row, "image")),
            "link": safe_url(pick(row, "link")),
        })
    return out


def parse_text(text):
    text = text.lstrip("\ufeff")
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            data = data.get("products") or data.get("items") or []
        return data
    except json.JSONDecodeError:
        return list(csv.DictReader(io.StringIO(text)))


CAT_EMOJI = [("морозив", "🍦"), ("пельмен", "🥟"), ("вареник", "🥟"), ("овочі", "🥦"), ("фрукт", "🍎"),
             ("ковбас", "🌭"), ("сосиск", "🌭"), ("делікатес", "🥓"), ("пиво", "🍺"), ("алкогол", "🍷"),
             ("вино", "🍷"), ("цукерк", "🍬"), ("шоколад", "🍫"), ("печиво", "🍪"), ("вафл", "🧇"),
             ("круасан", "🥐"), ("горіх", "🥜"), ("сухофрукт", "🥜"), ("соління", "🥒"), ("батончик", "🍫"),
             ("молоч", "🥛"), ("сир", "🧀"), ("кава", "☕"), ("чай", "🍵"), ("м'яс", "🍖")]


def emoji_for(category):
    low = category.lower()
    for key, em in CAT_EMOJI:
        if key in low:
            return em
    return "🛒"


def parse_atb_html(text):
    """Читає картки товарів <article class="catalog-item"> зі збереженої сторінки АТБ."""
    page_cat = ""
    m = re.search(r"<title>[^<]*?Купити\s+(.+?)\s+(?:в\s+\S+\s+)?за\s+найнижчими", text, re.S)
    if m:
        page_cat = htmllib.unescape(m.group(1)).strip().capitalize()
    rows = []
    for art in re.findall(r"<article\b[^>]*catalog-item.*?</article>", text, re.S):
        t = re.search(r'catalog-item__title[^"]*">\s*<a href="([^"]+)">([^<]+)', art)
        p = re.search(r'<data value="([\d.]+)"[^>]*product-price__top', art)
        if not t or not p:
            continue  # немає назви або ціни (наприклад, товару немає в наявності)
        old = re.search(r'<data value="([\d.]+)"[^>]*product-price__bottom', art)
        unit = re.search(r'product-price__unit">\s*/?([^<\s]+)', art)
        label = re.search(r'custom-product-label"[^>]*>\s*(-?\d+\s*%)', art)
        img = re.search(r'<img[^>]*catalog-item__img[^>]*?\ssrc="([^"]+)"', art) \
            or re.search(r'<img[^>]*?\ssrc="([^"]+)"[^>]*catalog-item__img', art) \
            or re.search(r'<source[^>]*srcset="([^"\s]+)', art)
        image = htmllib.unescape(img.group(1)).strip() if img else None
        if image and image.startswith("//"):
            image = "https:" + image
        elif image and image.startswith("/"):
            image = ATB_SITE + image
        href = htmllib.unescape(t.group(1)).strip()
        link = href if href.startswith("http") else ATB_SITE + href
        cat = re.search(r'data-category="([^"]*)"', art)
        cat = htmllib.unescape(cat.group(1)).strip() if cat else ""
        if not cat or cat == "recommendations":
            cat = page_cat or "Інше"
        rows.append({
            "key": t.group(1),
            "name": " ".join(htmllib.unescape(t.group(2)).split()),
            "brand": "%s · %s" % (cat, unit.group(1) if unit else "шт"),
            "category": cat,
            "price": p.group(1),
            "old": old.group(1) if old else None,
            "deal": label.group(1).replace("-", "−").replace(" ", "") if label else None,
            "emoji": emoji_for(cat),
            "image": image,
            "link": link,
        })
    return rows


def read_pages():
    rows, seen = [], set()
    files = sorted(f for f in PAGES_DIR.glob("*") if f.suffix.lower() in (".html", ".htm", ".txt"))
    for f in files:
        got = parse_atb_html(f.read_text(encoding="utf-8", errors="replace"))
        new = [r for r in got if r["key"] not in seen]  # дублікати між файлами відкидаємо
        seen.update(r["key"] for r in new)
        log("  %s: знайдено %d, нових %d" % (f.name, len(got), len(new)))
        rows += new
    return rows


def silpo_get(path_query):
    req = urllib.request.Request(SILPO_API + path_query, headers=SILPO_HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))  # 2 с, 4 с — і лише тоді здаємось


def silpo_section_titles():
    """slug підкатегорії -> (назва, назва відділу верхнього рівня). Помилка не критична."""
    try:
        items, offset, total, size = [], 0, None, 100  # великий limit API відхиляє (400) — беремо сторінками
        while total is None or offset < total:
            data = silpo_get("/v1/uk/branches/%s/categories?limit=%d&offset=%d" % (SILPO_BRANCH, size, offset))
            got = data.get("items") or []
            total = int(data.get("total") or len(got))
            if not got:
                break
            items += got
            offset += len(got)
            if offset > 10000:  # запобіжник
                break
            time.sleep(0.2)
    except Exception as e:
        log("Сільпо: не вдалось отримати назви категорій:", repr(e))
        return {}
    by_id = {c["id"]: c for c in items}
    out = {}
    for c in items:
        top, hops = c, 0
        while top.get("parentId") in by_id and hops < 10:
            top, hops = by_id[top["parentId"]], hops + 1
        out[c["slug"]] = (c.get("title") or "", top.get("title") or "")
    return out


def silpo_row(it, cat, sub, label=None):
    """Один товар Сільпо (JSON з API або зі збереженої сторінки) -> рядок у нашому форматі."""
    pid = it.get("id")
    price = it.get("displayPrice") if it.get("displayPrice") is not None else it.get("price")
    if not pid or price is None or it.get("stock") == 0:
        return None
    old = it.get("displayOldPrice") if it.get("displayOldPrice") is not None else it.get("oldPrice")
    unit = it.get("displayRatio") or it.get("ratio") or "шт"
    slug_p = it.get("slug")
    return {
        "key": "silpo:" + str(pid),
        "name": " ".join(str(it.get("title") or "").split()),
        "brand": "%s · %s" % (unit, sub or cat),
        "category": cat,
        "price": price,
        "old": old,
        "deal": label or None,  # якщо є стара ціна, normalize() підставить «−N%»
        "emoji": emoji_for(cat),
        "store": SILPO_STORE,
        "image": SILPO_IMG + it["icon"] if it.get("icon") else None,
        "link": SILPO_SITE + slug_p if slug_p else None,
    }


def parse_silpo_html(text):
    """Товари зі збереженої сторінки категорії silpo.ua: читаємо JSON-стан Angular (serverApp-state)."""
    m = re.search(r'<script id="serverApp-state" type="application/json">(.*?)</script>', text, re.S)
    if not m:
        return []
    try:
        state = json.loads(m.group(1))
    except json.JSONDecodeError:
        state = json.loads(htmllib.unescape(m.group(1)))
    t = re.search(r"<title>\s*(.+?)\s+-\s+купити", text, re.S)
    cat = htmllib.unescape(t.group(1)).strip() if t else "Сільпо"
    found = {}

    def walk(o):
        if isinstance(o, dict):
            if o.get("id") and o.get("title") and ("displayPrice" in o or "price" in o):
                found.setdefault(o["id"], o)
            else:
                for v in o.values():
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(state)
    rows = [r for r in (silpo_row(it, cat, "") for it in found.values()) if r]
    return rows


def read_silpo_pages():
    rows, seen = [], set()
    if not SILPO_PAGES_DIR.is_dir():
        return rows
    for f in sorted(f for f in SILPO_PAGES_DIR.glob("*") if f.suffix.lower() in (".html", ".htm", ".txt")):
        try:
            got = parse_silpo_html(f.read_text(encoding="utf-8", errors="replace"))
        except Exception as e:
            log("  Сільпо (сторінка) %s: помилка %r" % (f.name, e))
            continue
        new = [r for r in got if r["key"] not in seen]
        seen.update(r["key"] for r in new)
        log("  Сільпо (сторінка) %s: знайдено %d, нових %d" % (f.name, len(got), len(new)))
        rows += new
    return rows


def fetch_silpo():
    """Усі товари заданих категорій Сільпо -> рядки у нашому форматі."""
    titles = silpo_section_titles()
    rows, seen = [], set()
    cats = [c.strip() for c in SILPO_CATEGORIES.split(",") if c.strip()]
    for spec in cats:
        slug, _, label = spec.partition("=")
        slug, label = slug.strip(), label.strip()
        offset, total, got = 0, None, 0
        while total is None or offset < total:
            q = SILPO_QUERY.format(limit=SILPO_PAGE_SIZE, offset=offset, slug=slug)
            data = silpo_get("/v1/uk/branches/%s/products?%s" % (SILPO_BRANCH, q))
            items = data.get("items") or []
            total = int(data.get("total") or 0)
            if total > SILPO_MAX_ITEMS:  # фільтр категорії, схоже, не спрацював
                raise ValueError("Сільпо: %d товарів у відповіді для «%s» — перевірте SILPO_QUERY" % (total, slug))
            if not items:
                break
            for it in items:
                pid = it.get("id")
                if not pid or pid in seen:
                    continue
                sub, top = titles.get(it.get("sectionSlug") or "", ("", ""))
                row = silpo_row(it, top or sub or "Сільпо", sub, label)
                if not row:
                    continue
                seen.add(pid)
                rows.append(row)
                got += 1
            offset += len(items)
            time.sleep(0.4)  # не навантажуємо API
        log("  Сільпо «%s»: %d товарів (заявлено %s)" % (slug, got, total))
    if not rows:
        raise ValueError("Сільпо: API не повернуло жодного товару")
    return rows


def fetch_rows():
    if FEED_URL:
        req = urllib.request.Request(FEED_URL, headers={"User-Agent": "PriceTechBot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return parse_text(r.read().decode("utf-8")), "фід " + FEED_URL
    if PAGES_DIR.is_dir() and any(PAGES_DIR.glob("*")):
        rows = read_pages()
        if rows:
            return rows, "збережені сторінки atbmarket.com (папка pages/)"
    if CSV_FILE.exists():
        return parse_text(CSV_FILE.read_text(encoding="utf-8")), "файл atb_export.csv"
    raise FileNotFoundError("Немає ні ATB_FEED_URL, ні atb_export.csv")


def dedupe(rows):
    """Той самий key — лишається останній (свіжіше джерело перекриває старіше), порядок зберігається."""
    out = {}
    for r in rows:
        out[r.get("key") or id(r)] = r
    return list(out.values())


def load_previous():
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8")).get("products", [])
    except Exception:
        return []


def backup_data():
    """Добова копія products.json у data/backup/ (останні BACKUP_KEEP штук)."""
    try:
        if not DATA_FILE.exists():
            return
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        dst = BACKUP_DIR / ("products-%s.json" % datetime.now().strftime("%Y-%m-%d"))
        if not dst.exists():
            shutil.copy2(DATA_FILE, dst)
        for old in sorted(BACKUP_DIR.glob("products-*.json"))[:-BACKUP_KEEP]:
            old.unlink()
    except Exception as e:
        log("Не вдалось зробити копію даних:", repr(e))


def update():
    try:
        sources, rows = [], []
        previous = load_previous()
        try:
            base, src = fetch_rows()
            rows += base
            sources.append(src)
        except Exception as e:  # збій АТБ-джерела не повинен блокувати Сільпо
            if not SILPO_ENABLED:
                raise
            log("Інші джерела недоступні:", repr(e))
        carry_silpo = False
        if SILPO_ENABLED:
            pages = read_silpo_pages()  # збережені сторінки з архіву — завжди «їдуть» з оновленням
            if pages:
                rows += pages
                sources.append("збережені сторінки silpo.ua (папка pages_silpo/)")
            try:
                rows += fetch_silpo()
                sources.append("Сільпо (API silpo.ua)")
            except Exception as e:
                carry_silpo = True
                log("ПОМИЛКА Сільпо (лишаю попередні товари):", repr(e))
        fresh = normalize(dedupe(rows))
        # Те, що вже було в data/products.json, але джерело зараз не віддало, — переносимо далі.
        have = {p["id"] for p in fresh}
        stores = {p["store"] for p in fresh}
        carried = []
        for p in previous:
            if p["id"] in have:
                continue
            if (p.get("store") == SILPO_STORE and carry_silpo) or p.get("store") not in stores:
                carried.append(p)
        if carried:
            sources.append("попередні дані (%d)" % len(carried))
        products = fresh + carried
        if not products:
            raise ValueError("після обробки не залишилось жодного товару")
        source = " + ".join(sources)
        payload = {"updated": datetime.now(timezone.utc).isoformat(),
                   "source": source, "products": products}
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        backup_data()
        tmp = DATA_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
        with lock:
            tmp.replace(DATA_FILE)  # атомарна заміна: сайт ніколи не бачить напівфайл
        log("Оновлено товарів:", len(products), "(нових/свіжих %d, перенесено %d)" % (len(fresh), len(carried)),
            "| джерело:", source)
    except Exception as e:  # старі дані лишаються на місці
        log("ПОМИЛКА оновлення (старі дані збережено):", repr(e))


def scheduler():
    while True:
        update()
        time.sleep(UPDATE_HOURS * 3600)


STATIC ={"/": "index.html", "/index.html": "index.html",
          "/search.html": "search.html", "/search": "search.html",
          "/search.css": "search.css", "/search.js": "search.js",
          "/style.css": "style.css", "/app.js": "app.js"}
for _p in ("map", "shopping-list", "calories", "notifications", "analytics"):
    STATIC["/%s.html" % _p] = "%s.html" % _p
    STATIC["/%s.css" % _p] = "%s.css" % _p
    STATIC["/%s.js" % _p] = "%s.js" % _p
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".js": "text/javascript; charset=utf-8",
         ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
         ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon"}


def static_file(path):
    """Повертає відносний шлях дозволеного файлу сайту або None. Окрім списку — лише картинки з папки assets/."""
    name = STATIC.get(path)
    if not name and path.startswith("/assets/"):
        name = path.lstrip("/")
        parts = Path(name).parts
        if ".." in parts or Path(name).suffix.lower() not in TYPES or Path(name).suffix.lower() in (".html", ".js", ".css"):
            return None
    if name and (ROOT / name).is_file():
        return name
    return None


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/products":
            with lock:
                body = DATA_FILE.read_bytes() if DATA_FILE.exists() else None
            if body is None:
                return self._send(503, b'{"error":"data not ready"}', "application/json")
            return self._send(200, body, "application/json; charset=utf-8")
        name = static_file(path)  # віддаємо лише дозволені файли
        if name:
            return self._send(200, (ROOT / name).read_bytes(), TYPES[Path(name).suffix.lower()])
        self._send(404, b"Not found", "text/plain; charset=utf-8")

    def log_message(self, *a):
        pass


def migrate_legacy():
    """Старі версії зберігали products.json поруч зі скриптом — переносимо в data/ без втрати даних."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if LEGACY_FILE.exists() and not DATA_FILE.exists():
        shutil.move(str(LEGACY_FILE), str(DATA_FILE))
        log("Перенесено попередні дані:", LEGACY_FILE, "->", DATA_FILE)


if __name__ == "__main__":
    migrate_legacy()
    threading.Thread(target=scheduler, daemon=True).start()
    log("Сервер: http://localhost:%d  (оновлення кожні %g год.)" % (PORT, UPDATE_HOURS))
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
