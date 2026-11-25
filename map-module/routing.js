// Маршрут і час у дорозі через безкоштовний сервер OSRM від FOSSGIS (без API-ключа).
// Умови: не більше 1 запиту на секунду, доступність не гарантується.
// https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen
// Щоб змінити сервіс, достатньо переписати цей файл.

const BASE = "https://routing.openstreetmap.de";
const PROFILES = { foot: "routed-foot", car: "routed-car" };
const MIN_INTERVAL_MS = 1100;

let nextSlot = 0;
const cache = new Map();

export function routeUrl(from, to, mode) {
    const profile = PROFILES[mode];
    if (!profile) throw new Error(`Невідомий спосіб пересування: ${mode}`);
    // OSRM очікує порядок «довгота,широта». Сегмент "driving" однаковий для всіх профілів цього сервера.
    return `${BASE}/${profile}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
        "?overview=full&geometries=geojson";
}

export async function getRoute(from, to, mode = "foot", { fetchFn = fetch, timeoutMs = 10000 } = {}) {
    const url = routeUrl(from, to, mode);
    if (cache.has(url)) return cache.get(url);

    const wait = Math.max(0, nextSlot - Date.now());
    nextSlot = Date.now() + wait + MIN_INTERVAL_MS;
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));

    const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`Сервіс маршрутів: HTTP ${response.status}`);
    const data = await response.json();
    const route = data.code === "Ok" && data.routes?.[0];
    if (!route) throw new Error("Маршрут не знайдено");

    const result = {
        distanceKm: route.distance / 1000,
        durationSec: route.duration,
        points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    };
    cache.set(url, result);
    return result;
}

// Запасний варіант: відкрити маршрут у Google Maps (звичайне посилання, ключ не потрібен).
export function externalRouteUrl(to, mode = "foot") {
    const travel = mode === "car" ? "driving" : "walking";
    return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=${travel}`;
}
