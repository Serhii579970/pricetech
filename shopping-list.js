import { supabase } from "./supabase.js";

// PriceTech — гостьовий та авторизований список покупок.
// Гостьові дані зберігаються лише в пам'яті поточної вкладки.
// Дані авторизованих користувачів зберігаються в Supabase.

const listPanel = document.querySelector(".list-panel");
const itemsContainer = document.querySelector("#shopping-items");
const countElement = document.querySelector("#items-count");
const emptyState = document.querySelector("#empty-state");
const addForm = document.querySelector("#add-item-form");
const nameInput = document.querySelector("#new-item-name");
const quantityInput = document.querySelector("#new-item-quantity");
const toast = document.querySelector("#toast");
const editButton = document.querySelector("#edit-list");
const clearButton = document.querySelector("#clear-list");
const storageStatus = document.querySelector("#storage-status");
const guestNotice = document.querySelector("#guest-notice");
const storageWarning = document.querySelector("#storage-warning");
const accountLink = document.querySelector("#account-link");

let currentUser = null;
let shoppingItems = [];
let selectedOption = "one";
let toastTimer = null;
let storageReady = true;
let isEditing = false;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function setEditing(value) {
    isEditing = value;
    listPanel.classList.toggle("editing", isEditing);
    addForm.classList.toggle("visible", isEditing);
    editButton.textContent = isEditing ? "Готово" : "Редагувати";
    editButton.setAttribute("aria-expanded", String(isEditing));

    if (isEditing) nameInput.focus();
}

function updateAccountUI() {
    if (currentUser) {
        const fullName = currentUser.user_metadata?.full_name || "Користувач";
        const initial = fullName.trim().charAt(0).toLocaleUpperCase("uk-UA") || "К";

        accountLink.href = "profile.html";
        const avatarUrl = currentUser.user_metadata?.avatar_url || "";
        accountLink.textContent = avatarUrl ? "" : initial;
        accountLink.className = avatarUrl ? "avatar has-avatar" : "avatar";
        accountLink.style.backgroundImage = avatarUrl ? `url("${avatarUrl.replaceAll('"', '%22')}")` : "";
        accountLink.setAttribute("aria-label", "Відкрити профіль");
        accountLink.title = "Мій профіль";

        guestNotice.hidden = true;
        storageStatus.textContent = "Список зберігається у твоєму акаунті";
    } else {
        accountLink.href = "login.html";
        accountLink.textContent = "Увійти";
        accountLink.className = "account-link";
        accountLink.style.backgroundImage = "";
        accountLink.setAttribute("aria-label", "Увійти до акаунта");
        accountLink.removeAttribute("title");

        guestNotice.hidden = false;
        storageStatus.textContent = "Гостьовий список — тимчасовий";
    }
}

function renderItems() {
    itemsContainer.replaceChildren();
    emptyState.hidden = shoppingItems.length > 0;
    countElement.textContent = String(shoppingItems.length);

    shoppingItems.forEach((item) => {
        const row = document.createElement("li");
        row.className = "shopping-item";
        row.dataset.id = String(item.id);

        const emoji = document.createElement("span");
        emoji.className = "product-emoji";
        emoji.textContent = item.emoji || "🛍️";
        emoji.setAttribute("aria-hidden", "true");

        const title = document.createElement("span");
        title.className = "item-name";
        title.append(document.createTextNode(item.name));

        const quantity = document.createElement("small");
        quantity.textContent = ` (${item.quantity || "1 шт."})`;
        title.appendChild(quantity);

        const removeButton = document.createElement("button");
        removeButton.className = "remove-item";
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `Видалити ${item.name}`);
        removeButton.addEventListener("click", () => removeItem(item.id));

        row.append(emoji, title, removeButton);
        itemsContainer.appendChild(row);
    });

    clearButton.disabled = shoppingItems.length === 0 || !storageReady;
}

function setListControlsEnabled(enabled) {
    editButton.disabled = !enabled;
    clearButton.disabled = !enabled || shoppingItems.length === 0;
    nameInput.disabled = !enabled;
    quantityInput.disabled = !enabled;
    addForm.querySelector('button[type="submit"]').disabled = !enabled;
}

async function loadUserItems() {
    const { data, error } = await supabase
        .from("shopping_items")
        .select("id, name, quantity, emoji")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: true });

    if (error) throw error;

    shoppingItems = data || [];
    renderItems();
}

async function addItem(event) {
    event.preventDefault();

    if (!storageReady) {
        showToast("Збереження списку поки недоступне. Перевір налаштування Supabase.");
        return;
    }

    const name = nameInput.value.trim();
    const quantity = quantityInput.value.trim() || "1 шт.";

    if (!name) {
        showToast("Введи назву товару.");
        nameInput.focus();
        return;
    }

    const newItem = {
        name,
        quantity,
        emoji: "🛍️"
    };

    const submitButton = addForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
        if (currentUser) {
            const { data, error } = await supabase
                .from("shopping_items")
                .insert({
                    user_id: currentUser.id,
                    ...newItem
                })
                .select("id, name, quantity, emoji")
                .single();

            if (error) throw error;
            shoppingItems.push(data);
            showToast("Товар додано та збережено в акаунті.");
        } else {
            // Без localStorage/sessionStorage: дані гостя зникнуть після перезавантаження.
            shoppingItems.push({ id: `guest-${Date.now()}-${Math.random()}`, ...newItem });
            showToast("Товар додано тимчасово. Після оновлення сторінки список очиститься.");
        }

        renderItems();
        addForm.reset();
        nameInput.focus();
    } catch (error) {
        showToast(`Не вдалося додати товар: ${error.message}`);
    } finally {
        submitButton.disabled = false;
    }
}

