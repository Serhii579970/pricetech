// Чисті функції: відстані, фільтрація, сортування, форматування. Без DOM і без карти.

export const CHAINS = {
    atb: { label: "АТБ", logo: "АТБ", color: "#1765d1" },
    silpo: { label: "Сільпо", logo: "С", color: "#ef4d48" },
    other: { label: "Інші", logo: "•", color: "#f18a20" }
};

const lower = value => String(value ?? "").trim().toLocaleLowerCase("uk-UA");

export function chainOf(name) {
    const value = lower(name);
    if (value.includes("атб")) return "atb";
    if (value.includes("сільпо") || value.includes("silpo")) return "silpo";
    return "other";
}

// Відкидає записи без коректних координат і додає поле chain.
export function prepareStores(raw) {
    return raw
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map(s => ({ ...s, chain: chainOf(s.name) }));
}

// Відстань по прямій (формула гаверсинуса), км.
export function distanceKm(a, b) {
    const rad = deg => deg * Math.PI / 180;
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withDistances(stores, origin) {
    return stores.map(s => ({ ...s, distance: origin ? distanceKm(origin, s) : null }));
}

// city — початок назви міста; query — слова з назви, міста або адреси; chain — "all" або ключ CHAINS.
export function filterStores(stores, { city = "", query = "", chain = "all" } = {}) {
    const cityValue = lower(city);
    const words = lower(query).split(/\s+/).filter(Boolean);
    // Якщо місто введено повністю, не підмішуємо міста зі схожим початком.
    const exact = stores.some(s => lower(s.city) === cityValue);

    return stores.filter(s => {
        if (chain !== "all" && s.chain !== chain) return false;
        if (cityValue) {
            const name = lower(s.city);
            if (exact ? name !== cityValue : !name.startsWith(cityValue)) return false;
        }
        const text = lower(`${s.name} ${s.city} ${s.address}`);
        return words.every(word => text.includes(word));
    });
}

// Без відомих відстаней порядок не змінюється.
export function sortByDistance(stores, ascending = true) {
    const sign = ascending ? 1 : -1;
    return [...stores].sort((a, b) =>
        a.distance === null || b.distance === null ? 0 : sign * (a.distance - b.distance));
}

export function nearestStore(stores) {
    return stores.reduce((best, s) =>
        s.distance !== null && (!best || s.distance < best.distance) ? s : best, null);
}

export function formatDistance(km) {
    if (km < 0.9995) return `${Math.round(km * 1000)} м`;
    return `${km.toFixed(km < 100 ? 1 : 0).replace(".", ",")} км`;
}

export function formatDuration(seconds) {
    const total = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (!hours) return `${minutes} хв`;
    return minutes ? `${hours} год ${minutes} хв` : `${hours} год`;
}

export function pluralStores(count) {
    const d = count % 10, h = count % 100;
    if (d === 1 && h !== 11) return "магазин";
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "магазини";
    return "магазинів";
}
