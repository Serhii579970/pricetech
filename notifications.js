// PriceTech — логіка сторінки сповіщень

// 1. Знаходимо потрібні HTML-елементи за їхніми id.
const favoritesTab = document.querySelector("#favorites-tab");
const settingsTab = document.querySelector("#settings-tab");
const favoritesPanel = document.querySelector("#favorites-panel");
const settingsPanel = document.querySelector("#settings-panel");

const chooseProductsButton = document.querySelector("#choose-products");
const modal = document.querySelector("#product-modal");
const closeModalButton = document.querySelector("#close-modal");
const saveProductsButton = document.querySelector("#save-products");
const watchedCount = document.querySelector("#watched-count");
const toast = document.querySelector("#toast");

// 2. Перемикання вкладок «Обрані товари» та «Налаштування».
function showTab(tabName) {
    const showFavorites = tabName === "favorites";

    favoritesPanel.hidden = !showFavorites;
    settingsPanel.hidden = showFavorites;

    favoritesTab.classList.toggle("active", showFavorites);
    settingsTab.classList.toggle("active", !showFavorites);

    favoritesTab.setAttribute("aria-selected", String(showFavorites));
    settingsTab.setAttribute("aria-selected", String(!showFavorites));
}

favoritesTab.addEventListener("click", () => showTab("favorites"));
settingsTab.addEventListener("click", () => showTab("settings"));

// 3. Невелике повідомлення внизу екрана (toast).
let toastTimer;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// 4. Відкриваємо та закриваємо модальне вікно вибору товарів.
function openModal() {
    modal.hidden = false;
    closeModalButton.focus();
}

function closeModal() {
    modal.hidden = true;
    chooseProductsButton.focus();
}

chooseProductsButton.addEventListener("click", openModal);
closeModalButton.addEventListener("click", closeModal);

// Клік по затемненому фону також закриває модальне вікно.
modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
});

// Клавіша Escape закриває модальне вікно.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
});

// 5. Зберігаємо вибір у localStorage — пам'яті цього браузера.
saveProductsButton.addEventListener("click", () => {
    const checkboxes = [...modal.querySelectorAll('.modal-options input[type="checkbox"]')];
    const selectedProducts = checkboxes
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.parentElement.textContent.trim());

    localStorage.setItem("pricetech-watched-products", JSON.stringify(selectedProducts));
    watchedCount.textContent = selectedProducts.length;

    closeModal();
    showToast(`Збережено товарів: ${selectedProducts.length}`);
});

// 6. Відновлюємо збережену кількість товарів після повторного відкриття сторінки.
const savedProducts = localStorage.getItem("pricetech-watched-products");

if (savedProducts) {
    try {
        const parsedProducts = JSON.parse(savedProducts);
        watchedCount.textContent = parsedProducts.length;

        const checkboxes = [...modal.querySelectorAll('.modal-options input[type="checkbox"]')];
        checkboxes.forEach(checkbox => {
            const productName = checkbox.parentElement.textContent.trim();
            checkbox.checked = parsedProducts.includes(productName);
        });
    } catch {
        // Якщо дані пошкоджені, сторінка продовжить працювати з початковим демо-списком.
        localStorage.removeItem("pricetech-watched-products");
    }
}

// 7. Пов'язуємо перемикачі налаштувань зі списком активних сповіщень.
const notificationSwitches = [...document.querySelectorAll(".switch")];
const notificationItems = [...document.querySelectorAll("[data-notification]")];

// Спочатку відновлюємо збережені налаштування з браузера.
notificationSwitches.forEach(toggle => {
    const storageKey = `pricetech-notification-${toggle.dataset.setting}`;
    const savedValue = localStorage.getItem(storageKey);

    if (savedValue !== null) {
        toggle.checked = savedValue === "true";
    }
});

// Показуємо на першій вкладці лише ті типи сповіщень, які увімкнені.
function updateActiveNotifications() {
    notificationItems.forEach(item => {
        const settingName = item.dataset.notification;
        const relatedSwitch = notificationSwitches.find(
            toggle => toggle.dataset.setting === settingName
        );

        if (!relatedSwitch) return;

        item.hidden = !relatedSwitch.checked;
    });
}

// Оновлюємо список одразу після завантаження сторінки.
updateActiveNotifications();

// Коли користувач змінює перемикач, зберігаємо значення
// та відразу оновлюємо список на вкладці «Обрані товари».
notificationSwitches.forEach(toggle => {
    toggle.addEventListener("change", () => {
        const storageKey = `pricetech-notification-${toggle.dataset.setting}`;

        localStorage.setItem(storageKey, String(toggle.checked));
        updateActiveNotifications();

        showToast(
            toggle.checked
                ? "Тип сповіщень увімкнено"
                : "Тип сповіщень вимкнено"
        );
    });
});

// 8. Поки інші розділи ще створюються, показуємо коротке демо-повідомлення.
document.querySelectorAll("[data-demo]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        showToast(link.dataset.demo);
    });
});
