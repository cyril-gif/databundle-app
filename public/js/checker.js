renderNav("checker");
renderFooter();

const CHECKER_PRICE = 15;
let checkerReference = null;
let checkerPaymentPhone = null;
let checkerAmountDue = null;

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 6000);
}

document.getElementById("quantity").addEventListener("input", (e) => {
  const qty = Math.max(1, parseInt(e.target.value) || 1);
  document.getElementById("amountDue").textContent = `GH₵${CHECKER_PRICE * qty}`;
});

async function buyVoucher() {
  const year = document.getElementById("examYear").value;
  const quantity = document.getElementById("quantity").value;
  const buyerPhone = document.getElementById("buyerPhone").value.trim();
  const paymentMethod = document.getElementById("paymentMethod").value;
  const paymentPhone = document.getElementById("paymentPhone").value.trim();

  if (!/^0\d{9}$/.test(buyerPhone)) return showAlert("Enter a valid phone number to receive your PIN");
  if (!/^0\d{9}$/.test(paymentPhone)) return showAlert("Enter a valid Mobile Money number");

  const btn = document.getElementById("buyBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Initiating payment…`;

  try {
    const res = await api.post("/checker/buy", {
      year,
      quantity,
      buyerPhone,
      paymentMethod,
      paymentPhone,
    });

    checkerReference = res.order.reference;
    checkerPaymentPhone = paymentPhone;
    checkerAmountDue = res.amountDue;

    if (res.paystackStatus === "send_otp") {
      document.getElementById("checkerFormFields").style.display = "none";
      document.getElementById("otpBlock").style.display = "block";
      document.getElementById("otpPhone").textContent = paymentPhone;
    } else {
      showCheckerWaitingState();
      pollCheckerStatus(checkerReference);
    }
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.textContent = "Pay & Get Voucher";
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
    await api.post(`/checker/${checkerReference}/submit-otp`, { otp });
    document.getElementById("otpBlock").style.display = "none";
    showCheckerWaitingState();
    pollCheckerStatus(checkerReference);
  } catch (err) {
    showAlert(err.message);
    otpBtn.disabled = false;
    otpBtn.textContent = "Submit Code";
  }
}

function showCheckerWaitingState() {
  document.getElementById("checkerFormFields").style.display = "none";
  document.getElementById("otpBlock").style.display = "none";
  document.getElementById("waitingBlock").style.display = "block";
  document.getElementById("waitingAmount").textContent = `GH₵${checkerAmountDue}`;
  document.getElementById("waitingPhone").textContent = checkerPaymentPhone;
}

async function pollCheckerStatus(reference, attempt = 0) {
  const MAX_ATTEMPTS = 40; // ~2 minutes at 3s intervals

  if (attempt >= MAX_ATTEMPTS) {
    showAlert(
      `Still waiting on payment confirmation for order ${reference}. If you approved the prompt, your voucher will appear shortly — otherwise contact support with this reference.`,
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
      showAlert("Payment was not approved, or we're out of stock for this year. Please try again or contact support.");
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
    <div class="alert alert-success">Payment confirmed! Here is your voucher.</div>
    <div class="summary-row"><span>Serial Number</span><b>${order.voucher.serial}</b></div>
    <div class="summary-row"><span>PIN</span><b>${order.voucher.pin}</b></div>
    <p class="hint" style="margin-top:14px;">Visit the official WAEC results checker portal, enter your Index Number, Year, Serial Number and PIN above to view your BECE result.</p>
    <a href="checker.html" class="btn btn-outline btn-block" style="margin-top:20px;">Buy Another Voucher</a>
  `;
}

function resetCheckerForm() {
  document.getElementById("checkerFormFields").style.display = "block";
  document.getElementById("otpBlock").style.display = "none";
  document.getElementById("waitingBlock").style.display = "none";
  const btn = document.getElementById("buyBtn");
  btn.disabled = false;
  btn.textContent = "Pay & Get Voucher";
}