async function removeItem(itemId) {
    if (!storageReady) return;

    const removeButton = [...itemsContainer.querySelectorAll(".shopping-item")]
        .find((row) => row.dataset.id === String(itemId))
        ?.querySelector(".remove-item");

    if (removeButton) removeButton.disabled = true;

    try {
        if (currentUser) {
            const { error } = await supabase
                .from("shopping_items")
                .delete()
                .eq("id", itemId)
                .eq("user_id", currentUser.id);

            if (error) throw error;
        }

        shoppingItems = shoppingItems.filter((item) => String(item.id) !== String(itemId));
        renderItems();
        showToast("Товар видалено зі списку.");
    } catch (error) {
        if (removeButton) removeButton.disabled = false;
        showToast(`Не вдалося видалити товар: ${error.message}`);
    }
}

async function clearList() {
    if (shoppingItems.length === 0) {
        showToast("Список уже порожній.");
        return;
    }

    if (!window.confirm("Очистити весь список покупок?")) return;

    clearButton.disabled = true;

    try {
        if (currentUser) {
            const { error } = await supabase
                .from("shopping_items")
                .delete()
                .eq("user_id", currentUser.id);

            if (error) throw error;
        }

        shoppingItems = [];
        renderItems();
        showToast("Список очищено.");
    } catch (error) {
        clearButton.disabled = false;
        showToast(`Не вдалося очистити список: ${error.message}`);
    }
}

function selectOption(optionName) {
    selectedOption = optionName;

    document.querySelectorAll(".option-card").forEach((card) => {
        const isSelected = card.dataset.option === optionName;
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
    });

    const note = document.querySelector("#comparison-note p");
    const routeCaption = document.querySelector("#route-caption");
    const savingAmount = document.querySelector("#saving-amount");
    const savingPercent = document.querySelector("#saving-percent");
    const routePath = document.querySelector("#route-path");
    const pinTwo = document.querySelector("#pin-two");
    const pinThree = document.querySelector("#pin-three");

    if (optionName === "split") {
        note.textContent = "Обрано демонстраційний економний варіант: маршрут проходить через кілька умовних магазинів.";
        routeCaption.textContent = "Маршрут між 3 магазинами";
        savingAmount.textContent = "44 ₴";
        savingPercent.textContent = "−9%";
        routePath.setAttribute("d", "M45 120 C65 95 85 105 110 70 S165 45 205 25 M110 70 C120 95 145 120 170 145");
        pinTwo.hidden = false;
        pinThree.hidden = false;
    } else {
        note.textContent = "Обрано демонстраційний швидкий варіант: усі покупки в одному магазині.";
        routeCaption.textContent = "Один магазин поруч";
        savingAmount.textContent = "0 ₴";
        savingPercent.textContent = "0%";
        routePath.setAttribute("d", "M45 120 C65 95 85 105 110 70 S165 45 205 25");
        pinTwo.hidden = true;
        pinThree.hidden = true;
    }
}

editButton.addEventListener("click", () => setEditing(!isEditing));
addForm.addEventListener("submit", addItem);
clearButton.addEventListener("click", clearList);

document.querySelectorAll(".option-card").forEach((card) => {
    card.addEventListener("click", () => selectOption(card.dataset.option));
});

document.querySelector("#confirm-plan").addEventListener("click", () => {
    if (shoppingItems.length === 0) {
        showToast("Спочатку додай товари до списку покупок.");
        return;
    }

    const message = selectedOption === "one"
        ? "Демонстраційний план обрано: усі товари в одному магазині. Реальні ціни та маршрут ще не підключені."
        : "Демонстраційний план обрано: покупки розподілено між кількома магазинами. Реальні ціни та маршрут ще не підключені.";
    showToast(message);
});

async function initShoppingList() {
    setListControlsEnabled(false);
    renderItems();

    try {
        const { data, error } = await supabase.auth.getUser();

        if (error) {
            // Якщо сесію не вдалося перевірити, не вважаємо користувача авторизованим.
            console.warn("Не вдалося перевірити сесію Supabase:", error.message);
        }

        currentUser = error ? null : data.user;
        updateAccountUI();

        if (currentUser) {
            try {
                await loadUserItems();
                storageReady = true;
                storageWarning.hidden = true;
            } catch (error) {
                storageReady = false;
                storageWarning.hidden = false;
                storageWarning.textContent =
                    `Не вдалося завантажити список із Supabase: ${error.message}. Перевір, чи створена таблиця shopping_items та чи налаштовані RLS-політики.`;
                showToast("Не вдалося підключити збереження списку.");
            }
        } else {
            shoppingItems = [];
            storageReady = true;
            guestNotice.hidden = false;
            storageStatus.textContent = "Гостьовий список — тимчасовий";
            renderItems();
        }
    } catch (error) {
        storageReady = false;
        storageWarning.hidden = false;
        storageWarning.textContent = `Помилка ініціалізації списку: ${error.message}`;
    }

    setListControlsEnabled(storageReady);
    renderItems();
    selectOption("one");
}

initShoppingList();
