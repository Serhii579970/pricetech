// app.js (Leaflet + PriceTech UI + Multi-Stop Route Planner)

let map;
let markerCluster = null;
let userMarker = null;
let userAccuracyCircle = null;
let userCoords = null;
let userAccuracy = null;
let isGeoActive = false;
let geoWatchId = null;
let userManuallyMoved = false;
let distanceSortAsc = true;
let toastTimer = null;

// Стан планувальника маршруту
const ROUTE_STORAGE_KEY = 'pt_route_planner_v1';
let routeLayer = null;
let routeWaypointsLayer = null;
let customStartMarker = null;
let routeStops = []; // масив об'єктів магазинів у порядку відвідування
let activeRouteMode = 'car'; // 'car' | 'foot'
let routeStartMode = 'gps'; // 'gps' | 'custom' | 'first-store'
let customStartCoords = null; // { lat, lng }
let isPickingStartOnMap = false;
let returnToStart = false;
let lastRouteLegs = []; // [{ distance, duration }]
let routeAbortController = null;

// Стан списку (пагінація для швидкого рендеру 1600+ магазинів)
const LIST_PAGE_SIZE = 50;
let currentRenderedStores = [];
let currentHighlightNearest = false;
let renderedListCount = 0;
let selectedStoreId = null;
const storeMarkersById = new Map();
const storeIconCache = new Map();

// Налаштування точної геолокації
const DESIRED_ACCURACY_METERS = 30;
const GEO_REFINE_WINDOW_MS = 5000;
const GEO_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000
};

// Елементи DOM
const cityInput = document.getElementById('citySearch');
const nameInput = document.getElementById('nameSearch');
const topSearchInput = document.getElementById('top-search');
const clearSearchBtn = document.getElementById('clear-search');
const autocompleteList = document.getElementById('autocompleteList');
const storesListContainer = document.getElementById('storesList');
const noStoresEl = document.getElementById('no-stores');
const geoBtn = document.getElementById('geoBtn');
const sortDistanceBtn = document.getElementById('sort-distance');
const locatorContainer = document.getElementById('pricetechLocator');
const mapContainer = document.getElementById('mapContainer');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const visibleCountEl = document.getElementById('visible-count');
const visibleCountLabelEl = document.getElementById('visible-count-label');
const storesPanelTitleEl = document.getElementById('stores-panel-title');
const topbarLocationText = document.getElementById('topbar-location-text');
const selectedStoreTitleEl = document.getElementById('selected-store-title');
const selectedStoreDescEl = document.getElementById('selected-store-desc');
const toastEl = document.getElementById('toast');

// Елементи панелі керування картою
const fsZoomInBtn = document.getElementById('fsZoomInBtn');
const fsZoomOutBtn = document.getElementById('fsZoomOutBtn');
const fsZoomLevelEl = document.getElementById('fsZoomLevel');
const fsLocateBtn = document.getElementById('fsLocateBtn');
const fsResetViewBtn = document.getElementById('fsResetViewBtn');
const fsToggleListBtn = document.getElementById('fsToggleListBtn');

// Елементи планувальника маршруту
const togglePlannerBtn = document.getElementById('togglePlannerBtn');
const plannerCountBadge = document.getElementById('plannerCountBadge');
const routePanel = document.getElementById('routePanel');
const routeStoreName = document.getElementById('routeStoreName');
const routeStoreAddress = document.getElementById('routeStoreAddress');
const routeSummary = document.getElementById('routeSummary');
const closeRouteBtn = document.getElementById('closeRouteBtn');
const routeModeButtons = document.querySelectorAll('.pt-route-mode-btn');
const startModeButtons = document.querySelectorAll('.pt-start-mode-btn');
const pickStartOnMapBtn = document.getElementById('pickStartOnMapBtn');
const startPointStatusEl = document.getElementById('startPointStatus');
const routeStopsCountEl = document.getElementById('routeStopsCount');
const routeStopsListEl = document.getElementById('routeStopsList');
const routeStopsEmptyEl = document.getElementById('routeStopsEmpty');
const optimizeRouteBtn = document.getElementById('optimizeRouteBtn');
const clearRouteStopsBtn = document.getElementById('clearRouteStopsBtn');
const roundTripCheckbox = document.getElementById('roundTripCheckbox');
const buildPlannedRouteBtn = document.getElementById('buildPlannedRouteBtn');
const openGoogleMapsBtn = document.getElementById('openGoogleMapsBtn');
const mapPickHintEl = document.getElementById('mapPickHint');
const cancelMapPickBtn = document.getElementById('cancelMapPickBtn');

// Дефолтний центр (Центр України)
const defaultCenter = [48.3794, 31.1656];
const defaultZoom = 6;

const defaultBtnContent = '<span>◎</span> Моє місце';
const activeGeoBtnContent = '<span>✕</span> Скинути локацію';

const enterFullscreenIcon = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
    </svg>
`;

const exitFullscreenIcon = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
    </svg>
`;

const carIconSvg = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"></path>
    </svg>
`;

const footIconSvg = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"></path>
    </svg>
`;

// Іконка позиції користувача
const userLocationIcon = L.divIcon({
    className: 'pt-user-marker',
    html: '<div class="pt-user-pin"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

const customStartIcon = L.divIcon({
    className: 'pt-custom-start-marker',
    html: '<div class="pt-custom-start-pin" title="Точка старту маршруту">S</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
});

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3500);
}

function getStorePlural(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'магазин';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'магазини';
    return 'магазинів';
}

function getStopPlural(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'зупинка';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'зупинки';
    return 'зупинок';
}

function getStoreBrandMeta(storeName) {
    const lower = storeName.toLowerCase();
    if (lower.includes('атб')) return { cls: 'logo-atb', label: 'АТБ' };
    if (lower.includes('сільпо') || lower.includes('silpo')) return { cls: 'logo-silpo', label: 'С' };
    if (lower.includes('varus')) return { cls: 'logo-varus', label: 'V' };
    if (lower.includes('ашан')) return { cls: 'logo-aushan', label: 'А' };
    return { cls: 'logo-default', label: storeName.slice(0, 2).toUpperCase() };
}

function getStoreMarkerIcon(storeName) {
    const brand = getStoreBrandMeta(storeName);
    const cacheKey = `${brand.cls}|${brand.label}`;
    if (storeIconCache.has(cacheKey)) {
        return storeIconCache.get(cacheKey);
    }

    const icon = L.divIcon({
        className: 'pt-store-marker',
        html: `
            <div class="pt-store-pin">
                <span class="pt-store-pin-badge ${brand.cls}">${brand.label}</span>
                <span class="pt-store-pin-tail"></span>
            </div>
        `,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -38]
    });

    storeIconCache.set(cacheKey, icon);
    return icon;
}

