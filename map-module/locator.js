// Зв'язує дані, фільтри, карту, список і маршрути з елементами сторінки map.html.
import {
    CHAINS, prepareStores, withDistances, filterStores, sortByDistance,
    nearestStore, formatDistance, formatDuration, pluralStores
} from "./geo.js";
import { getRoute, externalRouteUrl } from "./routing.js";
import { createMapView } from "./map-view.js";

const LIST_LIMIT = 30; // у списку лише перші 30, на карті — всі відфільтровані
const MODES = { foot: "Пішки", car: "Авто" };

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export async function initStoreLocator({
    root = document,
    dataUrl = new URL("./data/stores.json", import.meta.url),
    notify = () => {},
    mapFactory = createMapView
} = {}) {
    const $ = selector => root.querySelector(selector);
    const cityInput = $("#citySearch");
    const nameInput = $("#nameSearch");
    const list = $("#store-list");
    const info = $("#selected-store-info");
    const sortButton = $("#sort-distance");
    const locationButton = $("#location-button");

    const state = {
        stores: [], visible: [], origin: null, chain: "all", mode: "foot",
        ascending: true, selectedId: null, routeRequest: 0, routeTarget: null
    };

    let view = null;
    try {
        view = mapFactory($("#map-canvas"), { onSelect: id => select(id, { scroll: true }) });
    } catch (error) {
        console.error(error);
        notify("Карту не вдалося завантажити. Список магазинів працює без неї.");
    }

    try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.stores = prepareStores(await response.json());
    } catch (error) {
        console.error(error);
        showInfo("Дані не завантажено", "Не вдалося отримати список магазинів. Оновіть сторінку.");
        return;
    }

    const cityList = $("#city-options");
    [...new Set(state.stores.map(s => s.city))]
        .sort((a, b) => a.localeCompare(b, "uk"))
        .forEach(city => cityList.append(new Option(city, city)));

    function showInfo(title, text) {
        const body = el("div");
        body.append(el("strong", "", title), el("small", "", text));
        info.replaceChildren(el("span", "info-icon", "⌖"), body);
        return body;
    }

    function storeCard(store) {
        const card = el("article", "store-card");
        card.dataset.id = store.id;
        card.tabIndex = 0;
        const chain = CHAINS[store.chain];
        const details = el("div", "store-details");
        details.append(el("h3", "", store.name), el("p", "", `${store.city}, ${store.address}`));
        if (store.distance !== null) {
            const nearest = store.id === nearestStore(state.visible)?.id;
            details.append(el("span", "",
                `● ${formatDistance(store.distance)} по прямій${nearest ? " · найближчий" : ""}`));
        }
        const button = el("button", "route-button", "Прокласти маршрут →");
        button.type = "button";
        button.addEventListener("click", event => {
            event.stopPropagation();
            buildRoute(store.id);
        });
        details.append(button);
        card.append(el("div", `store-logo logo-${store.chain}`, chain.logo), details);
        card.addEventListener("click", () => select(store.id, { focus: true }));
        card.addEventListener("keydown", event => {
            if (event.key === "Enter" && event.target === card) select(store.id, { focus: true });
        });
        return card;
    }

    // Прибирає лінію маршруту; відповіді на старі запити після цього ігноруються.
    function cancelRoute() {
        state.routeRequest++;
        state.routeTarget = null;
        view?.clearRoute();
    }

    // fit: чи підлаштовувати масштаб карти під результат.
    function render({ fit = true } = {}) {
        cancelRoute();

        const filtered = filterStores(withDistances(state.stores, state.origin), {
            city: cityInput.value, query: nameInput.value, chain: state.chain
        });
        state.visible = sortByDistance(filtered, state.ascending);
        const shown = state.visible.slice(0, LIST_LIMIT);

        list.replaceChildren(...shown.map(storeCard));
        list.scrollTop = 0;
        $("#visible-count").textContent = state.visible.length;
        $("#visible-label").textContent = pluralStores(state.visible.length);
        $("#no-stores").hidden = state.visible.length !== 0;
        $("#list-hint").textContent = state.visible.length > shown.length
            ? `У списку ${shown.length} з ${state.visible.length}. ` +
                (state.origin ? "Уточніть пошук." : "Уточніть пошук або увімкніть геолокацію.")
            : "Оберіть магазин для перегляду";
        view?.showStores(state.visible);

        const nearest = nearestStore(state.visible);
        if (nearest) {
            select(nearest.id);
            if (fit) view?.fit([state.origin, nearest]);
            return;
        }
        state.selectedId = null;
        if (!state.visible.length) {
            showInfo("Нічого не обрано", "Змініть пошук або фільтр.");
            return;
        }
        showInfo("Магазин не обрано", "Натисніть «Моє місце», щоб знайти найближчий.");
        const isFiltered = cityInput.value.trim() || nameInput.value.trim() || state.chain !== "all";
        if (fit && isFiltered) view?.fit(state.visible);
    }

    function select(id, { focus = false, scroll = false } = {}) {
        const store = state.visible.find(s => s.id === id);
        if (!store) return;
        if (state.selectedId !== id) cancelRoute();
        state.selectedId = id;
        list.querySelectorAll(".store-card").forEach(card => {
            const active = Number(card.dataset.id) === id;
            card.classList.toggle("selected", active);
            if (active && scroll) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        view?.select(id, { focus });
        const distance = store.distance === null ? "" : ` · ${formatDistance(store.distance)} по прямій`;
        showInfo(`Обрано: ${store.name}`, `${store.city}, ${store.address}${distance}`);
    }

    function locate() {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                notify("Ваш браузер не підтримує геолокацію.");
                return resolve(false);
            }
            locationButton.disabled = true;
            notify("Визначаємо ваше місцезнаходження…");
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    locationButton.disabled = false;
                    state.origin = { lat: coords.latitude, lng: coords.longitude };
                    state.ascending = true;
                    updateSortButton();
                    $("#user-location-text").textContent =
                        `Визначено (точність ≈ ${formatDistance(coords.accuracy / 1000)})`;
                    view?.showUser(state.origin);
                    resolve(true);
                },
                error => {
                    locationButton.disabled = false;
                    notify(error.code === 1
                        ? "Доступ до геолокації заборонено. Дозвольте його в налаштуваннях браузера."
                        : "Не вдалося визначити місцезнаходження. Спробуйте ще раз.");
                    resolve(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        });
    }

    async function buildRoute(id) {
        if (!state.origin) {
            if (!await locate()) {
                select(id);
                addExternalLink(id);
                return;
            }
            render({ fit: false });
        }
        // Після геолокації обраний магазин міг опинитися поза першими 30 — він лишається на карті.
        select(id, { scroll: true });
        const store = state.visible.find(s => s.id === id);
        if (!store) return;

        cancelRoute();
        state.routeTarget = id;
        const request = state.routeRequest;
        const mode = state.mode;
        showInfo(`Маршрут: ${store.name}`, "Будуємо маршрут…");
        try {
            const route = await getRoute(state.origin, store, mode);
            if (request !== state.routeRequest) return;
            view?.showRoute(route.points);
            showInfo(`${MODES[mode]}: ${formatDuration(route.durationSec)} · ${formatDistance(route.distanceKm)}`,
                `${store.name}, ${store.city}, ${store.address}` +
                (mode === "car" ? ". Час без урахування заторів." : ""));
        } catch (error) {
            if (request !== state.routeRequest) return;
            console.error(error);
            showInfo("Маршрут тимчасово недоступний", `${store.name}, ${store.address}`);
        }
        addExternalLink(id);
    }

    function addExternalLink(id) {
        const store = state.visible.find(s => s.id === id);
        if (!store) return;
        const link = el("a", "external-route", "Відкрити в Google Maps ↗");
        link.href = externalRouteUrl(store, state.mode);
        link.target = "_blank";
        link.rel = "noopener";
        info.lastElementChild.append(link);
    }

    function updateSortButton() {
        sortButton.textContent = state.ascending ? "За відстанню ↑" : "За відстанню ↓";
    }

    // Групи кнопок: фільтр мережі та спосіб пересування.
    function bindChoice(selector, key, onChange) {
        const buttons = [...root.querySelectorAll(`${selector} button`)];
        buttons.forEach(button => button.addEventListener("click", () => {
            state[key] = button.dataset.value;
            buttons.forEach(b => b.setAttribute("aria-pressed", String(b === button)));
            onChange();
        }));
    }

    bindChoice("#chain-filter", "chain", () => render());
    bindChoice("#route-mode", "mode", () => {
        if (state.routeTarget !== null) buildRoute(state.routeTarget);
    });

    cityInput.addEventListener("input", () => render());
    nameInput.addEventListener("input", () => render());
    $("#clear-search").addEventListener("click", () => {
        nameInput.value = "";
        cityInput.value = "";
        render();
        nameInput.focus();
    });
    locationButton.addEventListener("click", async () => {
        if (await locate()) render();
    });
    sortButton.addEventListener("click", () => {
        if (!state.origin) {
            notify("Спершу натисніть «Моє місце».");
            return;
        }
        state.ascending = !state.ascending;
        updateSortButton();
        render({ fit: false });
    });
    $("#zoom-in").addEventListener("click", () => view?.zoomIn());
    $("#zoom-out").addEventListener("click", () => view?.zoomOut());

    render();
}
