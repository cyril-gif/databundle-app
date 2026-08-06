renderNav("buy");
renderFooter();

const state = {
  network: null,
  bundle: null,
  deliveryPhone: null,
};

let paystackPublicKey = null;

async function loadPaystackKey() {
  try {
    const config = await api.get("/config");
    paystackPublicKey = config.paystackPublicKey;
  } catch (err) {
    console.error("Failed to load Paystack config:", err.message);
  }
}
loadPaystackKey();

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 5000);
}

function goToStep(n) {
  document.querySelectorAll(".flow-step").forEach((el) => (el.style.display = "none"));
  document.getElementById(`step${n}`).style.display = "block";

  document.querySelectorAll(".step-pill").forEach((pill) => {
    pill.classList.toggle("active", Number(pill.dataset.step) <= n);
  });
}

// STEP 1: network selection
document.querySelectorAll(".network-card").forEach((card) => {
  card.addEventListener("click", async () => {
    document.querySelectorAll(".network-card").forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    state.network = card.dataset.network;
    document.getElementById("sumNetwork").textContent = state.network;
    await loadBundles(state.network);
    goToStep(2);
  });
});

// Pre-select network if passed via URL (?network=MTN)
const params = new URLSearchParams(window.location.search);
const preselected = params.get("network");
if (preselected) {
  const card = document.querySelector(`.network-card[data-network="${preselected}"]`);
  if (card) card.click();
}

// STEP 2: load & select bundle
async function loadBundles(network) {
  const grid = document.getElementById("bundleGrid");
  grid.innerHTML = `<p class="hint">Loading bundles…</p>`;
  try {
    const bundles = await api.get(`/bundles?network=${network}`);
    if (!bundles.length) {
      grid.innerHTML = `<p class="hint">No bundles available for ${network} right now.</p>`;
      return;
    }
    grid.innerHTML = bundles
      .map(
        (b) => `
        <div class="bundle-card" data-id="${b._id}" data-size="${b.size}" data-price="${b.price}">
          ${b.popular ? '<span class="tag">Best Value</span>' : ""}
          <div class="size">${b.size}</div>
          <div class="price">GH₵${b.price}</div>
          <div class="validity">${b.validity}</div>
        </div>`
      )
      .join("");

    grid.querySelectorAll(".bundle-card").forEach((card) => {
      card.addEventListener("click", () => {
        grid.querySelectorAll(".bundle-card").forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        state.bundle = { id: card.dataset.id, size: card.dataset.size, price: Number(card.dataset.price) };
        document.getElementById("sumBundle").textContent = `${state.bundle.size} — GH₵${state.bundle.price}`;
        document.getElementById("sumTotal").textContent = `GH₵${state.bundle.price}`;
        goToStep(3);
      });
    });
  } catch (err) {
    grid.innerHTML = `<p class="error-text">${err.message}</p>`;
  }
}

// STEP 3: phone
function submitPhone() {
  const phone = document.getElementById("deliveryPhone").value.trim();
  if (!/^0\d{9}$/.test(phone)) {
    showAlert("Enter a valid 10-digit Ghanaian phone number starting with 0");
    return;
  }
  state.deliveryPhone = phone;
  document.getElementById("sumPhone").textContent = phone;
  document.getElementById("payBtnAmount").textContent = state.bundle.price;
  goToStep(4);
}

