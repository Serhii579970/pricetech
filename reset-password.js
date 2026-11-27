
import { supabase } from "./supabase.js";

const form = document.getElementById("reset-password-form");
const button = document.getElementById("reset-button");
const message = document.getElementById("reset-message");

let recoverySessionAvailable = false;

// Перевіряємо, чи користувач перейшов за посиланням відновлення
async function checkRecoverySession() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        message.style.color = "#ff7777";
        message.textContent =
            "Посилання недійсне або термін його дії завершився. Запроси відновлення пароля ще раз.";
        button.disabled = true;
        return;
    }

    recoverySessionAvailable = true;
}

await checkRecoverySession();

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!recoverySessionAvailable) {
        message.style.color = "#ff7777";
        message.textContent =
            "Немає активного сеансу відновлення. Запроси нове посилання.";
        return;
    }

    const password = document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirm-password").value;

    message.textContent = "";

    if (password.length < 8) {
        message.style.color = "#ff7777";
        message.textContent =
            "Пароль повинен містити щонайменше 8 символів.";
        return;
    }

    if (password !== confirmPassword) {
        message.style.color = "#ff7777";
        message.textContent = "Паролі не збігаються.";
        return;
    }

    button.disabled = true;
    button.textContent = "Збереження...";

    try {
        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            throw error;
        }

        message.style.color = "#20ed9a";
        message.textContent =
            "Пароль успішно змінено! Перенаправляємо на сторінку входу...";

        await supabase.auth.signOut();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1800);

    } catch (error) {
        message.style.color = "#ff7777";
        message.textContent =
            "Не вдалося змінити пароль: " + error.message;

        button.disabled = false;
        button.innerHTML =
            'Зберегти новий пароль <span>→</span>';
    }
});
