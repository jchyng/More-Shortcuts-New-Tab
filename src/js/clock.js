function updateClock() {
  const now = new Date();
  const use24HourClock = getPrefSync("use24HourClock", "false") === "true";
  const effectiveLang = typeof getEffectiveLanguage === "function" ? getEffectiveLanguage() : "en";
  const locale = (typeof SUPPORTED_LANGUAGES !== "undefined" && SUPPORTED_LANGUAGES[effectiveLang]?.locale) || "en-US";

  const timeString = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24HourClock,
  });
  const dateString = now.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const digitalClock = document.getElementById("digitalClock");
  const dateText = document.getElementById("dateText");
  if (digitalClock) digitalClock.textContent = timeString;
  if (dateText) dateText.textContent = dateString;
}
