function updateClock() {
  const now = new Date();
  const use24HourClock = localStorage.getItem("use24HourClock") === "true";
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24HourClock,
  });
  const dateString = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  document.getElementById("digitalClock").textContent = timeString;
  document.getElementById("dateText").textContent = dateString;
}
