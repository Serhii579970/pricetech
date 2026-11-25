# Модуль карти магазинів

Пошук найближчого магазину, фільтри (місто, назва/адреса, мережа), маршрут і час пішки або авто.

| Файл | Відповідає за |
|---|---|
| `locator.js` | зв'язок із елементами `map.html`; вхід: `initStoreLocator()` |
| `geo.js` | відстані, фільтрація, форматування (без DOM) |
| `routing.js` | маршрути OSRM (FOSSGIS) |
| `map-view.js` | малювання карти (Leaflet + OpenStreetMap) |
| `data/stores.json` | магазини АТБ і Сільпо з гілки `feature/google-maps` |

Формат магазину: `{ "id": 13, "name": "АТБ-Маркет", "city": "Миколаїв", "address": "…", "lat": 46.95, "lng": 31.94 }`.

## Запуск
`python3 server.py`, далі http://localhost:8000/map.html. Відкриття файлу подвійним кліком не працює (ES-модулі).
Геолокація працює лише на `https://` або `localhost`.

## Інша реалізація карти
Передайте `mapFactory` в `initStoreLocator()`. Потрібні методи перелічені на початку `map-view.js`.

## Обмеження безкоштовних сервісів
- Маршрути: не більше 1 запиту на секунду, без гарантії доступності
  ([умови FOSSGIS](https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen)).
- Тайли: [правила OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/); підпис авторства прибирати не можна.
- «Найближчий» визначається по прямій; реальний шлях показує маршрут.
- Графіків роботи в даних немає.

## Тести
- Сервер і сторінка (Python): `python3 -m unittest discover -s tests -v`
- Логіка модуля (потрібен Node.js 18+): `node --test tests/map-module.test.mjs`