function createWaypointBadgeIcon(number) {
    return L.divIcon({
        className: 'pt-waypoint-marker',
        html: `<div class="pt-waypoint-badge">${number}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });
}

function setSelectedStoreMarker(storeId) {
    if (selectedStoreId !== null && selectedStoreId !== storeId) {
        const prevMarker = storeMarkersById.get(selectedStoreId);
        if (prevMarker) {
            const prevEl = prevMarker.getElement();
            if (prevEl) prevEl.classList.remove('is-selected');
            prevMarker.setZIndexOffset(0);
        }
    }

    selectedStoreId = storeId;

    if (storeId !== null) {
        const nextMarker = storeMarkersById.get(storeId);
        if (nextMarker) {
            const nextEl = nextMarker.getElement();
            if (nextEl) nextEl.classList.add('is-selected');
            nextMarker.setZIndexOffset(600);
        }
    }
}

function updateZoomBadge() {
    if (!map || !fsZoomLevelEl) return;
    fsZoomLevelEl.textContent = String(map.getZoom());
}

function updateFsLocateBtnUI() {
    if (!fsLocateBtn) return;
    fsLocateBtn.classList.toggle('active', Boolean(userCoords));
    fsLocateBtn.title = userCoords
        ? 'Перейти до мого місцезнаходження'
        : 'Визначити моє місцезнаходження';
}

function setStoresPanelCollapsed(collapsed) {
    if (!locatorContainer) return;
    locatorContainer.classList.toggle('is-stores-collapsed', collapsed);
    if (fsToggleListBtn) {
        const isVisible = !collapsed;
        fsToggleListBtn.classList.toggle('active', isVisible);
        fsToggleListBtn.setAttribute('aria-pressed', String(isVisible));
        fsToggleListBtn.title = isVisible ? 'Сховати список магазинів' : 'Показати список магазинів';
    }
    refreshMapLayout();
}

function resetMapViewToVisibleStores() {
    if (!map) return;

    if (currentRenderedStores.length > 1) {
        const bounds = L.latLngBounds(currentRenderedStores.map(store => [store.lat, store.lng]));
        if (userCoords) {
            bounds.extend([userCoords.lat, userCoords.lng]);
        }
        map.fitBounds(bounds, { padding: [36, 36] });
    } else if (currentRenderedStores.length === 1) {
        const only = currentRenderedStores[0];
        map.setView([only.lat, only.lng], 14, { animate: true });
    } else {
        map.setView(defaultCenter, defaultZoom, { animate: true });
    }
}

// 1. Ініціалізація карти
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined') return;

    map = L.map('map', { zoomControl: false }).setView(defaultCenter, defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('zoomend', updateZoomBadge);
    map.on('click', handleMapClickForStartPoint);
    map.on('popupopen', (e) => {
        const popupEl = e.popup && e.popup.getElement ? e.popup.getElement() : null;
        if (!popupEl) return;
        const planBtn = popupEl.querySelector('.pt-popup-plan-btn');
        if (planBtn) {
            const storeId = Number(planBtn.dataset.planStoreId);
            syncPlanButtonElement(planBtn, isStoreInRoutePlan(storeId));
        }
    });

    updateZoomBadge();
    updateFsLocateBtnUI();

    restoreRoutePlanState();
    applyFilters(false);
    renderRoutePlannerUI();
    renderRouteWaypointMarkers();
}

// 2. Повноекранний режим для карти, пошуку та списку
function refreshMapLayout() {
    if (!map) return;
    map.invalidateSize({ pan: false });
    requestAnimationFrame(() => {
        if (map) map.invalidateSize({ pan: false });
    });
    setTimeout(() => {
        if (map) map.invalidateSize({ pan: false });
    }, 200);
}

function getNativeFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function isFullscreenActive() {
    return Boolean(getNativeFullscreenElement()) ||
        Boolean(locatorContainer && locatorContainer.classList.contains('is-fullscreen'));
}

function applyFullscreenUI(isFull) {
    if (!locatorContainer || !fullscreenBtn) return;

    const nativeEl = getNativeFullscreenElement();
    const useFallbackClass = isFull && !nativeEl;

    locatorContainer.classList.toggle('is-fullscreen', useFallbackClass);
    document.body.classList.toggle('pt-fullscreen-lock', isFull);

    if (!isFull) {
        setStoresPanelCollapsed(false);
    }

    fullscreenBtn.innerHTML = isFull ? exitFullscreenIcon : enterFullscreenIcon;
    fullscreenBtn.title = isFull ? 'Вийти з повного екрана' : 'На весь екран';
    fullscreenBtn.setAttribute('aria-label', fullscreenBtn.title);

    updateZoomBadge();
    updateFsLocateBtnUI();
    refreshMapLayout();
}

async function toggleMapFullscreen() {
    if (!locatorContainer) return;

    const nativeEl = getNativeFullscreenElement();
    const currentlyFull = isFullscreenActive();

    if (!currentlyFull) {
        if (typeof locatorContainer.requestFullscreen === 'function') {
            try {
                await locatorContainer.requestFullscreen();
                return;
            } catch (_) {
                applyFullscreenUI(true);
                return;
            }
        }
        if (typeof locatorContainer.webkitRequestFullscreen === 'function') {
            try {
                locatorContainer.webkitRequestFullscreen();
                return;
            } catch (_) {
                applyFullscreenUI(true);
                return;
            }
        }
        applyFullscreenUI(true);
    } else {
        if (nativeEl) {
            try {
                if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
                    await document.exitFullscreen();
                } else if (document.webkitFullscreenElement && typeof document.webkitExitFullscreen === 'function') {
                    document.webkitExitFullscreen();
                }
            } catch (_) {
                // Прибираємо fallback нижче
            }
        }
        applyFullscreenUI(false);
    }
}

if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleMapFullscreen);
}

// Обробники кнопок панелі керування картою
if (fsZoomInBtn) {
    fsZoomInBtn.addEventListener('click', () => {
        if (map) map.zoomIn();
    });
}

if (fsZoomOutBtn) {
    fsZoomOutBtn.addEventListener('click', () => {
        if (map) map.zoomOut();
    });
}

if (fsLocateBtn) {
    fsLocateBtn.addEventListener('click', () => {
        if (userCoords && map) {
            map.setView([userCoords.lat, userCoords.lng], Math.max(map.getZoom(), 15), { animate: true });
            return;
        }
        requestUserLocation({ filterNearest: true }).catch(() => {});
    });
}

if (fsResetViewBtn) {
    fsResetViewBtn.addEventListener('click', resetMapViewToVisibleStores);
}

if (fsToggleListBtn) {
    fsToggleListBtn.addEventListener('click', () => {
        if (!locatorContainer) return;
        const currentlyCollapsed = locatorContainer.classList.contains('is-stores-collapsed');
        setStoresPanelCollapsed(!currentlyCollapsed);
    });
}

function handleFullscreenChange() {
    applyFullscreenUI(Boolean(getNativeFullscreenElement()));
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isPickingStartOnMap) {
            setMapPickStartMode(false);
            return;
        }
        if (locatorContainer && locatorContainer.classList.contains('is-fullscreen') && !getNativeFullscreenElement()) {
            applyFullscreenUI(false);
        }
    }
});

// 3. Вибір міста зі списку
function selectCity(city) {
    if (cityInput) cityInput.value = city;
    if (autocompleteList) autocompleteList.style.display = 'none';
    applyFilters(false);

    if (!city && (!nameInput || !nameInput.value.trim())) {
        map.setView(defaultCenter, defaultZoom);
    }
}

// 4. Головна функція фільтрації
function applyFilters(forceNearest = false) {
    if (!map) return;

    const nearestMode = Boolean(userCoords && (isGeoActive || forceNearest));
    const cityFilter = cityInput ? cityInput.value.trim().toLowerCase() : '';
    const nameFilter = nameInput ? nameInput.value.trim().toLowerCase() : '';

    let result = storesDB.map(store => {
        if (userCoords) {
            const distance = calculateDistance(userCoords.lat, userCoords.lng, store.lat, store.lng);
            return { ...store, distance };
        }
        return { ...store };
    });

    if (cityFilter) {
        result = result.filter(store => store.city.toLowerCase() === cityFilter);
    }

    if (nameFilter) {
        result = result.filter(store =>
            store.name.toLowerCase().includes(nameFilter) ||
            store.address.toLowerCase().includes(nameFilter) ||
            store.city.toLowerCase().includes(nameFilter)
        );
    }

    if (nearestMode) {
        result.sort((a, b) => distanceSortAsc ? a.distance - b.distance : b.distance - a.distance);
        if (!cityFilter && !nameFilter) {
            result = result.slice(0, 10);
        }
    }

    renderStores(result, nearestMode);
}

// 5. Створення картки магазину для списку PriceTech
function syncPlanButtonElement(btn, isInPlan) {
    if (!btn) return;
    btn.classList.toggle('in-plan', isInPlan);
    btn.textContent = isInPlan ? 'У маршруті ✓' : '+ У маршрут';
}

function syncAllPlanButtonsUI() {
    document.querySelectorAll('[data-plan-store-id]').forEach(btn => {
        const storeId = Number(btn.dataset.planStoreId);
        syncPlanButtonElement(btn, isStoreInRoutePlan(storeId));
    });
}

function createStoreCardElement(store, isNearest) {
    const brand = getStoreBrandMeta(store.name);
    const card = document.createElement('article');
    card.className = 'store-card';
    card.dataset.storeId = String(store.id);

    const nearestBadge = isNearest ? '<span class="pt-nearest-label">Найближчий</span>' : '';
    const distanceHtml = store.distance !== undefined
        ? `<span>● ~${store.distance.toFixed(1)} км від вас</span>`
        : `<span>● ${escapeHtml(store.city)}</span>`;
    const inPlan = isStoreInRoutePlan(store.id);

    card.innerHTML = `
        <div class="store-logo ${brand.cls}">${brand.label}</div>
        <div class="store-details">
            <h3>${escapeHtml(store.name)} ${nearestBadge}</h3>
            <p>${escapeHtml(store.city)}, ${escapeHtml(store.address)}</p>
            ${distanceHtml}
            <div class="store-card-actions">
                <button type="button" class="route-button" data-card-route-id="${store.id}">Прокласти маршрут →</button>
                <button type="button" class="plan-add-button${inPlan ? ' in-plan' : ''}" data-plan-store-id="${store.id}">${inPlan ? 'У маршруті ✓' : '+ У маршрут'}</button>
            </div>
        </div>
    `;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.route-button')) {
            e.stopPropagation();
            selectStoreOnMap(store, card, false);
            buildRouteToStore(store, activeRouteMode);
            return;
        }
        if (e.target.closest('.plan-add-button')) {
            e.stopPropagation();
            toggleStoreInRoutePlan(store);
            return;
        }
        selectStoreOnMap(store, card, true);
    });

    return card;
}

function appendNextStoreCards() {
    const existingMoreBtn = storesListContainer.querySelector('.load-more-button');
    if (existingMoreBtn) existingMoreBtn.remove();

    const slice = currentRenderedStores.slice(renderedListCount, renderedListCount + LIST_PAGE_SIZE);
    slice.forEach((store, offset) => {
        const index = renderedListCount + offset;
        const isNearest = currentHighlightNearest && distanceSortAsc && index === 0;
        const card = createStoreCardElement(store, isNearest);
        storesListContainer.appendChild(card);
    });

    renderedListCount += slice.length;

    if (renderedListCount < currentRenderedStores.length) {
        const remaining = currentRenderedStores.length - renderedListCount;
        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'load-more-button';
        moreBtn.textContent = `Показати ще (залишилось ${remaining})`;
        moreBtn.addEventListener('click', appendNextStoreCards);
        storesListContainer.appendChild(moreBtn);
    }
}

function selectStoreOnMap(store, cardEl = null, openPopup = true) {
    if (!map || !store) return;

    const latLng = [store.lat, store.lng];
    const marker = storeMarkersById.get(store.id);

    setSelectedStoreMarker(store.id);

    if (openPopup) {
        map.setView(latLng, 16, { animate: true });
        if (marker) {
            if (markerCluster && typeof markerCluster.zoomToShowLayer === 'function') {
                markerCluster.zoomToShowLayer(marker, () => {
                    setSelectedStoreMarker(store.id);
                    marker.openPopup();
                });
            } else {
                setSelectedStoreMarker(store.id);
                marker.openPopup();
            }
        }
    }

    const targetCard = cardEl || storesListContainer.querySelector(`.store-card[data-store-id="${store.id}"]`);
    highlightListItem(targetCard);
    updateSelectedStoreBox(store);
}

function updateSelectedStoreBox(store) {
    if (!selectedStoreTitleEl || !selectedStoreDescEl) return;
    if (!store) {
        selectedStoreTitleEl.textContent = 'Оберіть магазин';
        selectedStoreDescEl.textContent = 'Натисніть на магазин у списку або на карті, щоб прокласти маршрут.';
        return;
    }
    selectedStoreTitleEl.textContent = `Обрано: ${store.name}`;
    const distPart = store.distance !== undefined ? ` (~${store.distance.toFixed(1)} км)` : '';
    selectedStoreDescEl.textContent = `${store.city}, ${store.address}${distPart}`;
}

// 6. Рендер магазинів у список, створення маркерів та кластерів
function renderStores(storesToRender, highlightNearest = false) {
    storesListContainer.innerHTML = '';
    storeMarkersById.clear();
    selectedStoreId = null;
    clearMarkers();

    currentRenderedStores = storesToRender;
    currentHighlightNearest = highlightNearest;
    renderedListCount = 0;

    if (visibleCountEl) visibleCountEl.textContent = String(storesToRender.length);
    if (visibleCountLabelEl) visibleCountLabelEl.textContent = getStorePlural(storesToRender.length);
    if (storesPanelTitleEl) {
        storesPanelTitleEl.textContent = highlightNearest ? 'Найближчі магазини' : 'Магазини';
    }

    if (storesToRender.length === 0) {
        if (noStoresEl) noStoresEl.hidden = false;
        updateSelectedStoreBox(null);
        return;
    }
    if (noStoresEl) noStoresEl.hidden = true;

    const useCluster = typeof L.markerClusterGroup === 'function';
    const clusterLayer = useCluster
        ? L.markerClusterGroup({
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="pt-cluster-badge">${count}</div>`,
                    className: 'pt-cluster-icon',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });
            }
        })
        : L.layerGroup();

    const bounds = L.latLngBounds();
    let nearestStore = null;

    storesToRender.forEach((store, index) => {
        const latLng = [store.lat, store.lng];
        const marker = L.marker(latLng, {
            title: store.name,
            icon: getStoreMarkerIcon(store.name)
        });

        const distanceInfo = store.distance !== undefined
            ? `<p><strong>Відстань напряму:</strong> ~${store.distance.toFixed(1)} км</p>`
            : '';
        const inPlan = isStoreInRoutePlan(store.id);

        const infoContent = `
            <div class="pt-infowindow">
                <h4>${escapeHtml(store.name)}</h4>
                <p>${escapeHtml(store.city)}, ${escapeHtml(store.address)}</p>
                ${distanceInfo}
                <div class="pt-popup-route-actions">
                    <button type="button" class="pt-popup-route-btn" data-route-store-id="${store.id}" data-route-mode="car">
                        ${carIconSvg}
                        Авто
                    </button>
                    <button type="button" class="pt-popup-route-btn" data-route-store-id="${store.id}" data-route-mode="foot">
                        ${footIconSvg}
                        Пішки
                    </button>
                </div>
                <button type="button" class="pt-popup-plan-btn${inPlan ? ' in-plan' : ''}" data-plan-store-id="${store.id}">
                    ${inPlan ? 'У маршруті ✓' : '+ У маршрут'}
                </button>
            </div>
        `;

        marker.bindPopup(infoContent);
        clusterLayer.addLayer(marker);
        storeMarkersById.set(store.id, marker);
        bounds.extend(latLng);

        marker.on('add', () => {
            if (selectedStoreId === store.id) {
                const el = marker.getElement();
                if (el) el.classList.add('is-selected');
                marker.setZIndexOffset(600);
            }
        });

        marker.on('click', () => {
            setSelectedStoreMarker(store.id);
            const card = storesListContainer.querySelector(`.store-card[data-store-id="${store.id}"]`);
            highlightListItem(card);
            updateSelectedStoreBox(store);
        });

        if (highlightNearest && distanceSortAsc && index === 0) {
            nearestStore = store;
        }
    });

    markerCluster = clusterLayer;
    map.addLayer(markerCluster);

    appendNextStoreCards();

    // Масштабування карти
    if (highlightNearest && nearestStore && userMarker) {
        const nearestMarker = storeMarkersById.get(nearestStore.id);
        const nearestBounds = L.latLngBounds([
            userMarker.getLatLng(),
            nearestMarker.getLatLng()
        ]);

        map.fitBounds(nearestBounds, { padding: [40, 40], maxZoom: 15 });

        if (useCluster && clusterLayer.zoomToShowLayer) {
            clusterLayer.zoomToShowLayer(nearestMarker, () => {
                setSelectedStoreMarker(nearestStore.id);
                nearestMarker.openPopup();
            });
        } else {
            setSelectedStoreMarker(nearestStore.id);
            nearestMarker.openPopup();
        }
        const firstCard = storesListContainer.querySelector(`.store-card[data-store-id="${nearestStore.id}"]`);
        highlightListItem(firstCard);
        updateSelectedStoreBox(nearestStore);
    } else if (storesToRender.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
    } else if (storesToRender.length === 1) {
        map.setView(bounds.getCenter(), 14);
        setSelectedStoreMarker(storesToRender[0].id);
        updateSelectedStoreBox(storesToRender[0]);
    }
}

