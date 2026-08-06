renderNav("checker");
renderFooter();

let CHECKER_PRICE = 15; // fallback shown before the real price loads below
let paystackPublicKey = null;
let checkerReference = null;
let checkerAmountDue = null;

async function loadConfig() {
  try {
    const config = await api.get("/config");
    paystackPublicKey = config.paystackPublicKey;
    if (config.checkerPrice) {
      CHECKER_PRICE = config.checkerPrice;
      updateAmountDue();
    }
  } catch (err) {
    console.error("Failed to load config:", err.message);
  }
}
loadConfig();

function updateAmountDue() {
  const qty = Math.max(1, parseInt(document.getElementById("quantity").value) || 1);
  document.getElementById("amountDue").textContent = `GH₵${CHECKER_PRICE * qty}`;
}

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 6000);
}

document.getElementById("quantity").addEventListener("input", updateAmountDue);

async function startPayment() {
  const examType = document.getElementById("examType").value;
  const year = document.getElementById("examYear").value;
  const quantity = document.getElementById("quantity").value;
  const buyerPhone = document.getElementById("buyerPhone").value.trim();

  if (!/^0\d{9}$/.test(buyerPhone)) return showAlert("Enter a valid phone number to receive your PIN");

  const btn = document.getElementById("buyBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Preparing payment…`;

  try {
    const res = await api.post("/checker/buy", { examType, year, quantity, buyerPhone });
    checkerReference = res.order.reference;
    checkerAmountDue = res.amountDue;

    if (!paystackPublicKey) {
      throw new Error("Payment isn't set up yet. Please try again shortly.");
    }

    const popup = new PaystackPop();
    popup.newTransaction({
      key: paystackPublicKey,
      email: `${buyerPhone.replace(/\D/g, "")}@customer.databundlegh.com`,
      amount: Math.round(checkerAmountDue * 100),
      currency: "GHS",
      ref: checkerReference,
      onSuccess: () => {
        showCheckerWaitingState();
        pollCheckerStatus(checkerReference);
      },
      onCancel: () => {
        showAlert("Payment was cancelled.");
        resetCheckerForm();
      },
      onError: (error) => {
        showAlert(`Payment error: ${error.message || "please try again"}`);
        resetCheckerForm();
      },
    });

    btn.disabled = false;
    btn.textContent = "Pay & Get Voucher";
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.textContent = "Pay & Get Voucher";
  }
}

function showCheckerWaitingState() {
  document.getElementById("checkerFormFields").style.display = "none";
  document.getElementById("waitingBlock").style.display = "block";
}

async function pollCheckerStatus(reference, attempt = 0) {
  const MAX_ATTEMPTS = 40; // ~2 minutes at 3s intervals

  if (attempt >= MAX_ATTEMPTS) {
    showAlert(
      `Still waiting on payment confirmation for order ${reference}. If you completed payment, your voucher will appear shortly — otherwise contact support with this reference.`,
      "info"
    );
    return;
  }

  try {
    const order = await api.get(`/checker/${reference}`);

    if (order.status === "delivered") {
      renderVoucher(order);
      return;
    }

    if (order.status === "failed") {
      showAlert("Payment was not completed, or we're out of stock for this exam type/year. Please try again or contact support.");
      resetCheckerForm();
      return;
    }

    setTimeout(() => pollCheckerStatus(reference, attempt + 1), 3000);
  } catch (err) {
    setTimeout(() => pollCheckerStatus(reference, attempt + 1), 3000);
  }
}

function renderVoucher(order) {
  document.getElementById("buyForm").style.display = "none";
  const resultCard = document.getElementById("resultCard");
  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div style="text-align:center; padding:10px 0 20px;">
      <div style="width:56px; height:56px; border-radius:50%; background:rgba(0,229,138,0.15); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:1.8rem; color:var(--accent);">✓</div>
      <h2 style="color:var(--accent); margin-bottom:6px;">Payment Successful!</h2>
      <p class="hint">Your voucher is ready below.</p>
    </div>
    <div class="summary-row"><span>Serial Number</span><b>${order.voucher.serial}</b></div>
    <div class="summary-row"><span>PIN</span><b>${order.voucher.pin}</b></div>
    <p class="hint" style="margin-top:14px;">Visit the official WAEC results checker portal, enter your Index Number, Year, Serial Number and PIN above to view your result.</p>
    <a href="checker.html" class="btn btn-outline btn-block" style="margin-top:20px;">Buy Another Voucher</a>
  `;
}

function resetCheckerForm() {
  document.getElementById("checkerFormFields").style.display = "block";
  document.getElementById("waitingBlock").style.display = "none";
  const btn = document.getElementById("buyBtn");
  btn.disabled = false;
  btn.textContent = "Pay & Get Voucher";
}
