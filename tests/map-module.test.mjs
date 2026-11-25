import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as geo from "../map-module/geo.js";
import { routeUrl, getRoute } from "../map-module/routing.js";

const stores = geo.prepareStores(JSON.parse(
    readFileSync(new URL("../map-module/data/stores.json", import.meta.url), "utf8")));
const kyiv = { lat: 50.4501, lng: 30.5234 };

test("дані: унікальні id, відомі мережі", () => {
    assert.equal(new Set(stores.map(s => s.id)).size, stores.length);
    assert.ok(stores.every(s => s.chain !== "other"));
});

test("відстань Київ — Львів близько 470 км", () => {
    const d = geo.distanceKm(kyiv, { lat: 49.8397, lng: 24.0297 });
    assert.ok(d > 460 && d < 480, String(d));
});

test("фільтри за містом, мережею та адресою", () => {
    const result = geo.filterStores(stores, { city: "київ", chain: "silpo" });
    assert.ok(result.length > 0);
    assert.ok(result.every(s => s.city === "Київ" && s.chain === "silpo"));
    const first = result[0];
    assert.ok(geo.filterStores(stores, { query: first.address }).some(s => s.id === first.id));
    assert.equal(geo.filterStores(stores, { query: "немає-такого" }).length, 0);
});

test("найближчий і сортування", () => {
    const list = geo.withDistances(stores, kyiv);
    const sorted = geo.sortByDistance(list);
    assert.equal(geo.nearestStore(list).id, sorted[0].id);
    assert.ok(sorted[0].distance <= sorted[1].distance);
    assert.equal(geo.nearestStore(geo.withDistances(stores, null)), null);
});

test("форматування", () => {
    assert.equal(geo.formatDistance(0.25), "250 м");
    assert.equal(geo.formatDistance(1.24), "1,2 км");
    assert.equal(geo.formatDuration(3900), "1 год 5 хв");
    assert.deepEqual([1, 2, 5, 11, 22].map(geo.pluralStores),
        ["магазин", "магазини", "магазинів", "магазинів", "магазини"]);
});

test("маршрут: порядок координат і розбір відповіді", async () => {
    const to = { lat: 50.46, lng: 30.53 };
    assert.match(routeUrl(kyiv, to, "foot"), /routed-foot.*30\.5234,50\.4501;30\.53,50\.46/);
    const fetchFn = async () => ({ ok: true, json: async () => ({ code: "Ok", routes: [
        { distance: 1500, duration: 1100, geometry: { coordinates: [[30.52, 50.45], [30.53, 50.46]] } }] }) });
    const route = await getRoute(kyiv, to, "foot", { fetchFn });
    assert.equal(route.distanceKm, 1.5);
    assert.deepEqual(route.points[0], [50.45, 30.52]);
});

test("маршрут: помилка сервера", async () => {
    await assert.rejects(getRoute(kyiv, { lat: 1, lng: 1 }, "car",
        { fetchFn: async () => ({ ok: false, status: 429 }) }), /429/);
});

test("дані: обов'язкові поля та координати в межах України", () => {
    for (const s of stores) {
        assert.ok(s.name && s.city && s.address, `неповний запис ${s.id}`);
        assert.ok(s.lat > 44 && s.lat < 53 && s.lng > 22 && s.lng < 41, `координати ${s.id}`);
    }
});

test("записи без координат відкидаються", () => {
    const result = geo.prepareStores([
        { id: 1, name: "АТБ", lat: 50, lng: 30 },
        { id: 2, name: "АТБ", lat: null, lng: 30 },
        { id: 3, name: "АТБ" }
    ]);
    assert.deepEqual(result.map(s => s.id), [1]);
});

test("визначення мережі за назвою", () => {
    assert.deepEqual(["АТБ-Маркет", "Сільпо", "Le Silpo", "VARUS"].map(geo.chainOf),
        ["atb", "silpo", "silpo", "other"]);
});

test("місто: за початком назви, а повна назва без схожих", () => {
    const sample = [{ city: "Київ" }, { city: "Київка" }]
        .map(s => ({ ...s, name: "АТБ", address: "", chain: "atb" }));
    assert.equal(geo.filterStores(sample, { city: "Киї" }).length, 2);
    assert.deepEqual(geo.filterStores(sample, { city: " київ " }).map(s => s.city), ["Київ"]);
});

test("сортування не змінює початковий масив і працює у зворотному порядку", () => {
    const list = [{ distance: 2 }, { distance: 1 }, { distance: 3 }];
    assert.deepEqual(geo.sortByDistance(list, false).map(s => s.distance), [3, 2, 1]);
    assert.deepEqual(list.map(s => s.distance), [2, 1, 3]);
});

test("форматування: граничні значення", () => {
    assert.equal(geo.formatDistance(0.9996), "1,0 км");
    assert.equal(geo.formatDistance(465.2), "465 км");
    assert.equal(geo.formatDuration(5), "1 хв");
    assert.equal(geo.formatDuration(7200), "2 год");
});

test("маршрут: невідомий спосіб пересування", () => {
    assert.throws(() => routeUrl(kyiv, kyiv, "plane"), /plane/);
});

test("маршрут: сервер не знайшов шлях", async () => {
    const fetchFn = async () => ({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) });
    await assert.rejects(getRoute(kyiv, { lat: 2, lng: 2 }, "foot", { fetchFn }), /не знайдено/);
});

test("маршрут: повторний запит береться з кешу", async () => {
    let calls = 0;
    const fetchFn = async () => {
        calls++;
        return { ok: true, json: async () => ({ code: "Ok", routes: [
            { distance: 100, duration: 60, geometry: { coordinates: [[30, 50]] } }] }) };
    };
    const to = { lat: 3, lng: 3 };
    await getRoute(kyiv, to, "foot", { fetchFn });
    await getRoute(kyiv, to, "foot", { fetchFn });
    assert.equal(calls, 1);
});
