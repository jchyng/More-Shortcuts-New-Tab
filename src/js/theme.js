function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode) {
  const actualTheme = mode === "system" ? getSystemTheme() : mode;

  document.body.setAttribute("data-theme", actualTheme);

  updateThemeIcon(actualTheme);
  updateFavicon(actualTheme);
}

function initTheme() {
  const savedTheme = localStorage.getItem("themeMode") || "system";

  applyTheme(savedTheme);

  const themeSelect = document.getElementById("themeSelect");

  if (themeSelect) {
    setThemePickerValue(savedTheme);
  }

  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";

    localStorage.setItem("themeMode", next);

    if (themeSelect) {
      setThemePickerValue(next);
    }

    applyTheme(next);
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const mode = localStorage.getItem("themeMode") || "system";

      if (mode === "system") {
        applyTheme("system");
      }
    });
}

function setThemePickerValue(mode) {
  const themeSelect = document.getElementById("themeSelect");
  const valueLabel = document.getElementById("themeSelectValue");
  const options = document.querySelectorAll("#themeOptions [data-value]");
  const labels = { system: "System", light: "Light", dark: "Dark" };

  if (themeSelect) themeSelect.dataset.value = mode;
  if (valueLabel) valueLabel.textContent = labels[mode] ?? labels.system;

  options.forEach((option) => {
    const selected = option.dataset.value === mode;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function updateThemeIcon(theme) {
  document.querySelector("#themeToggle span").textContent =
    theme === "dark" ? "light_mode" : "dark_mode";
}

function updateFavicon(theme) {
  const favicon = document.getElementById("pageFavicon");
  if (!favicon) return;

  favicon.href =
    theme === "dark"
      ? "../assets/icons/tab-icon-dark-v2-32.png"
      : "../assets/icons/tab-icon-light-v2-32.png";
}