// STEP 4: create order, then open Paystack Popup
async function startPayment() {
  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = true;
  payBtn.innerHTML = `<span class="spinner"></span> Preparing payment…`;

  try {
    const res = await api.post("/orders", {
      bundleId: state.bundle.id,
      deliveryPhone: state.deliveryPhone,
    });
    state.orderReference = res.order.reference;

    if (!paystackPublicKey) {
      throw new Error("Payment isn't set up yet. Please try again shortly.");
    }

    const popup = new PaystackPop();
    popup.newTransaction({
      key: paystackPublicKey,
      email: `${state.deliveryPhone.replace(/\D/g, "")}@customer.databundlegh.com`,
      amount: Math.round(state.bundle.price * 100),
      currency: "GHS",
      ref: state.orderReference,
      onSuccess: () => {
        showWaitingState();
        pollOrderStatus(state.orderReference);
      },
      onCancel: () => {
        showAlert("Payment was cancelled.");
        resetToPaymentForm();
      },
      onError: (error) => {
        showAlert(`Payment error: ${error.message || "please try again"}`);
        resetToPaymentForm();
      },
    });

    payBtn.disabled = false;
    payBtn.innerHTML = `Pay GH₵<span id="payBtnAmount">${state.bundle.price}</span>`;
  } catch (err) {
    showAlert(err.message);
    payBtn.disabled = false;
    payBtn.innerHTML = `Pay GH₵<span id="payBtnAmount">${state.bundle.price}</span>`;
  }
}

function showWaitingState() {
  document.getElementById("payFormFields").style.display = "none";
  document.getElementById("waitingBlock").style.display = "block";
}

async function pollOrderStatus(reference, attempt = 0) {
  const MAX_ATTEMPTS = 40; // ~2 minutes at 3s intervals

  if (attempt >= MAX_ATTEMPTS) {
    showAlert(
      `Still waiting on payment confirmation for order ${reference}. If you completed payment, your data will arrive shortly — otherwise contact support with this reference.`,
      "info"
    );
    return;
  }

  try {
    const order = await api.get(`/orders/${reference}`);

    if (order.status === "delivered") {
      renderConfirmation(order);
      goToStep(5);
      return;
    }

    if (order.status === "failed") {
      showAlert("Payment was not completed. Please try again.");
      resetToPaymentForm();
      return;
    }

    setTimeout(() => pollOrderStatus(reference, attempt + 1), 3000);
  } catch (err) {
    setTimeout(() => pollOrderStatus(reference, attempt + 1), 3000);
  }
}

function resetToPaymentForm() {
  document.getElementById("payFormFields").style.display = "block";
  document.getElementById("waitingBlock").style.display = "none";
}

function renderConfirmation(order) {
  const statusSteps = ["pending_payment", "processing", "delivered"];
  const currentIndex = statusSteps.indexOf(order.status);

  document.getElementById("confirmationCard").innerHTML = `
    <div style="text-align:center; padding:10px 0 20px;">
      <div style="width:56px; height:56px; border-radius:50%; background:rgba(0,229,138,0.15); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:1.8rem; color:var(--accent);">✓</div>
      <h2 style="color:var(--accent); margin-bottom:6px;">Payment Successful!</h2>
      <p class="hint">Your order has been placed and your data is on its way.</p>
    </div>

    <p class="hint">Order Reference</p>
    <h3 style="margin-bottom:20px;">${order.reference}</h3>

    <div class="status-track">
      ${statusSteps
        .map(
          (s, i) => `
        <div style="flex:1; text-align:center;">
          <div class="dot ${i <= currentIndex ? "done" : ""}" style="margin:0 auto;"></div>
          <p class="hint" style="margin-top:6px; text-transform:capitalize;">${s.replace("_", " ")}</p>
        </div>`
        )
        .join("")}
    </div>

    <div class="summary-row"><span>Network</span><b>${order.network}</b></div>
    <div class="summary-row"><span>Bundle</span><b>${order.bundleSize}</b></div>
    <div class="summary-row"><span>Delivery Number</span><b>${order.deliveryPhone}</b></div>
    <div class="summary-row"><span>Amount Paid</span><b>GH₵${order.price}</b></div>
    <div class="summary-row"><span>Status</span><b style="color:var(--accent); text-transform:capitalize;">${order.status.replace("_"," ")}</b></div>

    <a href="buy.html" class="btn btn-primary btn-block" style="margin-top:20px;">Buy Another Bundle</a>
  `;
}