// 7. Підсвітка активного елемента списку
function highlightListItem(listItem) {
    document.querySelectorAll('.store-card').forEach(el => el.classList.remove('selected'));
    if (listItem) {
        listItem.classList.add('selected');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 8. Очищення маркерів та кластерів
function clearMarkers() {
    if (markerCluster) {
        if (typeof markerCluster.clearLayers === 'function') {
            markerCluster.clearLayers();
        }
        map.removeLayer(markerCluster);
        markerCluster = null;
    }
}

// 9. Планувальник маршруту (мультиточковий маршрут, оптимізація, Авто / Пішки через OSRM)
function formatRouteDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} м`;
    }
    return `${(meters / 1000).toFixed(1)} км`;
}

function formatRouteDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 1) {
        return '< 1 хв';
    }
    if (totalMinutes < 60) {
        return `${totalMinutes} хв`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} год ${minutes} хв` : `${hours} год`;
}

function saveRoutePlanState() {
    try {
        const payload = {
            stopIds: routeStops.map(s => s.id),
            mode: activeRouteMode,
            startMode: routeStartMode,
            returnToStart
        };
        localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
        // localStorage може бути недоступним у приватному режимі
    }
}

function restoreRoutePlanState() {
    try {
        const raw = localStorage.getItem(ROUTE_STORAGE_KEY);
        if (!raw || typeof storesDB === 'undefined') return;
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.stopIds)) {
            const byId = new Map(storesDB.map(s => [s.id, s]));
            routeStops = saved.stopIds
                .map(id => byId.get(id))
                .filter(Boolean);
        }
        if (saved && (saved.mode === 'car' || saved.mode === 'foot')) {
            activeRouteMode = saved.mode;
        }
        if (saved && (saved.startMode === 'gps' || saved.startMode === 'custom' || saved.startMode === 'first-store')) {
            routeStartMode = saved.startMode;
        }
        if (saved && typeof saved.returnToStart === 'boolean') {
            returnToStart = saved.returnToStart;
            if (roundTripCheckbox) roundTripCheckbox.checked = returnToStart;
        }
    } catch (_) {
        // Ігноруємо пошкоджені дані
    }
}

