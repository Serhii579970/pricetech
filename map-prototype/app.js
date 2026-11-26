// app.js (Leaflet)

let map;
let markerCluster = null;
let userMarker = null;
let userCoords = null;
let isGeoActive = false;

// Елементи DOM
const cityInput = document.getElementById('citySearch');
const nameInput = document.getElementById('nameSearch');
const autocompleteList = document.getElementById('autocompleteList');
const storesListContainer = document.getElementById('storesList');
const geoBtn = document.getElementById('geoBtn');
const locatorContainer = document.getElementById('pricetechLocator');
const fullscreenBtn = document.getElementById('fullscreenBtn');

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
            ? `<p><strong>Відстань:</strong> ~${store.distance.toFixed(1)} км</p>`
            : '';

        const infoContent = `
            <div class="pt-infowindow">
                <h4>${store.name}</h4>
                <p>${store.city}, ${store.address}</p>
                ${distanceInfo}
                <a href="https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}" target="_blank" rel="noopener noreferrer">
                    Прокласти маршрут
                </a>
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

// 8. Формула Гаверсинуса для розрахунку відстані (км)
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

// 9. Об'єднана кнопка: "Моє місцезнаходження" (Топ-10) / "Скинути"
geoBtn.addEventListener('click', () => {
    if (isGeoActive) {
        resetLocationAndFilters();
        return;
    }

    if (navigator.geolocation) {
        geoBtn.innerHTML = 'Визначаємо локацію...';
        geoBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                isGeoActive = true;

                cityInput.value = '';
                autocompleteList.style.display = 'none';

                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                userMarker = L.marker([userCoords.lat, userCoords.lng], {
                    icon: userLocationIcon,
                    title: 'Ви знаходитеся тут',
                    zIndexOffset: 1000
                }).addTo(map);

                applyFilters(true);

                geoBtn.innerHTML = activeGeoBtnContent;
                geoBtn.classList.add('pt-btn-secondary');
                geoBtn.disabled = false;
            },
            () => {
                handleLocationError(true);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        handleLocationError(false);
    }
});

function resetLocationAndFilters() {
    isGeoActive = false;
    userCoords = null;
    cityInput.value = '';
    nameInput.value = '';
    autocompleteList.style.display = 'none';

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

function handleLocationError(browserHasGeolocation) {
    geoBtn.innerHTML = defaultBtnContent;
    geoBtn.classList.remove('pt-btn-secondary');
    geoBtn.disabled = false;
    alert(browserHasGeolocation
        ? 'Помилка: Доступ до геолокації відхилено. Дозвольте доступ у налаштуваннях браузера.'
        : 'Помилка: Ваш браузер не підтримує геолокацію.');
}

// 10. Пошук за назвою магазину
nameInput.addEventListener('input', () => {
    applyFilters(false);
});

// 11. Випадаючий список міст при кліку та введенні
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