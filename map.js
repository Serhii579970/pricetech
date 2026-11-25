// PriceTech — сторінка карти. Уся логіка карти знаходиться в папці map-module/.
import { initStoreLocator } from "./map-module/locator.js";

const toast = document.querySelector("#toast");
let toastTimer;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

document.querySelector("#top-search").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        window.location.href = "search.html";
    }
});

initStoreLocator({ notify: showToast });