function isStoreInRoutePlan(storeId) {
    return routeStops.some(store => store.id === storeId);
}

function setPlannerPanelOpen(isOpen) {
    if (!routePanel) return;
    routePanel.hidden = !isOpen;
    if (togglePlannerBtn) {
        togglePlannerBtn.classList.toggle('active', isOpen);
        togglePlannerBtn.setAttribute('aria-expanded', String(isOpen));
    }
    if (!isOpen && isPickingStartOnMap) {
        setMapPickStartMode(false);
    }
}

function updateRouteModeButtonsUI(mode) {
    routeModeButtons.forEach(btn => {
        const isCurrent = btn.dataset.mode === mode;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
    });
}

function updateStartModeButtonsUI() {
    startModeButtons.forEach(btn => {
        const isCurrent = btn.dataset.startMode === routeStartMode;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
    });

    if (pickStartOnMapBtn) {
        pickStartOnMapBtn.hidden = routeStartMode !== 'custom';
        pickStartOnMapBtn.textContent = customStartCoords ? 'Змінити на карті' : 'Вказати на карті';
    }

    if (!startPointStatusEl) return;
    if (routeStartMode === 'gps') {
        startPointStatusEl.textContent = userCoords
            ? 'Старт: ваша поточна локація'
            : 'Геолокація буде визначена при побудові маршруту';
    } else if (routeStartMode === 'custom') {
        startPointStatusEl.textContent = customStartCoords
            ? `Старт на карті: ${customStartCoords.lat.toFixed(4)}, ${customStartCoords.lng.toFixed(4)} (можна перетягувати)`
            : 'Натисніть на карту, щоб обрати точку старту';
    } else {
        startPointStatusEl.textContent = routeStops.length > 0
            ? `Старт: ${routeStops[0].name}`
            : 'Маршрут почнеться з першого доданого магазину';
    }
}

function setMapPickStartMode(active) {
    isPickingStartOnMap = active;
    if (mapContainer) {
        mapContainer.classList.toggle('is-picking-start', active);
    }
    if (mapPickHintEl) {
        mapPickHintEl.hidden = !active;
    }
}

function setCustomStartPoint(lat, lng, { autoBuild = true } = {}) {
    customStartCoords = { lat, lng };
    if (map) {
        if (!customStartMarker) {
            customStartMarker = L.marker([lat, lng], {
                icon: customStartIcon,
                draggable: true,
                zIndexOffset: 950,
                title: 'Точка старту маршруту (перетягніть для уточнення)'
            }).addTo(map);

            customStartMarker.bindTooltip('Старт маршруту (можна перетягувати)', {
                direction: 'top',
                offset: [0, -12]
            });

            customStartMarker.on('dragend', () => {
                const pos = customStartMarker.getLatLng();
                customStartCoords = { lat: pos.lat, lng: pos.lng };
                updateStartModeButtonsUI();
                updateGoogleMapsExportLink();
                if (canBuildRouteWithoutPrompt()) {
                    buildPlannedRoute({ fitMap: false });
                }
            });
        } else {
            customStartMarker.setLatLng([lat, lng]);
            if (!map.hasLayer(customStartMarker)) {
                customStartMarker.addTo(map);
            }
        }
    }

    setMapPickStartMode(false);
    updateStartModeButtonsUI();
    updateGoogleMapsExportLink();
    showToast('Точку старту встановлено на карті');

    if (autoBuild && canBuildRouteWithoutPrompt()) {
        buildPlannedRoute({ fitMap: true });
    }
}

function removeCustomStartMarker() {
    if (customStartMarker && map && map.hasLayer(customStartMarker)) {
        map.removeLayer(customStartMarker);
    }
}

function handleMapClickForStartPoint(e) {
    if (!isPickingStartOnMap) return;
    setCustomStartPoint(e.latlng.lat, e.latlng.lng, { autoBuild: true });
}

function removeRouteLayer() {
    if (routeLayer && map) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
}

function removeRouteWaypointMarkers() {
    if (routeWaypointsLayer && map) {
        map.removeLayer(routeWaypointsLayer);
        routeWaypointsLayer = null;
    }
}

function renderRouteWaypointMarkers() {
    if (!map) return;
    removeRouteWaypointMarkers();

    if (routeStops.length === 0) return;

    routeWaypointsLayer = L.layerGroup();
    routeStops.forEach((store, index) => {
        const badgeMarker = L.marker([store.lat, store.lng], {
            icon: createWaypointBadgeIcon(index + 1),
            zIndexOffset: 850,
            interactive: true
        });
        badgeMarker.bindTooltip(`${index + 1}. ${store.name}`, {
            direction: 'top',
            offset: [0, -12]
        });
        badgeMarker.on('click', () => {
            selectStoreOnMap(store, null, true);
        });
        routeWaypointsLayer.addLayer(badgeMarker);
    });

    routeWaypointsLayer.addTo(map);
}

