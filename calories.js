// PriceTech — демонстраційний харчовий щоденник.
// Усі значення приблизні; надалі їх можна замінити даними з API або бази продуктів.

const foodCatalog = {
    banana:    { name: "Банан", emoji: "🍌", portion: "120 г", kcal: 105, protein: 1.3, fat: 0.4, carbs: 27 },
    chicken:   { name: "Куряче філе", emoji: "🍗", portion: "200 г", kcal: 330, protein: 62, fat: 7, carbs: 0 },
    buckwheat: { name: "Гречка варена", emoji: "🥣", portion: "150 г", kcal: 165, protein: 5.4, fat: 1.6, carbs: 32 },
    yogurt:    { name: "Йогурт натуральний", emoji: "🥛", portion: "150 г", kcal: 143, protein: 7, fat: 7.5, carbs: 11 },
    apple:     { name: "Яблуко", emoji: "🍎", portion: "150 г", kcal: 78, protein: 0.4, fat: 0.3, carbs: 21 },
    egg:       { name: "Яйце варене", emoji: "🥚", portion: "1 шт.", kcal: 78, protein: 6.3, fat: 5.3, carbs: 0.6 },
    oats:      { name: "Вівсянка", emoji: "🥣", portion: "40 г", kcal: 150, protein: 5, fat: 3, carbs: 27 }
};

let foods = [
    { ...foodCatalog.banana, id: 1 },
    { ...foodCatalog.chicken, id: 2 },
    { ...foodCatalog.buckwheat, id: 3 },
    { ...foodCatalog.yogurt, id: 4 }
];
let nextId = 5;

const foodList = document.querySelector("#food-list");
const foodSelect = document.querySelector("#food-select");
const addFoodForm = document.querySelector("#add-food-form");
const totalCalories = document.querySelector("#total-calories");
const foodCount = document.querySelector("#food-count");
const emptyFoods = document.querySelector("#empty-foods");
const macroChart = document.querySelector("#macro-chart");

function formatNumber(value) {
    return Math.round(value).toLocaleString("uk-UA");
}

function renderFoods() {
    foodList.innerHTML = "";

    foods.forEach(food => {
        const item = document.createElement("li");
        item.className = "food-item";
        item.dataset.id = food.id;
        item.innerHTML = `
            <span class="food-emoji">${food.emoji}</span>
            <span class="food-info">
                <strong>${food.name}</strong>
                <small>${food.portion} · ${food.kcal} ккал</small>
            </span>
            <button type="button" class="remove-food"
                aria-label="Видалити ${food.name}" title="Видалити">×</button>
        `;
        foodList.appendChild(item);
    });

    emptyFoods.hidden = foods.length !== 0;
    foodCount.textContent = foods.length;
    updateNutrition();
}

function updateNutrition() {
    const totals = foods.reduce((sum, food) => {
        sum.kcal += food.kcal;
        sum.protein += food.protein;
        sum.fat += food.fat;
        sum.carbs += food.carbs;
        return sum;
    }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });

    totalCalories.textContent = formatNumber(totals.kcal);

    const macroCalories = {
        protein: totals.protein * 4,
        fat: totals.fat * 9,
        carbs: totals.carbs * 4
    };
    const macroTotal = macroCalories.protein + macroCalories.fat + macroCalories.carbs || 1;
    const proteinPercent = Math.round(macroCalories.protein / macroTotal * 100);
    const fatPercent = Math.round(macroCalories.fat / macroTotal * 100);
    const carbsPercent = Math.max(0, 100 - proteinPercent - fatPercent);

    macroChart.style.setProperty("--protein", `${proteinPercent}%`);
    macroChart.style.setProperty("--fat", `${fatPercent}%`);

    document.querySelector("#protein-value").textContent =
        `${totals.protein.toFixed(1).replace(".", ",")} г (${proteinPercent}%)`;
    document.querySelector("#fat-value").textContent =
        `${totals.fat.toFixed(1).replace(".", ",")} г (${fatPercent}%)`;
    document.querySelector("#carbs-value").textContent =
        `${totals.carbs.toFixed(1).replace(".", ",")} г (${carbsPercent}%)`;
}

addFoodForm.addEventListener("submit", event => {
    event.preventDefault();

    const selectedFood = foodCatalog[foodSelect.value];
    if (!selectedFood) return;

    foods.push({ ...selectedFood, id: nextId++ });
    renderFoods();
});

foodList.addEventListener("click", event => {
    const removeButton = event.target.closest(".remove-food");
    if (!removeButton) return;

    const item = removeButton.closest(".food-item");
    const id = Number(item.dataset.id);
    foods = foods.filter(food => food.id !== id);
    renderFoods();
});

document.querySelector("#reset-foods").addEventListener("click", () => {
    foods = [];
    renderFoods();
});

document.querySelector("#top-search").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        window.location.href = "search.html";
    }
});

document.querySelectorAll("[data-demo]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        const toast = document.querySelector("#toast");
        toast.textContent = link.dataset.demo;
        toast.classList.add("show");
        window.setTimeout(() => toast.classList.remove("show"), 2500);
    });
});

const dateElement = document.querySelector("#today-date");
dateElement.textContent = new Date().toLocaleDateString("uk-UA", {
    day: "numeric", month: "long"
});

renderFoods();
