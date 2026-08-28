function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString(navigator.language, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateString = now.toLocaleDateString(navigator.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  document.getElementById("digitalClock").textContent = timeString;
  document.getElementById("dateText").textContent = dateString;
}