function getEffectiveRouteWaypoints() {
    const waypoints = [];

    if (routeStartMode === 'gps' && userCoords) {
        waypoints.push({ lat: userCoords.lat, lng: userCoords.lng, isStart: true });
    } else if (routeStartMode === 'custom' && customStartCoords) {
        waypoints.push({ lat: customStartCoords.lat, lng: customStartCoords.lng, isStart: true });
    }

    routeStops.forEach(store => {
        waypoints.push({ lat: store.lat, lng: store.lng, store });
    });

    if (returnToStart && waypoints.length >= 2) {
        waypoints.push({ lat: waypoints[0].lat, lng: waypoints[0].lng, isReturn: true });
    }

    return waypoints;
}

function canBuildRouteWithoutPrompt() {
    if (routeStartMode === 'gps') {
        return Boolean(userCoords) && routeStops.length >= 1;
    }
    if (routeStartMode === 'custom') {
        return Boolean(customStartCoords) && routeStops.length >= 1;
    }
    return routeStops.length >= 2;
}

function hasEnoughStopsToAttemptBuild() {
    if (routeStartMode === 'first-store') {
        return routeStops.length >= 2;
    }
    return routeStops.length >= 1;
}

function updateGoogleMapsExportLink() {
    if (!openGoogleMapsBtn) return;

    const waypoints = getEffectiveRouteWaypoints();
    if (waypoints.length < 2) {
        openGoogleMapsBtn.href = '#';
        openGoogleMapsBtn.classList.add('is-disabled');
        openGoogleMapsBtn.setAttribute('aria-disabled', 'true');
        return;
    }

    const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
    const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
    const middle = waypoints.slice(1, -1).map(pt => `${pt.lat},${pt.lng}`);
    const travelmode = activeRouteMode === 'foot' ? 'walking' : 'driving';

    const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        travelmode
    });
    if (middle.length > 0) {
        params.set('waypoints', middle.join('|'));
    }

    openGoogleMapsBtn.href = `https://www.google.com/maps/dir/?${params.toString()}`;
    openGoogleMapsBtn.classList.remove('is-disabled');
    openGoogleMapsBtn.setAttribute('aria-disabled', 'false');
}

function renderRoutePlannerUI() {
    updateRouteModeButtonsUI(activeRouteMode);
    updateStartModeButtonsUI();

    if (plannerCountBadge) {
        plannerCountBadge.textContent = String(routeStops.length);
        plannerCountBadge.hidden = routeStops.length === 0;
    }
    if (routeStopsCountEl) {
        routeStopsCountEl.textContent = String(routeStops.length);
    }

    if (routeStoreName && routeStoreAddress) {
        if (routeStops.length === 1) {
            routeStoreName.textContent = routeStops[0].name;
            routeStoreAddress.textContent = `${routeStops[0].city}, ${routeStops[0].address}`;
        } else if (routeStops.length > 1) {
            routeStoreName.textContent = `Планувальник маршруту (${routeStops.length} ${getStopPlural(routeStops.length)})`;
            routeStoreAddress.textContent = `${routeStops[0].name} → … → ${routeStops[routeStops.length - 1].name}`;
        } else {
            routeStoreName.textContent = 'Планувальник маршруту';
            routeStoreAddress.textContent = 'Додайте магазини зі списку або карти';
        }
    }

    if (routeStopsEmptyEl) {
        routeStopsEmptyEl.hidden = routeStops.length > 0;
    }

    if (routeStopsListEl) {
        routeStopsListEl.innerHTML = '';
        const hasSeparateStart = routeStartMode === 'gps' || routeStartMode === 'custom';

        routeStops.forEach((store, index) => {
            const li = document.createElement('li');
            li.className = 'pt-route-stop-item';

            // Визначаємо відповідний відрізок (leg) для цієї зупинки
            const legIndex = hasSeparateStart ? index : index - 1;
            const leg = legIndex >= 0 && lastRouteLegs[legIndex] ? lastRouteLegs[legIndex] : null;
            const legHtml = leg
                ? `<span class="pt-route-stop-leg">+ ${formatRouteDistance(leg.distance)} · ~${formatRouteDuration(leg.duration)}</span>`
                : '';

            li.innerHTML = `
                <span class="pt-route-stop-num">${index + 1}</span>
                <div class="pt-route-stop-info">
                    <strong title="${escapeHtml(store.name)}">${escapeHtml(store.name)}</strong>
                    <small title="${escapeHtml(store.city)}, ${escapeHtml(store.address)}">${escapeHtml(store.city)}, ${escapeHtml(store.address)}</small>
                    ${legHtml}
                </div>
                <div class="pt-route-stop-controls">
                    <button type="button" class="pt-stop-ctrl-btn" data-stop-action="up" data-stop-index="${index}" title="Підняти вище" aria-label="Підняти зупинку вище" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button type="button" class="pt-stop-ctrl-btn" data-stop-action="down" data-stop-index="${index}" title="Опустити нижче" aria-label="Опустити зупинку нижче" ${index === routeStops.length - 1 ? 'disabled' : ''}>↓</button>
                    <button type="button" class="pt-stop-ctrl-btn pt-stop-remove" data-stop-action="remove" data-stop-index="${index}" title="Видалити зупинку" aria-label="Видалити зупинку">&times;</button>
                </div>
            `;
            routeStopsListEl.appendChild(li);
        });
    }

    const canOptimize = routeStartMode === 'first-store'
        ? routeStops.length >= 3
        : routeStops.length >= 2;

    if (optimizeRouteBtn) optimizeRouteBtn.disabled = !canOptimize;
    if (clearRouteStopsBtn) clearRouteStopsBtn.disabled = routeStops.length === 0 && !routeLayer;
    if (buildPlannedRouteBtn) buildPlannedRouteBtn.disabled = !hasEnoughStopsToAttemptBuild();
    if (roundTripCheckbox) roundTripCheckbox.checked = returnToStart;

    if (!routeLayer && routeSummary) {
        if (routeStops.length === 0) {
            routeSummary.textContent = 'Додайте хоча б 1 магазин для побудови маршруту.';
        } else if (routeStartMode === 'first-store' && routeStops.length < 2) {
            routeSummary.textContent = 'Додайте ще 1 магазин або змініть точку старту на «Моє місце» / «На карті».';
        } else if (routeStartMode === 'custom' && !customStartCoords) {
            routeSummary.textContent = 'Натисніть на карту, щоб вказати точку старту.';
        } else {
            routeSummary.textContent = 'Натисніть «Побудувати», щоб розрахувати маршрут.';
        }
    }

    updateGoogleMapsExportLink();
    syncAllPlanButtonsUI();
    saveRoutePlanState();
}

function clearRoute() {
    if (routeAbortController) {
        routeAbortController.abort();
        routeAbortController = null;
    }
    removeRouteLayer();
    removeRouteWaypointMarkers();
    routeStops = [];
    lastRouteLegs = [];
    setMapPickStartMode(false);
    renderRoutePlannerUI();
}

function toggleStoreInRoutePlan(store) {
    if (!store) return;

    const existingIndex = routeStops.findIndex(item => item.id === store.id);
    if (existingIndex >= 0) {
        routeStops.splice(existingIndex, 1);
        lastRouteLegs = [];
        showToast(`«${store.name}» видалено з маршруту`);
    } else {
        routeStops.push(store);
        lastRouteLegs = [];
        showToast(`«${store.name}» додано до маршруту (${routeStops.length})`);
    }

    setPlannerPanelOpen(true);
    renderRouteWaypointMarkers();
    renderRoutePlannerUI();

    if (canBuildRouteWithoutPrompt()) {
        buildPlannedRoute({ fitMap: true });
    } else {
        removeRouteLayer();
        renderRoutePlannerUI();
    }
}

