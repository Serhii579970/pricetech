// PriceTech — демонстраційна аналітика цін.
// Поки що використовуються тестові дані. Пізніше їх можна буде отримувати з API.

const productData = {
    milk: {
        name: "Молоко",
        dates7: ["01.11", "02.11", "03.11", "04.11", "05.11", "06.11", "07.11"],
        prices7: [34, 36, 35, 39, 31, 34, 42],
        today: 42, week: 29, max: 67,
        warning: "Ціна зараз на 28% вища, ніж була 2 тижні тому."
    },
    coffee: {
        name: "Кава мелена",
        dates7: ["01.11", "02.11", "03.11", "04.11", "05.11", "06.11", "07.11"],
        prices7: [139, 135, 137, 132, 129, 131, 129],
        today: 129, week: 139, max: 159,
        warning: "Ціна знизилася порівняно з початком періоду."
    },
    eggs: {
        name: "Яйця курячі",
        dates7: ["01.11", "02.11", "03.11", "04.11", "05.11", "06.11", "07.11"],
        prices7: [52, 51, 53, 50, 49, 51, 49.9],
        today: 49.9, week: 52, max: 59,
        warning: "Ціна поступово знижується протягом тижня."
    },
    pasta: {
        name: "Макарони",
        dates7: ["01.11", "02.11", "03.11", "04.11", "05.11", "06.11", "07.11"],
        prices7: [38, 39, 37, 36, 37, 35, 35],
        today: 35, week: 38, max: 42,
        warning: "Ціна майже не змінювалася протягом тижня."
    }
};

const productSelect = document.querySelector("#product-select");
const periodButtons = document.querySelectorAll(".period-button");
const chartCanvas = document.querySelector("#price-chart");
const todayPrice = document.querySelector("#today-price");
const weekPrice = document.querySelector("#week-price");
const maxPrice = document.querySelector("#max-price");
const warning = document.querySelector("#deal-warning");
const detailsButton = document.querySelector("#details-button");
const extraDetails = document.querySelector("#insight-extra");
const chartRange = document.querySelector("#chart-range");

let currentPeriod = 7;
let priceChart;

// Для довших періодів генеруємо демонстраційні точки на основі тестової історії.
// У реальному продукті тут будуть фактичні дати та ціни з бази даних.
function getChartData(product, period) {
    if (period === 7) {
        return { labels: product.dates7, values: product.prices7 };
    }

    const points = period === 30 ? 10 : period === 90 ? 12 : 12;
    const labels = [];
    const values = [];

    for (let i = 0; i < points; i++) {
        labels.push(period === 30 ? `${i * 3 + 1}.11` :
            period === 90 ? `${i + 1} тиж.` : `${i + 1} міс.`);
        const base = product.prices7[i % product.prices7.length];
        const variation = Math.sin(i * 1.7) * (product.today * 0.07);
        values.push(Number(Math.max(1, base + variation).toFixed(1)));
    }

    return { labels, values };
}

function renderChart() {
    const product = productData[productSelect.value];
    const chartData = getChartData(product, currentPeriod);

    if (priceChart) {
        priceChart.destroy();
    }

    priceChart = new Chart(chartCanvas, {
        type: "line",
        data: {
            labels: chartData.labels,
            datasets: [{
                label: `Ціна: ${product.name}`,
                data: chartData.values,
                borderColor: "#19e99b",
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return "rgba(25,233,155,.12)";
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, "rgba(25,233,155,.28)");
                    gradient.addColorStop(1, "rgba(25,233,155,0)");
                    return gradient;
                },
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 5,
                pointBackgroundColor: "#19e99b",
                pointBorderColor: "#071426",
                pointBorderWidth: 1,
                fill: true,
                tension: 0.38
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#102139",
                    titleColor: "#ffffff",
                    bodyColor: "#19e99b",
                    borderColor: "rgba(25,233,155,.35)",
                    borderWidth: 1,
                    callbacks: {
                        label: context => ` ${context.parsed.y.toLocaleString("uk-UA")} ₴`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#91a2b9", maxTicksLimit: 5, font: { size: 9 } },
                    border: { display: false }
                },
                y: {
                    grid: { color: "rgba(255,255,255,.07)" },
                    ticks: { color: "#91a2b9", font: { size: 9 }, callback: value => `${value}₴` },
                    border: { display: false }
                }
            }
        }
    });

    todayPrice.textContent = `${product.today.toLocaleString("uk-UA")} ₴`;
    weekPrice.textContent = `${product.week.toLocaleString("uk-UA")} ₴`;
    maxPrice.textContent = `${product.max.toLocaleString("uk-UA")} ₴`;
    warning.querySelector("strong").textContent = product.warning;
    chartRange.textContent = currentPeriod === 7 ? "Останні 7 днів" :
        currentPeriod === 30 ? "Останні 30 днів" :
        currentPeriod === 90 ? "Останні 3 місяці" : "Останні 6 місяців";
}

periodButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentPeriod = Number(button.dataset.period);
        periodButtons.forEach(item => {
            const active = item === button;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });
        renderChart();
    });
});

productSelect.addEventListener("change", renderChart);

detailsButton.addEventListener("click", () => {
    extraDetails.hidden = !extraDetails.hidden;
    detailsButton.textContent = extraDetails.hidden ? "Детальніше" : "Згорнути";
});

document.querySelectorAll("[data-demo]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        const toast = document.querySelector("#toast");
        toast.textContent = link.dataset.demo;
        toast.classList.add("show");
        clearTimeout(window.analyticsToastTimer);
        window.analyticsToastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
    });
});

document.querySelector("#top-search").addEventListener("keydown", event => {
    if (event.key === "Enter") window.location.href = "search.html";
});

renderChart();
console.log("PriceTech Analytics: сторінка аналітики завантажена.");
