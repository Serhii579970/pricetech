// app.js (Leaflet)

let map;
let markerCluster = null;
let userMarker = null;
let userAccuracyCircle = null;
let userCoords = null;
let userAccuracy = null;
let isGeoActive = false;
let geoWatchId = null;
let userManuallyMoved = false;

// Стан маршруту
let routeLayer = null;
let activeRouteStore = null;
let activeRouteMode = 'car'; // 'car' | 'foot'
let routeAbortController = null;

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
const autocompleteList = document.getElementById('autocompleteList');
const storesListContainer = document.getElementById('storesList');
const geoBtn = document.getElementById('geoBtn');
const locatorContainer = document.getElementById('pricetechLocator');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const routePanel = document.getElementById('routePanel');
const routeStoreName = document.getElementById('routeStoreName');
const routeStoreAddress = document.getElementById('routeStoreAddress');
const routeSummary = document.getElementById('routeSummary');
const closeRouteBtn = document.getElementById('closeRouteBtn');
const routeModeButtons = document.querySelectorAll('.pt-route-mode-btn');

// Дефолтний центр (Центр України)
const defaultCenter = [48.3794, 31.1656];
const defaultZoom = 6;

const defaultBtnContent = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2L22 22L12 18L2 22L12 2Z"></path>
    </svg>
    Моє місцезнаходження
`;

const activeGeoBtnContent = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
    </svg>
    Скинути геолокацію
`;

const enterFullscreenIcon = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
    </svg>