function moveRouteStop(index, delta) {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= routeStops.length) return;

    const [moved] = routeStops.splice(index, 1);
    routeStops.splice(targetIndex, 0, moved);
    lastRouteLegs = [];

    renderRouteWaypointMarkers();
    renderRoutePlannerUI();

    if (canBuildRouteWithoutPrompt()) {
        buildPlannedRoute({ fitMap: false });
    }
}

function removeRouteStopAt(index) {
    if (index < 0 || index >= routeStops.length) return;
    routeStops.splice(index, 1);
    lastRouteLegs = [];

    renderRouteWaypointMarkers();

    if (canBuildRouteWithoutPrompt()) {
        renderRoutePlannerUI();
        buildPlannedRoute({ fitMap: false });
    } else {
        removeRouteLayer();
        renderRoutePlannerUI();
    }
}

// Оптимізація порядку зупинок (Nearest Neighbor + 2-opt за Гаверсинусом)
function computePathDistance(startPoint, orderedStores, closeLoop) {
    let total = 0;
    let prev = startPoint;
    for (const store of orderedStores) {
        total += calculateDistance(prev.lat, prev.lng, store.lat, store.lng);
        prev = store;
    }
    if (closeLoop && startPoint) {
        total += calculateDistance(prev.lat, prev.lng, startPoint.lat, startPoint.lng);
    }
    return total;
}

function optimizeRouteStopsOrder() {
    if (routeStops.length < 2) return;

    let fixedStart = null;
    let candidates = [];
    let keepFirstStoreFixed = false;

    if (routeStartMode === 'gps' && userCoords) {
        fixedStart = userCoords;
        candidates = [...routeStops];
    } else if (routeStartMode === 'custom' && customStartCoords) {
        fixedStart = customStartCoords;
        candidates = [...routeStops];
    } else {
        fixedStart = routeStops[0];
        candidates = routeStops.slice(1);
        keepFirstStoreFixed = true;
    }

    if (candidates.length < 2) return;

    // 1. Жадібний алгоритм найближчого сусіда
    const remaining = [...candidates];
    const ordered = [];
    let current = fixedStart;

    while (remaining.length > 0) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = calculateDistance(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        const [nextStore] = remaining.splice(bestIdx, 1);
        ordered.push(nextStore);
        current = nextStore;
    }

    // 2. Локальне покращення 2-opt
    let improved = true;
    let bestDist = computePathDistance(fixedStart, ordered, returnToStart);
    while (improved) {
        improved = false;
        for (let i = 0; i < ordered.length - 1; i++) {
            for (let k = i + 1; k < ordered.length; k++) {
                const swapped = [
                    ...ordered.slice(0, i),
                    ...ordered.slice(i, k + 1).reverse(),
                    ...ordered.slice(k + 1)
                ];
                const candidateDist = computePathDistance(fixedStart, swapped, returnToStart);
                if (candidateDist + 1e-6 < bestDist) {
                    ordered.splice(0, ordered.length, ...swapped);
                    bestDist = candidateDist;
                    improved = true;
                }
            }
        }
    }

    routeStops = keepFirstStoreFixed ? [fixedStart, ...ordered] : ordered;
    lastRouteLegs = [];

    renderRouteWaypointMarkers();
    renderRoutePlannerUI();
    showToast('Порядок зупинок оптимізовано для найкоротшого шляху');

    if (canBuildRouteWithoutPrompt()) {
        buildPlannedRoute({ fitMap: true });
    }
}

async function fetchOsrmMultiRoute(waypoints, mode, signal) {
    const coordsStr = waypoints.map(pt => `${pt.lng},${pt.lat}`).join(';');
    const query = 'overview=full&geometries=geojson';

    const endpoints = mode === 'foot'
        ? [
            {
                url: `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coordsStr}?${query}`,
                estimateWalkTime: false
            },
            {
                url: `https://router.project-osrm.org/route/v1/foot/${coordsStr}?${query}`,
                estimateWalkTime: true
            }
        ]
        : [
            {
                url: `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordsStr}?${query}`,
                estimateWalkTime: false
            },
            {
                url: `https://router.project-osrm.org/route/v1/driving/${coordsStr}?${query}`,
                estimateWalkTime: false
            }
        ];

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint.url, { signal });
            if (!response.ok) continue;

            const data = await response.json();
            if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
                const route = data.routes[0];
                const distance = route.distance;
                const duration = endpoint.estimateWalkTime
                    ? distance / (5000 / 3600)
                    : route.duration;

                const legs = Array.isArray(route.legs)
                    ? route.legs.map(leg => ({
                        distance: leg.distance,
                        duration: endpoint.estimateWalkTime
                            ? leg.distance / (5000 / 3600)
                            : leg.duration
                    }))
                    : [];

                return {
                    geometry: route.geometry,
                    distance,
                    duration,
                    legs,
                    isFallback: endpoint.estimateWalkTime
                };
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                throw err;
            }
        }
    }

    throw new Error('Route service unavailable');
}

async function buildPlannedRoute({ fitMap = true } = {}) {
    if (!map) return;

    setPlannerPanelOpen(true);

    if (routeStops.length === 0) {
        removeRouteLayer();
        renderRoutePlannerUI();
        return;
    }

    if (routeStartMode === 'gps' && !userCoords) {
        if (routeSummary) {
            routeSummary.textContent = 'Визначаємо точне місцезнаходження...';
        }
        try {
            await requestUserLocation({ filterNearest: false });
        } catch (_) {
            renderRoutePlannerUI();
            return;
        }
    }

    if (routeStartMode === 'custom' && !customStartCoords) {
        setMapPickStartMode(true);
        showToast('Натисніть на карту, щоб обрати точку старту');
        renderRoutePlannerUI();
        return;
    }

    const waypoints = getEffectiveRouteWaypoints();
    if (waypoints.length < 2) {
        removeRouteLayer();
        renderRoutePlannerUI();
        return;
    }

    if (routeAbortController) {
        routeAbortController.abort();
    }
    routeAbortController = new AbortController();
    const { signal } = routeAbortController;

    if (routeSummary) {
        routeSummary.textContent = 'Прокладаємо маршрут...';
    }

    try {
        const routeData = await fetchOsrmMultiRoute(waypoints, activeRouteMode, signal);

        removeRouteLayer();

        const routeStyle = activeRouteMode === 'foot'
            ? {
                color: '#19e99b',
                weight: 5,
                opacity: 0.95,
                dashArray: '8, 10',
                lineCap: 'round'
            }
            : {
                color: '#2563eb',
                weight: 5,
                opacity: 0.9,
                lineJoin: 'round'
            };

        routeLayer = L.geoJSON(routeData.geometry, { style: routeStyle }).addTo(map);
        lastRouteLegs = routeData.legs;

        renderRouteWaypointMarkers();
        renderRoutePlannerUI();

        if (fitMap) {
            const routeBounds = routeLayer.getBounds();
            waypoints.forEach(pt => routeBounds.extend([pt.lat, pt.lng]));
            map.fitBounds(routeBounds, { padding: [50, 50] });
        }

        if (routeSummary) {
            const modeLabel = activeRouteMode === 'foot' ? 'Пішки' : 'Авто';
            const returnLeg = returnToStart && lastRouteLegs.length > routeStops.length
                ? lastRouteLegs[lastRouteLegs.length - 1]
                : (returnToStart && routeStartMode === 'first-store' && lastRouteLegs.length === routeStops.length
                    ? lastRouteLegs[lastRouteLegs.length - 1]
                    : null);
            const returnNote = returnLeg
                ? `<div class="pt-route-submeta">Повернення на старт: +${formatRouteDistance(returnLeg.distance)} · ~${formatRouteDuration(returnLeg.duration)}</div>`
                : '';
            const fallbackNote = routeData.isFallback
                ? '<div class="pt-route-note">Орієнтовний час пішки (резервний сервер маршрутизації).</div>'
                : '';

            routeSummary.innerHTML = `
                <div class="pt-route-metrics">
                    <span>${modeLabel}: ${formatRouteDistance(routeData.distance)}</span>
                    <span>~${formatRouteDuration(routeData.duration)}</span>
                </div>
                ${returnNote}
                ${fallbackNote}
            `;
        }
    } catch (err) {
        if (err.name === 'AbortError') return;

        removeRouteLayer();
        lastRouteLegs = [];
        renderRoutePlannerUI();
        if (routeSummary) {
            routeSummary.innerHTML = '<span class="pt-route-error">Не вдалося прокласти маршрут. Спробуйте ще раз.</span>';
        }
    }
}

