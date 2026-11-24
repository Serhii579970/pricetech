// PriceTech — демонстраційна логіка сторінки карти.
// Тут поки немає справжніх координат або підключеної картографічної бібліотеки.

const storeSearch = document.querySelector("#nameSearch");
const clearSearch = document.querySelector("#clear-search");
const storeCards = [...document.querySelectorAll(".store-card")];
const mapMarkers = [...document.querySelectorAll(".map-marker")];
const visibleCount = document.querySelector("#visible-count");
const noStores = document.querySelector("#no-stores");
const selectedInfo = document.querySelector("#selected-store-info");
const mapArt = document.querySelector("#map-art");
const toast = document.querySelector("#toast");

let zoom = 1;
let sortAscending = true;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function selectStore(storeName) {
    storeCards.forEach(card => {
        card.classList.toggle("selected", card.dataset.storeCard === storeName);
    });

    mapMarkers.forEach(marker => {
        marker.classList.toggle("selected", marker.dataset.store === storeName);
    });

    const card = storeCards.find(item => item.dataset.storeCard === storeName);
    if (card) {
        const title = card.querySelector("h3").textContent;
        const distance = card.querySelector(".store-details > span").textContent.replace("● ", "");
        selectedInfo.innerHTML = `
            <span class="info-icon">⌖</span>
            <div>
                <strong>Обрано: ${title}</strong>
                <small>${distance}. Натисніть на інший магазин, щоб змінити вибір.</small>
            </div>
        `;
    }
}

function filterStores() {
    const query = storeSearch.value.trim().toLocaleLowerCase("uk-UA");
    let count = 0;

    storeCards.forEach(card => {
        const matches = card.textContent.toLocaleLowerCase("uk-UA").includes(query);
        card.hidden = !matches;
        count += matches ? 1 : 0;
    });

    mapMarkers.forEach(marker => {
        const matches = marker.dataset.store.toLocaleLowerCase("uk-UA").includes(query);
        marker.hidden = !matches;
    });

    visibleCount.textContent = count;
    noStores.hidden = count !== 0;

    if (count > 0) {
        const firstVisible = storeCards.find(card => !card.hidden);
        selectStore(firstVisible.dataset.storeCard);
    } else {
        selectedInfo.innerHTML = `<span class="info-icon">⌖</span><div><strong>Нічого не обрано</strong><small>Змініть пошуковий запит.</small></div>`;
    }
}

storeSearch.addEventListener("input", filterStores);
clearSearch.addEventListener("click", () => {
    storeSearch.value = "";
    filterStores();
    storeSearch.focus();
});

storeCards.forEach(card => {
    card.addEventListener("click", event => {
        if (event.target.closest(".route-button")) return;
        selectStore(card.dataset.storeCard);
    });
});

mapMarkers.forEach(marker => {
    marker.addEventListener("click", () => {
        const name = marker.dataset.store;
        const card = storeCards.find(item => item.dataset.storeCard === name);
        if (card && !card.hidden) {
            selectStore(name);
            card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    });
});

document.querySelectorAll(".route-button").forEach(button => {
    button.addEventListener("click", () => {
        showToast(`Маршрут до магазину «${button.dataset.route}» підключать розробники.`);
    });
});

document.querySelector("#zoom-in").addEventListener("click", () => {
    zoom = Math.min(zoom + 0.12, 1.6);
    mapArt.style.transform = `scale(${zoom})`;
});

document.querySelector("#zoom-out").addEventListener("click", () => {
    zoom = Math.max(zoom - 0.12, 0.85);
    mapArt.style.transform = `scale(${zoom})`;
});

document.querySelector("#location-button").addEventListener("click", () => {
    showToast("Визначення вашого місцезнаходження підключать на наступному етапі.");
});

document.querySelector("#sort-distance").addEventListener("click", () => {
    const list = document.querySelector("#store-list");
    const visible = storeCards.filter(card => !card.hidden);
    const sorted = sortAscending ? [...visible] : [...visible].reverse();
    sorted.forEach(card => list.appendChild(card));
    sortAscending = !sortAscending;
    document.querySelector("#sort-distance").textContent = sortAscending ? "За відстанню ↑" : "За відстанню ↓";
});

document.querySelectorAll("[data-demo]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        showToast(link.dataset.demo);
    });
});

document.querySelector(".icon-button").addEventListener("click", event => {
    showToast(event.currentTarget.dataset.demo);
});

document.querySelector("#top-search").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        window.location.href = "search.html";
    }
});

console.log("PriceTech Map: демонстраційна сторінка завантажена.");
