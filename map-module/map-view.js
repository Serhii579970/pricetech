// Єдиний файл, який знає про картографічну бібліотеку (Leaflet + OpenStreetMap).
// Якщо інший розробник зробить власну карту, достатньо повернути об'єкт з такими самими методами:
// showStores, select, showUser, showRoute, clearRoute, fit, zoomIn, zoomOut.
import { CHAINS } from "./geo.js";

const UKRAINE = [48.38, 31.17];

export function createMapView(container, { onSelect }) {
    const L = window.L;
    if (!L) throw new Error("Leaflet не завантажився");

    // Canvas потрібен, щоб понад 1600 точок не гальмували сторінку.
    const map = L.map(container, { zoomControl: false, preferCanvas: true }).setView(UKRAINE, 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const storeLayer = L.layerGroup().addTo(map);
    const markers = new Map();
    let selected = null;
    let userMarker = null;
    let routeLine = null;

    const style = (chain, active) => ({
        radius: active ? 11 : 6,
        weight: active ? 4 : 1.5,
        color: active ? "#18e99b" : "#ffffff",
        fillColor: CHAINS[chain].color,
        fillOpacity: 0.95
    });

    function popupContent(store) {
        const box = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = store.name;
        const address = document.createElement("div");
        address.textContent = `${store.city}, ${store.address}`;
        box.append(title, address);
        return box;
    }

    return {
        showStores(stores) {
            storeLayer.clearLayers();
            markers.clear();
            selected = null;
            stores.forEach(store => {
                const marker = L.circleMarker([store.lat, store.lng], style(store.chain, false))
                    .bindPopup(popupContent(store))
                    .on("click", () => onSelect(store.id))
                    .addTo(storeLayer);
                markers.set(store.id, { marker, chain: store.chain });
            });
        },
        select(id, { focus = false } = {}) {
            const previous = markers.get(selected);
            previous?.marker.setStyle(style(previous.chain, false)).setRadius(6);
            const current = markers.get(id);
            selected = current ? id : null;
            if (!current) return;
            current.marker.setStyle(style(current.chain, true)).setRadius(11);
            current.marker.bringToFront();
            if (focus) {
                map.setView(current.marker.getLatLng(), Math.max(map.getZoom(), 15));
                current.marker.openPopup();
            }
        },
        showUser(point) {
            userMarker?.remove();
            userMarker = L.circleMarker([point.lat, point.lng], {
                radius: 9, weight: 3, color: "#ffffff", fillColor: "#11baff", fillOpacity: 1
            }).bindTooltip("Ви тут").addTo(map);
        },
        showRoute(points) {
            this.clearRoute();
            routeLine = L.polyline(points, { color: "#0a8f62", weight: 5, opacity: 0.9 }).addTo(map);
            map.closePopup();
            map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
        },
        clearRoute() {
            routeLine?.remove();
            routeLine = null;
        },
        fit(points) {
            if (!points.length) return;
            map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [45, 45], maxZoom: 15 });
        },
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut()
    };
}
