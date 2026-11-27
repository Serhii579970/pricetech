
import { supabase } from "./supabase.js";

const form = document.getElementById("forgot-password-form");
const button = document.getElementById("forgot-button");
const message = document.getElementById("forgot-message");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();

    message.textContent = "";
    message.style.color = "#ff7777";

    button.disabled = true;
    button.textContent = "Надсилання...";

    try {
        const redirectUrl = new URL(
            "reset-password.html",
            window.location.href
        ).toString();

        const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: redirectUrl
            }
        );

        if (error) {
            throw error;
        }

        message.style.color = "#20ed9a";
        message.textContent =
            "Якщо для цієї адреси існує акаунт, на неї надіслано лист із посиланням для відновлення пароля. Перевір пошту.";

    } catch (error) {
        message.style.color = "#ff7777";
        message.textContent =
            "Не вдалося надіслати лист: " + error.message;

    } finally {
        button.disabled = false;
        button.innerHTML = 'Надіслати посилання <span>→</span>';
    }
});
