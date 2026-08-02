renderNav("buy");
renderFooter();

const state = {
  network: null,
  bundle: null,
  deliveryPhone: null,
  paymentMethod: "MTN MoMo",
  paymentPhone: null,
};

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
  document.getElementById("paymentPhone").value = phone;
  goToStep(4);
}

// STEP 4: payment + create order
async function submitOrder() {
  const paymentPhone = document.getElementById("paymentPhone").value.trim();
  const paymentMethod = document.getElementById("paymentMethod").value;

  if (!/^0\d{9}$/.test(paymentPhone)) {
    showAlert("Enter a valid 10-digit Mobile Money number");
    return;
  }

  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = true;
  payBtn.innerHTML = `<span class="spinner"></span> Initiating payment…`;

  try {
    const res = await api.post("/orders", {
      bundleId: state.bundle.id,
      deliveryPhone: state.deliveryPhone,
      paymentPhone,
      paymentMethod,
    });

    state.orderReference = res.order.reference;
    state.paymentPhone = paymentPhone;

    if (res.paystackStatus === "send_otp") {
      // Customer needs to enter a code sent via SMS before payment proceeds
      document.getElementById("payFormFields").style.display = "none";
      document.getElementById("otpBlock").style.display = "block";
      document.getElementById("otpPhone").textContent = paymentPhone;
    } else {
      // e.g. "pay_offline" — customer approves directly on their phone, no code needed
      showWaitingState(paymentPhone);
      pollOrderStatus(state.orderReference);
    }
  } catch (err) {
    showAlert(err.message);
    payBtn.disabled = false;
    payBtn.textContent = "Confirm & Pay";
  }
}

async function submitOtp() {
  const otp = document.getElementById("otpInput").value.trim();
  if (!/^\d{4,6}$/.test(otp)) {
    showAlert("Enter the code exactly as sent to your phone");
    return;
  }

  const otpBtn = document.getElementById("otpBtn");
  otpBtn.disabled = true;
  otpBtn.innerHTML = `<span class="spinner"></span> Submitting…`;

  try {
    await api.post(`/orders/${state.orderReference}/submit-otp`, { otp });
    document.getElementById("otpBlock").style.display = "none";
    showWaitingState(state.paymentPhone);
    pollOrderStatus(state.orderReference);
  } catch (err) {
    showAlert(err.message);
    otpBtn.disabled = false;
    otpBtn.textContent = "Submit Code";
  }
}

function showWaitingState(paymentPhone) {
  document.getElementById("payFormFields").style.display = "none";
  document.getElementById("otpBlock").style.display = "none";
  document.getElementById("waitingBlock").style.display = "block";
  document.getElementById("waitingAmount").textContent = `GH₵${state.bundle.price}`;
  document.getElementById("waitingPhone").textContent = paymentPhone;
}

async function pollOrderStatus(reference, attempt = 0) {
  const MAX_ATTEMPTS = 40; // ~2 minutes at 3s intervals

  if (attempt >= MAX_ATTEMPTS) {
    showAlert(
      `Still waiting on payment confirmation for order ${reference}. If you approved the prompt, your data will arrive shortly — otherwise contact support with this reference.`,
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
      showAlert("Payment was not approved or failed. Please try again.");
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
  document.getElementById("otpBlock").style.display = "none";
  document.getElementById("waitingBlock").style.display = "none";
  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = false;
  payBtn.textContent = "Confirm & Pay";
}

function renderConfirmation(order) {
  const statusSteps = ["pending_payment", "processing", "delivered"];
  const currentIndex = statusSteps.indexOf(order.status);

  document.getElementById("confirmationCard").innerHTML = `
    <div class="alert alert-success">Order placed successfully!</div>
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
