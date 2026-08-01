renderNav("home");
renderFooter();

// FAQ accordion toggle
document.querySelectorAll(".faq-item").forEach((item) => {
  item.addEventListener("click", () => item.classList.toggle("open"));
});

// Recent activity ticker (social proof)
async function loadActivity() {
  const ticker = document.getElementById("activityTicker");
  if (!ticker) return;
  try {
    const activity = await api.get("/orders/recent-activity");
    if (!activity.length) {
      ticker.textContent = "Be the first to place an order today!";
      return;
    }
    const items = activity.map(
      (a) => `<b>${a.network} ${a.bundleSize}</b> delivered to ${a.phone}`
    );
    let i = 0;
    ticker.innerHTML = items[0];
    setInterval(() => {
      i = (i + 1) % items.length;
      ticker.innerHTML = items[i];
    }, 3500);
  } catch (err) {
    ticker.textContent = "⚡ Fast delivery on every order!";
  }
}
loadActivity();
