// app.js

let map;
let markers = [];
let markerCluster = null;
let infoWindow;
let userMarker = null;
let userCoords = null;
let isGeoActive = false;

// Елементи DOM
const cityInput = document.getElementById('citySearch');
const nameInput = document.getElementById('nameSearch');
const autocompleteList = document.getElementById('autocompleteList');
const storesListContainer = document.getElementById('storesList');
const geoBtn = document.getElementById('geoBtn');

// Дефолтний центр (Центр України)
const defaultCenter = { lat: 48.3794, lng: 31.1656 };
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

// 1. Ініціалізація карти (прив'язана до глобального об'єкта window для Google Maps callback)
function initMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    map = new google.maps.Map(mapElement, {
        center: defaultCenter,
        zoom: defaultZoom,
        mapTypeControl: false
    });

    infoWindow = new google.maps.InfoWindow();
    applyFilters(false);
}
window.initMap = initMap;

// 2. Вибір міста зі списку
function selectCity(city) {
    cityInput.value = city;
    autocompleteList.style.display = 'none';
    applyFilters(false);

    if (!city && !nameInput.value.trim()) {
        map.setCenter(defaultCenter);
        map.setZoom(defaultZoom);
    }
}

// 3. Головна функція фільтрації
function applyFilters(onlyNearest = false) {
    if (!map) return;

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

    if (onlyNearest && userCoords) {
        result.sort((a, b) => a.distance - b.distance);
        result = result.slice(0, 10);
    }

    renderStores(result, onlyNearest);
}

// 4. Рендер магазинів у список, створення маркерів та кластерів
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

    const bounds = new google.maps.LatLngBounds();
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

        const marker = new google.maps.Marker({
            position: { lat: store.lat, lng: store.lng },
            map: map, // Додаємо одразу на карту, щоб маркери працювали навіть без кластеризатора
            title: store.name
        });

        markers.push(marker);
        bounds.extend(marker.getPosition());

        const distanceInfo = store.distance !== undefined
            ? `<p><strong>Відстань:</strong> ~${store.distance.toFixed(1)} км</p>`
            : '';

        const infoContent = `
            <div class="pt-infowindow">
                <h4>${store.name}</h4>
                <p>${store.city}, ${store.address}</p>
                ${distanceInfo}
                <a href="https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}" target="_blank">
                    Прокласти маршрут
                </a>
            </div>
        `;

        marker.addListener('click', () => {
            openStoreInfo(marker, infoContent, storeEl);
        });

        storeEl.addEventListener('click', () => {
            map.panTo(marker.getPosition());
            map.setZoom(16);
            openStoreInfo(marker, infoContent, storeEl);
        });

        storesListContainer.appendChild(storeEl);

        if (isNearest) {
            nearestData = { marker, infoContent, storeEl };
        }
    });

    // Безпечна ініціалізація кластеризатора (якщо бібліотека завантажилась)
    if (typeof markerClusterer !== 'undefined' && markerClusterer.MarkerClusterer) {
        markerCluster = new markerClusterer.MarkerClusterer({
            map: map,
            markers: markers,
            renderer: {
                render: ({ count, position }) => {
                    return new google.maps.Marker({
                        position: position,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 20,
                            fillColor: "#0056b3",
                            fillOpacity: 0.9,
                            strokeColor: "#ffffff",
                            strokeWeight: 3
                        },
                        label: {
                            text: String(count),
                            color: "#ffffff",
                            fontSize: "14px",
                            fontWeight: "bold"
                        },
                        title: `Магазинів у цій зоні: ${count}`,
                        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
                    });
                }
            }
        });
    }

    // Масштабування карти
    if (highlightNearest && nearestData && userMarker) {
        const nearestBounds = new google.maps.LatLngBounds();
        nearestBounds.extend(userMarker.getPosition());
        nearestBounds.extend(nearestData.marker.getPosition());

        map.fitBounds(nearestBounds);
        openStoreInfo(nearestData.marker, nearestData.infoContent, nearestData.storeEl);
    } else if (storesToRender.length > 1) {
        map.fitBounds(bounds);
    } else if (storesToRender.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(14);
    }
}

// 5. Відкриття InfoWindow та підсвітка елемента списку
function openStoreInfo(marker, content, listItem) {
    infoWindow.setContent(content);
    infoWindow.open(map, marker);

    document.querySelectorAll('.pt-store-item').forEach(el => el.classList.remove('active'));
    if (listItem) {
        listItem.classList.add('active');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// 6. Очищення маркерів та кластерів
function clearMarkers() {
    if (markerCluster) {
        markerCluster.clearMarkers();
        markerCluster = null;
    }
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

// 7. Формула Гаверсинуса для розрахунку відстані (км)
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

// 8. Об'єднана кнопка: "Моє місцезнаходження" (Топ-10) / "Скинути"
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

                if (userMarker) userMarker.setMap(null);

                userMarker = new google.maps.Marker({
                    position: userCoords,
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#4285F4",
                        fillOpacity: 1,
                        strokeColor: "white",
                        strokeWeight: 2,
                    },
                    title: "Ви знаходитеся тут"
                });

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
        userMarker.setMap(null);
        userMarker = null;
    }
    if (infoWindow) infoWindow.close();

    geoBtn.innerHTML = defaultBtnContent;
    geoBtn.classList.remove('pt-btn-secondary');

    applyFilters(false);
    map.setCenter(defaultCenter);
    map.setZoom(defaultZoom);
}

function handleLocationError(browserHasGeolocation) {
    geoBtn.innerHTML = defaultBtnContent;
    geoBtn.classList.remove('pt-btn-secondary');
    geoBtn.disabled = false;
    alert(browserHasGeolocation
        ? "Помилка: Доступ до геолокації відхилено. Дозвольте доступ у налаштуваннях браузера."
        : "Помилка: Ваш браузер не підтримує геолокацію.");
}

// 9. Пошук за назвою магазину
nameInput.addEventListener('input', () => {
    applyFilters(false);
});

// 10. Випадаючий список міст при кліку та введенні
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