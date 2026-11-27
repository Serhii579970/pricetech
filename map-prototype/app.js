// app.js (Leaflet + PriceTech UI)

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

// Стан маршруту
let routeLayer = null;
let activeRouteStore = null;
let activeRouteMode = 'car'; // 'car' | 'foot'
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

// Елементи панелі маршруту
const routePanel = document.getElementById('routePanel');
const routeStoreName = document.getElementById('routeStoreName');
const routeStoreAddress = document.getElementById('routeStoreAddress');
const routeSummary = document.getElementById('routeSummary');
const closeRouteBtn = document.getElementById('closeRouteBtn');
const routeModeButtons = document.querySelectorAll('.pt-route-mode-btn');

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
    updateZoomBadge();
    updateFsLocateBtnUI();

    applyFilters(false);
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
    if (e.key === 'Escape' && locatorContainer && locatorContainer.classList.contains('is-fullscreen') && !getNativeFullscreenElement()) {
        applyFullscreenUI(false);
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
function createStoreCardElement(store, isNearest) {
    const brand = getStoreBrandMeta(store.name);
    const card = document.createElement('article');
    card.className = 'store-card';
    card.dataset.storeId = String(store.id);

    const nearestBadge = isNearest ? '<span class="pt-nearest-label">Найближчий</span>' : '';
    const distanceHtml = store.distance !== undefined
        ? `<span>● ~${store.distance.toFixed(1)} км від вас</span>`
        : `<span>● ${store.city}</span>`;

    card.innerHTML = `
        <div class="store-logo ${brand.cls}">${brand.label}</div>
        <div class="store-details">
            <h3>${store.name} ${nearestBadge}</h3>
            <p>${store.city}, ${store.address}</p>
            ${distanceHtml}
            <button type="button" class="route-button" data-card-route-id="${store.id}">Прокласти маршрут →</button>
        </div>
    `;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.route-button')) {
            e.stopPropagation();
            selectStoreOnMap(store, card, false);
            buildRouteToStore(store, activeRouteMode);
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

        const infoContent = `
            <div class="pt-infowindow">
                <h4>${store.name}</h4>
                <p>${store.city}, ${store.address}</p>
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

// 9. Побудова маршруту на карті (Авто / Пішки) через OSRM
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

function updateRouteModeButtonsUI(mode) {
    routeModeButtons.forEach(btn => {
        const isCurrent = btn.dataset.mode === mode;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-pressed', String(isCurrent));
    });
}

function removeRouteLayer() {
    if (routeLayer && map) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
}

function clearRoute() {
    if (routeAbortController) {
        routeAbortController.abort();
        routeAbortController = null;
    }
    removeRouteLayer();
    activeRouteStore = null;
    if (routePanel) {
        routePanel.hidden = true;
    }
}

async function fetchOsrmRoute(fromCoords, toStore, mode, signal) {
    const coordsStr = `${fromCoords.lng},${fromCoords.lat};${toStore.lng},${toStore.lat}`;
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

                return {
                    geometry: route.geometry,
                    distance,
                    duration,
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

async function buildRouteToStore(store, mode = activeRouteMode, { fitMap = true } = {}) {
    if (!map || !store) return;

    activeRouteStore = store;
    activeRouteMode = mode;

    if (routePanel) {
        routeStoreName.textContent = store.name;
        routeStoreAddress.textContent = `${store.city}, ${store.address}`;
        updateRouteModeButtonsUI(mode);
        routeSummary.innerHTML = userCoords
            ? 'Прокладаємо маршрут...'
            : 'Визначаємо точне місцезнаходження...';
        routePanel.hidden = false;
    }

    if (!userCoords) {
        try {
            await requestUserLocation({ filterNearest: false });
        } catch (_) {
            clearRoute();
            return;
        }
    }

    if (routeAbortController) {
        routeAbortController.abort();
    }
    routeAbortController = new AbortController();
    const { signal } = routeAbortController;

    if (routeSummary) {
        routeSummary.innerHTML = 'Прокладаємо маршрут...';
    }

    try {
        const routeData = await fetchOsrmRoute(userCoords, store, mode, signal);

        removeRouteLayer();

        const routeStyle = mode === 'foot'
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

        if (fitMap) {
            const routeBounds = routeLayer.getBounds();
            routeBounds.extend([userCoords.lat, userCoords.lng]);
            routeBounds.extend([store.lat, store.lng]);
            map.fitBounds(routeBounds, { padding: [50, 50] });
        }

        if (routeSummary) {
            const modeLabel = mode === 'foot' ? 'Пішки' : 'Авто';
            const fallbackNote = routeData.isFallback
                ? '<div class="pt-route-note">Орієнтовний час пішки (резервний сервер маршрутизації).</div>'
                : '';

            routeSummary.innerHTML = `
                <div class="pt-route-metrics">
                    <span>${modeLabel}: ${formatRouteDistance(routeData.distance)}</span>
                    <span>~${formatRouteDuration(routeData.duration)}</span>
                </div>
                ${fallbackNote}
            `;
        }
    } catch (err) {
        if (err.name === 'AbortError') return;

        removeRouteLayer();
        if (routeSummary) {
            routeSummary.innerHTML = '<span class="pt-route-error">Не вдалося прокласти маршрут. Спробуйте ще раз.</span>';
        }
    }
}

// Обробка кнопок маршруту у popup маркера
if (locatorContainer) {
    locatorContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.pt-popup-route-btn');
        if (!btn) return;

        const storeId = Number(btn.dataset.routeStoreId);
        const mode = btn.dataset.routeMode === 'foot' ? 'foot' : 'car';
        const store = storesDB.find(item => item.id === storeId);

        if (store) {
            buildRouteToStore(store, mode);
        }
    });
}

// Перемикач Авто / Пішки у панелі маршруту
routeModeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode === 'foot' ? 'foot' : 'car';
        if (activeRouteStore && (mode !== activeRouteMode || !routeLayer)) {
            buildRouteToStore(activeRouteStore, mode);
        }
    });
});

if (closeRouteBtn) {
    closeRouteBtn.addEventListener('click', clearRoute);
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

            if (activeRouteStore) {
                buildRouteToStore(activeRouteStore, activeRouteMode, { fitMap: false });
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

                    if (activeRouteStore && (accuracyImproved || movedMeters >= 30)) {
                        buildRouteToStore(activeRouteStore, activeRouteMode, { fitMap: false });
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