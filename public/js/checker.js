renderNav("checker");
renderFooter();

let CHECKER_PRICE = 15; // fallback shown before the real price loads below
let checkerReference = null;
let checkerPaymentPhone = null;
let checkerAmountDue = null;

async function loadCheckerPrice() {
  try {
    const config = await api.get("/config");
    if (config.checkerPrice) {
      CHECKER_PRICE = config.checkerPrice;
      const qty = Math.max(1, parseInt(document.getElementById("quantity").value) || 1);
      document.getElementById("amountDue").textContent = `GH₵${CHECKER_PRICE * qty}`;
    }
  } catch (err) {
    // Silently keep the fallback price if this fails — the backend still
    // charges the correct authoritative amount regardless of what's shown here.
  }
}
loadCheckerPrice();

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 6000);
}

document.getElementById("quantity").addEventListener("input", (e) => {
  const qty = Math.max(1, parseInt(e.target.value) || 1);
  document.getElementById("amountDue").textContent = `GH₵${CHECKER_PRICE * qty}`;
});

// ============================================
// PAYSTACK INTEGRATION - UPDATED FUNCTIONS
// ============================================

async function buyVoucher() {
  const year = document.getElementById("examYear").value;
  const quantity = document.getElementById("quantity").value;
  const buyerName = document.getElementById("buyerName")?.value.trim() || "Guest";
  const buyerEmail = document.getElementById("buyerEmail")?.value.trim() || "guest@example.com";
  const buyerPhone = document.getElementById("buyerPhone").value.trim();
  const paymentMethod = document.getElementById("paymentMethod").value;
  const paymentPhone = document.getElementById("paymentPhone").value.trim();

  if (!buyerName) {
    return showAlert("Please enter your full name");
  }
  if (!buyerEmail || !buyerEmail.includes("@")) {
    return showAlert("Please enter a valid email address");
  }
  if (!/^0\d{9}$/.test(buyerPhone)) {
    return showAlert("Enter a valid phone number to receive your PIN");
  }
  if (!/^0\d{9}$/.test(paymentPhone)) {
    return showAlert("Enter a valid Mobile Money number");
  }

  const btn = document.getElementById("buyBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Initiating payment…`;

  try {
    // Check if Paystack is available
    if (window.paystack && window.paystack.initialized) {
      await initiatePaystackVoucherPayment();
    } else {
      // Fallback to legacy payment
      await submitLegacyVoucherOrder();
    }
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.textContent = "Pay & Get Voucher";
  }
}

// NEW: Paystack Voucher Payment
async function initiatePaystackVoucherPayment() {
  const btn = document.getElementById("buyBtn");
  const quantity = parseInt(document.getElementById("quantity").value) || 1;
  const buyerName = document.getElementById("buyerName")?.value.trim() || "Guest";
  const buyerEmail = document.getElementById("buyerEmail")?.value.trim() || "guest@example.com";
  const buyerPhone = document.getElementById("buyerPhone").value.trim();
  const paymentPhone = document.getElementById("paymentPhone").value.trim();
  const year = document.getElementById("examYear").value;

  try {
    const orderData = {
      customerName: buyerName,
      customerEmail: buyerEmail,
      customerPhone: buyerPhone,
      quantity: quantity,
      year: year,
      paymentPhone: paymentPhone,
    };

    // Initialize payment on backend
    const response = await api.post("/bece/initialize-payment", orderData);

    if (!response.success) {
      throw new Error(response.message || "Payment initialization failed");
    }

    // Store order reference
    checkerReference = response.data.order.orderNumber;
    checkerPaymentPhone = paymentPhone;
    checkerAmountDue = 5 * quantity;

    // Open Paystack popup
    window.paystack.openPopup(
      {
        email: buyerEmail,
        amount: 5 * quantity,
        reference: response.data.payment.reference,
        metadata: {
          orderNumber: response.data.order.orderNumber,
          customerName: buyerName,
          customerPhone: buyerPhone,
          orderType: "bece_voucher",
          quantity: quantity,
          year: year,
        },
      },
      {
        onSuccess: function (paystackResponse) {
          verifyVoucherPayment(paystackResponse.reference);
        },
        onClose: function () {
          btn.disabled = false;
          btn.textContent = "Pay & Get Voucher";
        },
        onError: function (error) {
          showAlert(error || "Payment failed. Please try again.");
          btn.disabled = false;
          btn.textContent = "Pay & Get Voucher";
        },
      }
    );
  } catch (err) {
    showAlert(err.message || "Failed to initialize payment");
    btn.disabled = false;
    btn.textContent = "Pay & Get Voucher";
  }
}

// NEW: Verify Voucher Payment
async function verifyVoucherPayment(reference) {
  const btn = document.getElementById("buyBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Verifying payment…`;

  try {
    const response = await api.get(`/bece/verify-payment/${reference}`);

    if (response.success) {
      // Payment successful - render voucher
      renderVoucher({
        reference: response.data.orderNumber,
        status: "delivered",
        voucher: {
          serial: response.data.serialNumber,
          pin: response.data.pin,
        },
        quantity: parseInt(document.getElementById("quantity").value) || 1,
      });
    } else {
      showAlert(response.message || "Payment verification failed");
      resetCheckerForm();
    }
  } catch (err) {
    showAlert(err.message || "Failed to verify payment");
    resetCheckerForm();
  } finally {
    btn.disabled = false;
    btn.textContent = "Pay & Get Voucher";
  }
}

// LEGACY: Existing payment method (kept for fallback)
async function submitLegacyVoucherOrder() {
  const year = document.getElementById("examYear").value;
  const quantity = document.getElementById("quantity").value;
  const buyerPhone = document.getElementById("buyerPhone").value.trim();
  const paymentMethod = document.getElementById("paymentMethod").value;
  const paymentPhone = document.getElementById("paymentPhone").value.trim();

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
    throw err;
  }
}

// OTP submission (legacy)
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
    <div style="text-align:center; padding:10px 0 20px;">
      <div style="width:56px; height:56px; border-radius:50%; background:rgba(0,229,138,0.15); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:1.8rem; color:var(--accent);">✓</div>
      <h2 style="color:var(--accent); margin-bottom:6px;">Payment Successful!</h2>
      <p class="hint">Your voucher is ready below.</p>
    </div>

    <div class="voucher-details" style="background:rgba(34,211,238,0.05); border:1px solid var(--accent); border-radius:12px; padding:1rem; margin-bottom:1rem;">
      <div class="summary-row"><span style="color:var(--text-secondary);">Serial Number</span><b style="font-family:monospace; letter-spacing:1px;">${order.voucher.serial}</b></div>
      <div class="summary-row"><span style="color:var(--text-secondary);">PIN</span><b style="color:var(--accent); font-family:monospace; letter-spacing:1px;">${order.voucher.pin}</b></div>
      ${order.quantity > 1 ? `<div class="summary-row"><span style="color:var(--text-secondary);">Quantity</span><b>${order.quantity}</b></div>` : ""}
    </div>

    <p class="hint" style="margin-top:14px;">
      <i class="fas fa-info-circle" style="color:var(--accent);"></i>
      Visit the official WAEC results checker portal, enter your Index Number, Year, Serial Number and PIN above to view your BECE result.
    </p>

    <div style="margin-top:1rem; display:flex; gap:0.8rem; flex-wrap:wrap;">
      <button class="btn btn-sm btn-outline" onclick="copyVoucherDetails('${order.voucher.serial}', '${order.voucher.pin}')">
        <i class="fas fa-copy"></i> Copy Details
      </button>
      <a href="checker.html" class="btn btn-sm btn-primary">Buy Another Voucher</a>
    </div>
  `;
}

// NEW: Copy voucher details
function copyVoucherDetails(serial, pin) {
  const text = `Serial Number: ${serial}\nPIN: ${pin}`;
  navigator.clipboard.writeText(text).then(() => {
    showAlert("Voucher details copied to clipboard!", "success");
  }).catch(() => {
    // Fallback
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    showAlert("Voucher details copied!", "success");
  });
}

function resetCheckerForm() {
  document.getElementById("checkerFormFields").style.display = "block";
  document.getElementById("otpBlock").style.display = "none";
  document.getElementById("waitingBlock").style.display = "none";
  const btn = document.getElementById("buyBtn");
  btn.disabled = false;
  btn.textContent = "Pay & Get Voucher";
}

// ============================================
// INITIALIZATION
// ============================================

// Add customer details fields if they don't exist (for Paystack)
document.addEventListener("DOMContentLoaded", function () {
  const buyForm = document.getElementById("checkerFormFields");
  if (buyForm) {
    // Check if name field exists
    if (!document.getElementById("buyerName")) {
      const nameHtml = `
        <div class="form-group">
          <label>Your Full Name</label>
          <input type="text" id="buyerName" placeholder="e.g. Kwame Mensah">
        </div>
        <div class="form-group">
          <label>Your Email Address</label>
          <input type="email" id="buyerEmail" placeholder="e.g. kwame@email.com">
          <p class="hint">We'll send your receipt here</p>
        </div>
      `;
      // Insert after the quantity field
      const quantityField = document.getElementById("quantity").closest(".form-group");
      if (quantityField) {
        quantityField.insertAdjacentHTML("afterend", nameHtml);
      }
    }
  }

  // Check Paystack status
  if (window.paystack) {
    window.paystack
      .init()
      .then((initialized) => {
        if (initialized) {
          console.log("✅ Paystack ready for checker page");
          // Update button text
          const buyBtn = document.getElementById("buyBtn");
          if (buyBtn) {
            buyBtn.innerHTML = '<i class="fas fa-credit-card"></i> Pay with Paystack';
          }
        }
      })
      .catch((err) => {
        console.warn("Paystack not available, using legacy payment");
      });
  }
});