// Швидка побудова маршруту до одного магазину (з картки або popup)
async function buildRouteToStore(store, mode = activeRouteMode, { fitMap = true } = {}) {
    if (!map || !store) return;

    activeRouteMode = mode;
    if (routeStartMode === 'first-store') {
        routeStartMode = 'gps';
    }
    routeStops = [store];
    lastRouteLegs = [];

    renderRouteWaypointMarkers();
    renderRoutePlannerUI();
    await buildPlannedRoute({ fitMap });
}

// Обробка кнопок маршруту та планування у popup маркера
if (locatorContainer) {
    locatorContainer.addEventListener('click', (e) => {
        const routeBtn = e.target.closest('.pt-popup-route-btn');
        if (routeBtn) {
            const storeId = Number(routeBtn.dataset.routeStoreId);
            const mode = routeBtn.dataset.routeMode === 'foot' ? 'foot' : 'car';
            const store = storesDB.find(item => item.id === storeId);
            if (store) {
                buildRouteToStore(store, mode);
            }
            return;
        }

        const planBtn = e.target.closest('.pt-popup-plan-btn');
        if (planBtn) {
            const storeId = Number(planBtn.dataset.planStoreId);
            const store = storesDB.find(item => item.id === storeId);
            if (store) {
                toggleStoreInRoutePlan(store);
            }
        }
    });
}

// Керування планувальником маршруту
if (togglePlannerBtn) {
    togglePlannerBtn.addEventListener('click', () => {
        const willOpen = routePanel ? routePanel.hidden : false;
        setPlannerPanelOpen(willOpen);
        if (willOpen) {
            renderRoutePlannerUI();
        }
    });
}

if (closeRouteBtn) {
    closeRouteBtn.addEventListener('click', () => {
        setPlannerPanelOpen(false);
    });
}

routeModeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode === 'foot' ? 'foot' : 'car';
        if (mode === activeRouteMode && routeLayer) return;
        activeRouteMode = mode;
        updateRouteModeButtonsUI(mode);
        updateGoogleMapsExportLink();
        saveRoutePlanState();
        if (canBuildRouteWithoutPrompt()) {
            buildPlannedRoute({ fitMap: false });
        }
    });
});

startModeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const nextMode = btn.dataset.startMode;
        if (!nextMode || nextMode === routeStartMode) return;
        routeStartMode = nextMode;
        lastRouteLegs = [];

        if (routeStartMode === 'custom') {
            if (customStartMarker && map && !map.hasLayer(customStartMarker)) {
                customStartMarker.addTo(map);
            }
            if (!customStartCoords) {
                setMapPickStartMode(true);
                showToast('Натисніть на карту, щоб вказати точку старту');
            }
        } else {
            setMapPickStartMode(false);
            removeCustomStartMarker();
        }

        renderRoutePlannerUI();
        if (canBuildRouteWithoutPrompt()) {
            buildPlannedRoute({ fitMap: true });
        } else {
            removeRouteLayer();
            renderRoutePlannerUI();
        }
    });
});

if (pickStartOnMapBtn) {
    pickStartOnMapBtn.addEventListener('click', () => {
        setMapPickStartMode(true);
        showToast('Натисніть на карту, щоб обрати нову точку старту');
    });
}

if (cancelMapPickBtn) {
    cancelMapPickBtn.addEventListener('click', () => {
        setMapPickStartMode(false);
    });
}

if (routeStopsListEl) {
    routeStopsListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-stop-action]');
        if (!btn) return;
        const action = btn.dataset.stopAction;
        const index = Number(btn.dataset.stopIndex);
        if (action === 'up') moveRouteStop(index, -1);
        else if (action === 'down') moveRouteStop(index, 1);
        else if (action === 'remove') removeRouteStopAt(index);
    });
}

if (optimizeRouteBtn) {
    optimizeRouteBtn.addEventListener('click', optimizeRouteStopsOrder);
}

if (clearRouteStopsBtn) {
    clearRouteStopsBtn.addEventListener('click', () => {
        clearRoute();
        showToast('Маршрут очищено');
    });
}

if (roundTripCheckbox) {
    roundTripCheckbox.addEventListener('change', () => {
        returnToStart = roundTripCheckbox.checked;
        lastRouteLegs = [];
        saveRoutePlanState();
        updateGoogleMapsExportLink();
        if (canBuildRouteWithoutPrompt()) {
            buildPlannedRoute({ fitMap: false });
        }
    });
}

if (buildPlannedRouteBtn) {
    buildPlannedRouteBtn.addEventListener('click', () => {
        buildPlannedRoute({ fitMap: true });
    });
}

// 10. Формула Гаверсинуса для розрахунку відстані (км)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 11. Точна геолокація з уточненням через watchPosition та ручним перетягуванням маркера
function stopGeoWatch() {
    if (geoWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = null;
    }
}

function removeUserAccuracyCircle() {
    if (userAccuracyCircle && map) {
        map.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
    }
}

function updateTopbarLocation(text) {
    if (topbarLocationText) {
        topbarLocationText.textContent = text;
    }
}

function updateUserMarkerUI(coords, accuracy = null, isManual = false) {
    if (!map) return;

    const latLng = [coords.lat, coords.lng];
    const tooltipText = isManual
        ? 'Ваша точка (вказано вручну)'
        : (typeof accuracy === 'number' && Number.isFinite(accuracy))
            ? `Ви тут (точність ~${Math.round(accuracy)} м). Перетягніть, щоб уточнити`
            : 'Ви знаходитеся тут (перетягніть, щоб уточнити)';

    if (isManual) {
        updateTopbarLocation('Вказано вручну на карті');
    } else if (typeof accuracy === 'number' && Number.isFinite(accuracy)) {
        updateTopbarLocation(`Визначено (точність ~${Math.round(accuracy)} м)`);
    } else {
        updateTopbarLocation('Геолокація активна');
    }

    updateFsLocateBtnUI();
    updateStartModeButtonsUI();
    updateGoogleMapsExportLink();

    if (!userMarker) {
        userMarker = L.marker(latLng, {
            icon: userLocationIcon,
            title: tooltipText,
            zIndexOffset: 1000,
            draggable: true
        }).addTo(map);

        userMarker.bindTooltip(tooltipText, { direction: 'top', offset: [0, -10] });

        userMarker.on('dragend', () => {
            const newPos = userMarker.getLatLng();
            userManuallyMoved = true;
            stopGeoWatch();
            userCoords = { lat: newPos.lat, lng: newPos.lng };
            userAccuracy = null;

            updateUserMarkerUI(userCoords, null, true);
            showToast('Позицію оновлено вручну');

            if (routeStartMode === 'gps' && routeStops.length > 0 && routeLayer) {
                buildPlannedRoute({ fitMap: false });
            } else if (isGeoActive) {
                applyFilters(false);
            }
        });
    } else {
        userMarker.setLatLng(latLng);
        userMarker.setTooltipContent(tooltipText);
    }

    if (!isManual && typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy > 10) {
        if (!userAccuracyCircle) {
            userAccuracyCircle = L.circle(latLng, {
                radius: accuracy,
                color: '#11baff',
                fillColor: '#11baff',
                fillOpacity: 0.14,
                weight: 1,
                interactive: false
            }).addTo(map);
        } else {
            userAccuracyCircle.setLatLng(latLng);
            userAccuracyCircle.setRadius(accuracy);
        }
    } else {
        removeUserAccuracyCircle();
    }
}