`;

const exitFullscreenIcon = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    html: '<div style="width:16px;height:16px;background:#4285F4;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

// 1. Ініціалізація карти
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || typeof L === 'undefined') return;

    map = L.map('map').setView(defaultCenter, defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    applyFilters(false);
}

// 2. Повноекранний режим з усіма елементами керування та списком
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

    fullscreenBtn.innerHTML = isFull ? exitFullscreenIcon : enterFullscreenIcon;
    fullscreenBtn.title = isFull ? 'Вийти з повного екрана' : 'На весь екран';
    fullscreenBtn.setAttribute('aria-label', fullscreenBtn.title);

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
                // Ігноруємо помилку виходу, прибираємо fallback нижче
            }
        }
        applyFullscreenUI(false);
    }
}

if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleMapFullscreen);
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
    cityInput.value = city;
    autocompleteList.style.display = 'none';
    applyFilters(false);

    if (!city && !nameInput.value.trim()) {
        map.setView(defaultCenter, defaultZoom);
    }
}

// 4. Головна функція фільтрації
function applyFilters(forceNearest = false) {
    if (!map) return;

    const nearestMode = Boolean(userCoords && (isGeoActive || forceNearest));
    const cityFilter = cityInput.value.trim().toLowerCase();
    const nameFilter = nameInput.value.trim().toLowerCase();

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
        result = result.filter(store => store.name.toLowerCase().includes(nameFilter));
    }

    if (nearestMode) {
        result.sort((a, b) => a.distance - b.distance);
        result = result.slice(0, 10);
    }

    renderStores(result, nearestMode);
}

// 5. Рендер магазинів у список, створення маркерів та кластерів
function renderStores(storesToRender, highlightNearest = false) {
    storesListContainer.innerHTML = '';
    clearMarkers();

    if (storesToRender.length === 0) {
        storesListContainer.innerHTML = '<div class="pt-no-results">За вашим запитом магазинів не знайдено.</div>';
        return;
    }

    const counterEl = document.createElement('div');
    counterEl.className = 'pt-results-counter';
    counterEl.textContent = highlightNearest
        ? `Показано найближчих магазинів: ${storesToRender.length} (макс. 10)`
        : `Знайдено магазинів: ${storesToRender.length}`;
    storesListContainer.appendChild(counterEl);

    const useCluster = typeof L.markerClusterGroup === 'function';
    const clusterLayer = useCluster
        ? L.markerClusterGroup({
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div style="width:40px;height:40px;line-height:40px;text-align:center;background:rgba(0,86,179,0.9);color:#ffffff;border:3px solid #ffffff;border-radius:50%;font-size:14px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${count}</div>`,
                    className: 'pt-cluster-icon',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });
            }
        })
        : L.layerGroup();

    const bounds = L.latLngBounds();
    let nearestData = null;

    storesToRender.forEach((store, index) => {
        const storeEl = document.createElement('div');
        storeEl.className = 'pt-store-item';

        const isNearest = highlightNearest && index === 0;
        const nearestBadge = isNearest ? `<span class="pt-nearest-label">Найближчий до вас</span>` : '';
        const distanceBadge = store.distance !== undefined
            ? `<span class="pt-distance-badge">~${store.distance.toFixed(1)} км</span>`
            : '';

        storeEl.innerHTML = `
            ${nearestBadge}
            <div class="pt-store-header">
                <h3>${store.name}</h3>
                ${distanceBadge}
            </div>
            <p><strong>Місто:</strong> ${store.city}</p>
            <p><strong>Адреса:</strong> ${store.address}</p>
        `;

        const latLng = [store.lat, store.lng];
        const marker = L.marker(latLng, { title: store.name });

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
        bounds.extend(latLng);

        marker.on('click', () => {
            highlightListItem(storeEl);
        });

        storeEl.addEventListener('click', () => {
            map.setView(latLng, 16, { animate: true });
            if (useCluster && clusterLayer.zoomToShowLayer) {
                clusterLayer.zoomToShowLayer(marker, () => {
                    marker.openPopup();
                });
            } else {
                marker.openPopup();
            }
            highlightListItem(storeEl);
        });

        storesListContainer.appendChild(storeEl);

        if (isNearest) {
            nearestData = { marker, storeEl };
        }
    });

    markerCluster = clusterLayer;
    map.addLayer(markerCluster);

    // Масштабування карти
    if (highlightNearest && nearestData && userMarker) {
        const nearestBounds = L.latLngBounds([
            userMarker.getLatLng(),
            nearestData.marker.getLatLng()
        ]);

        map.fitBounds(nearestBounds, { padding: [40, 40], maxZoom: 15 });

        if (useCluster && clusterLayer.zoomToShowLayer) {
            clusterLayer.zoomToShowLayer(nearestData.marker, () => {
                nearestData.marker.openPopup();
            });
        } else {
            nearestData.marker.openPopup();
        }
        highlightListItem(nearestData.storeEl);
    } else if (storesToRender.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
    } else if (storesToRender.length === 1) {
        map.setView(bounds.getCenter(), 14);
    }
}