function requestUserLocation({ filterNearest = true } = {}) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            handleLocationError(null, false);
            reject(new Error('Geolocation not supported'));
            return;
        }

        stopGeoWatch();
        userManuallyMoved = false;

        if (geoBtn) {
            geoBtn.innerHTML = 'Визначаємо локацію...';
            geoBtn.disabled = true;
        }

        let settled = false;
        let refineTimer = null;
        let bestPosition = null;

        const applyInitialPosition = (position) => {
            if (settled) return;
            settled = true;
            if (refineTimer) {
                clearTimeout(refineTimer);
                refineTimer = null;
            }

            userCoords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            userAccuracy = position.coords.accuracy;
            isGeoActive = true;

            updateUserMarkerUI(userCoords, userAccuracy, false);

            if (filterNearest) {
                if (cityInput) cityInput.value = '';
                if (autocompleteList) autocompleteList.style.display = 'none';
                applyFilters(true);
            }

            if (geoBtn) {
                geoBtn.innerHTML = activeGeoBtnContent;
                geoBtn.classList.add('pt-btn-secondary');
                geoBtn.disabled = false;
            }

            resolve(userCoords);
        };

        geoWatchId = navigator.geolocation.watchPosition(
            (position) => {
                if (userManuallyMoved) return;

                const incomingCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                const incomingAccuracy = position.coords.accuracy;

                if (!settled) {
                    if (!bestPosition || incomingAccuracy <= bestPosition.coords.accuracy) {
                        bestPosition = position;
                    }

                    if (incomingAccuracy <= DESIRED_ACCURACY_METERS) {
                        applyInitialPosition(bestPosition);
                        return;
                    }

                    if (geoBtn) {
                        geoBtn.innerHTML = `Уточнюємо (~${Math.round(bestPosition.coords.accuracy)} м)...`;
                    }
                    if (!refineTimer) {
                        refineTimer = setTimeout(() => {
                            if (bestPosition) {
                                applyInitialPosition(bestPosition);
                            }
                        }, GEO_REFINE_WINDOW_MS);
                    }
                    return;
                }

                const movedKm = userCoords
                    ? calculateDistance(userCoords.lat, userCoords.lng, incomingCoords.lat, incomingCoords.lng)
                    : Infinity;
                const movedMeters = movedKm * 1000;
                const accuracyImproved = userAccuracy === null || incomingAccuracy < userAccuracy * 0.7;

                if (userAccuracy !== null && incomingAccuracy > Math.max(userAccuracy * 2, 100) && movedMeters < incomingAccuracy) {
                    return;
                }

                if (accuracyImproved || movedMeters >= 15) {
                    userCoords = incomingCoords;
                    userAccuracy = incomingAccuracy;
                    updateUserMarkerUI(userCoords, userAccuracy, false);

                    if (routeStartMode === 'gps' && routeStops.length > 0 && routeLayer && (accuracyImproved || movedMeters >= 30)) {
                        buildPlannedRoute({ fitMap: false });
                    }
                }
            },
            (err) => {
                if (!settled) {
                    if (bestPosition) {
                        applyInitialPosition(bestPosition);
                        return;
                    }
                    settled = true;
                    if (refineTimer) {
                        clearTimeout(refineTimer);
                        refineTimer = null;
                    }
                    stopGeoWatch();
                    handleLocationError(err, true);
                    reject(err);
                }
            },
            GEO_OPTIONS
        );
    });
}

// 12. Кнопка геолокації та сортування за відстанню
if (geoBtn) {
    geoBtn.addEventListener('click', () => {
        if (isGeoActive) {
            resetLocationAndFilters();
            return;
        }

        requestUserLocation({ filterNearest: true }).catch(() => {});
    });
}

if (sortDistanceBtn) {
    sortDistanceBtn.addEventListener('click', () => {
        if (!userCoords) {
            requestUserLocation({ filterNearest: true }).catch(() => {});
            return;
        }
        distanceSortAsc = !distanceSortAsc;
        sortDistanceBtn.textContent = distanceSortAsc ? 'Найближчі ↑' : 'Найдальші ↓';
        applyFilters(true);
    });
}

function resetLocationAndFilters() {
    stopGeoWatch();
    isGeoActive = false;
    userCoords = null;
    userAccuracy = null;
    userManuallyMoved = false;
    distanceSortAsc = true;

    if (cityInput) cityInput.value = '';
    if (nameInput) nameInput.value = '';
    if (topSearchInput) topSearchInput.value = '';
    if (autocompleteList) autocompleteList.style.display = 'none';
    if (sortDistanceBtn) sortDistanceBtn.textContent = 'За відстанню ↕';

    clearRoute();
    setPlannerPanelOpen(false);
    removeUserAccuracyCircle();
    updateTopbarLocation('Місцезнаходження не підключено');
    updateFsLocateBtnUI();

    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    if (map) {
        map.closePopup();
    }

    if (geoBtn) {
        geoBtn.innerHTML = defaultBtnContent;
        geoBtn.classList.remove('pt-btn-secondary');
    }

    applyFilters(false);
    map.setView(defaultCenter, defaultZoom);
}

function handleLocationError(err, browserHasGeolocation) {
    if (geoBtn) {
        geoBtn.innerHTML = defaultBtnContent;
        geoBtn.classList.remove('pt-btn-secondary');
        geoBtn.disabled = false;
    }

    if (!browserHasGeolocation) {
        showToast('Ваш браузер не підтримує геолокацію.');
        return;
    }

    if (err && err.code === err.PERMISSION_DENIED) {
        showToast('Доступ до геолокації відхилено. Дозвольте його у налаштуваннях браузера.');
    } else if (err && err.code === err.TIMEOUT) {
        showToast('Не вдалося вчасно отримати точні координати. Спробуйте ще раз.');
    } else {
        showToast('Не вдалося визначити місцезнаходження. Перевірте GPS або інтернет.');
    }
}

// 13. Пошук за назвою/адресою та синхронізація з верхнім пошуком
if (nameInput) {
    nameInput.addEventListener('input', () => {
        applyFilters(false);
    });
}

if (topSearchInput && nameInput) {
    topSearchInput.addEventListener('input', () => {
        nameInput.value = topSearchInput.value;
        applyFilters(false);
    });
}

if (clearSearchBtn && nameInput) {
    clearSearchBtn.addEventListener('click', () => {
        nameInput.value = '';
        if (topSearchInput) topSearchInput.value = '';
        applyFilters(false);
        nameInput.focus();
    });
}

// 14. Випадаючий список міст при кліку та введенні
function showCityDropdown(filterText = '') {
    if (!autocompleteList) return;
    const val = filterText.trim().toLowerCase();
    autocompleteList.innerHTML = '';

    const matchedCities = val
        ? citiesDB.filter(city => city.toLowerCase().startsWith(val))
        : citiesDB;

    if (matchedCities.length > 0) {
        autocompleteList.style.display = 'block';
        matchedCities.forEach(city => {
            const li = document.createElement('li');
            li.textContent = city;
            li.addEventListener('click', () => {
                selectCity(city);
            });
            autocompleteList.appendChild(li);
        });
    } else {
        autocompleteList.style.display = 'none';
    }
}

if (cityInput) {
    cityInput.addEventListener('focus', function () {
        showCityDropdown(this.value);
    });

    cityInput.addEventListener('input', function () {
        const val = this.value.trim();
        showCityDropdown(val);

        if (!val) {
            applyFilters(false);
        }
    });
}

document.addEventListener('click', (e) => {
    if (autocompleteList && e.target !== cityInput && e.target !== autocompleteList) {
        autocompleteList.style.display = 'none';
    }
});

// Запуск після завантаження DOM
document.addEventListener('DOMContentLoaded', initMap);