// 6. Підсвітка активного елемента списку
function highlightListItem(listItem) {
    document.querySelectorAll('.pt-store-item').forEach(el => el.classList.remove('active'));
    if (listItem) {
        listItem.classList.add('active');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 7. Очищення маркерів та кластерів
function clearMarkers() {
    if (markerCluster) {
        if (typeof markerCluster.clearLayers === 'function') {
            markerCluster.clearLayers();
        }
        map.removeLayer(markerCluster);
        markerCluster = null;
    }
}

// 8. Побудова маршруту на карті (Авто / Пішки) через OSRM
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
                // Публічний router.project-osrm.org може повертати авто-час для профілю foot
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
                color: '#16a34a',
                weight: 5,
                opacity: 0.9,
                dashArray: '8, 10',
                lineCap: 'round'
            }
            : {
                color: '#0056b3',
                weight: 5,
                opacity: 0.85,
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

// 9. Формула Гаверсинуса для розрахунку відстані (км)
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

// 10. Точна геолокація з уточненням через watchPosition та можливістю ручного коригування маркера
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

function updateUserMarkerUI(coords, accuracy = null, isManual = false) {
    if (!map) return;

    const latLng = [coords.lat, coords.lng];
    const tooltipText = isManual
        ? 'Ваша точка (вказано вручну)'
        : (typeof accuracy === 'number' && Number.isFinite(accuracy))
            ? `Ви тут (точність ~${Math.round(accuracy)} м). Перетягніть, щоб уточнити`
            : 'Ви знаходитеся тут (перетягніть, щоб уточнити)';

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
                color: '#4285F4',
                fillColor: '#4285F4',
                fillOpacity: 0.12,
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

        geoBtn.innerHTML = 'Визначаємо точну локацію...';
        geoBtn.disabled = true;

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
                cityInput.value = '';
                autocompleteList.style.display = 'none';
                applyFilters(true);
            }

            geoBtn.innerHTML = activeGeoBtnContent;
            geoBtn.classList.add('pt-btn-secondary');
            geoBtn.disabled = false;

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

                    // Якщо одразу отримано високу точність (<= 30 м) — застосовуємо негайно
                    if (incomingAccuracy <= DESIRED_ACCURACY_METERS) {
                        applyInitialPosition(bestPosition);
                        return;
                    }

                    // Інакше чекаємо кілька секунд на уточнення GPS-сигналу
                    geoBtn.innerHTML = `Уточнюємо локацію (~${Math.round(bestPosition.coords.accuracy)} м)...`;
                    if (!refineTimer) {
                        refineTimer = setTimeout(() => {
                            if (bestPosition) {
                                applyInitialPosition(bestPosition);
                            }
                        }, GEO_REFINE_WINDOW_MS);
                    }
                    return;
                }

                // Подальше фонове уточнення позиції після первинного визначення
                const movedKm = userCoords
                    ? calculateDistance(userCoords.lat, userCoords.lng, incomingCoords.lat, incomingCoords.lng)
                    : Infinity;
                const movedMeters = movedKm * 1000;
                const accuracyImproved = userAccuracy === null || incomingAccuracy < userAccuracy * 0.7;

                // Ігноруємо помітно гірші стрибки координат
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

// 11. Об'єднана кнопка: "Моє місцезнаходження" (Топ-10) / "Скинути"
geoBtn.addEventListener('click', () => {
    if (isGeoActive) {
        resetLocationAndFilters();
        return;
    }

    requestUserLocation({ filterNearest: true }).catch(() => {
        // Помилку вже оброблено у handleLocationError
    });
});

function resetLocationAndFilters() {
    stopGeoWatch();
    isGeoActive = false;
    userCoords = null;
    userAccuracy = null;
    userManuallyMoved = false;
    cityInput.value = '';
    nameInput.value = '';
    autocompleteList.style.display = 'none';

    clearRoute();
    removeUserAccuracyCircle();

    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    if (map) {
        map.closePopup();
    }

    geoBtn.innerHTML = defaultBtnContent;
    geoBtn.classList.remove('pt-btn-secondary');

    applyFilters(false);
    map.setView(defaultCenter, defaultZoom);
}

function handleLocationError(err, browserHasGeolocation) {
    geoBtn.innerHTML = defaultBtnContent;
    geoBtn.classList.remove('pt-btn-secondary');
    geoBtn.disabled = false;

    if (!browserHasGeolocation) {
        alert('Помилка: Ваш браузер не підтримує геолокацію.');
        return;
    }

    if (err && err.code === err.PERMISSION_DENIED) {
        alert('Помилка: Доступ до геолокації відхилено. Дозвольте доступ у налаштуваннях браузера.');
    } else if (err && err.code === err.TIMEOUT) {
        alert('Помилка: Не вдалося вчасно отримати точні координати. Перевірте GPS/інтернет та спробуйте ще раз.');
    } else {
        alert('Помилка: Не вдалося визначити ваше місцезнаходження. Перевірте служби геолокації на пристрої.');
    }
}

// 12. Пошук за назвою магазину
nameInput.addEventListener('input', () => {
    applyFilters(false);
});

// 13. Випадаючий список міст при кліку та введенні
function showCityDropdown(filterText = '') {
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

document.addEventListener('click', (e) => {
    if (e.target !== cityInput && e.target !== autocompleteList) {
        autocompleteList.style.display = 'none';
    }
});

// Запуск після завантаження DOM
document.addEventListener('DOMContentLoaded', initMap);