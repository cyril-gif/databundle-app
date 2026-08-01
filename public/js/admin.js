renderNav("admin");
renderFooter();

// Guard: only admins get past this page
const role = localStorage.getItem("db_role");
const token = localStorage.getItem("db_token");
if (!token || role !== "admin") {
  window.location.href = "signin.html";
}

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 6000);
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.getElementById("ordersTab").style.display = tab === "orders" ? "block" : "none";
  document.getElementById("vouchersTab").style.display = tab === "vouchers" ? "block" : "none";
  if (tab === "vouchers") loadVoucherStock();
}

// --- Wallet ---
async function loadWallet() {
  const el = document.getElementById("walletBalance");
  el.textContent = "…";
  try {
    const res = await api.get("/admin/wallet-balance");
    el.textContent = `GH₵${res.balance}`;
  } catch (err) {
    el.textContent = "Error";
    showAlert(err.message);
  }
}

// --- Reconcile ---
async function reconcile() {
  const btn = document.getElementById("reconcileBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>`;
  try {
    const res = await api.post("/admin/reconcile-orders", {});
    showAlert(res.message, "success");
    loadOrders();
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Reconcile Now";
  }
}

// --- Orders ---
const STATUS_LABELS = {
  pending_payment: "Pending Payment",
  processing: "Processing",
  delivered: "Delivered",
  failed: "Failed",
};

async function loadOrders() {
  const status = document.getElementById("statusFilter").value;
  const body = document.getElementById("ordersBody");
  body.innerHTML = `<tr><td colspan="7" class="hint">Loading orders…</td></tr>`;

  try {
    const orders = await api.get(`/orders${status ? `?status=${status}` : ""}`);

    if (!orders.length) {
      body.innerHTML = `<tr><td colspan="7" class="hint">No orders found.</td></tr>`;
    } else {
      body.innerHTML = orders
        .map(
          (o) => `
        <tr>
          <td>${o.reference}</td>
          <td>${o.network}</td>
          <td>${o.bundleSize}</td>
          <td>${o.deliveryPhone}</td>
          <td>GH₵${o.price}</td>
          <td><span class="status-chip ${o.status}">${STATUS_LABELS[o.status] || o.status}</span></td>
          <td>${new Date(o.createdAt).toLocaleString()}</td>
        </tr>`
        )
        .join("");
    }

    // Update stat cards from the unfiltered set when no filter applied
    if (!status) {
      document.getElementById("pendingCount").textContent = orders.filter(
        (o) => o.status === "processing" || o.status === "pending_payment"
      ).length;
      document.getElementById("deliveredCount").textContent = orders.filter(
        (o) => o.status === "delivered"
      ).length;
    }
  } catch (err) {
    body.innerHTML = `<tr><td colspan="7" class="error-text">${err.message}</td></tr>`;
  }
}

// --- Vouchers ---
async function loadVoucherStock() {
  const grid = document.getElementById("stockGrid");
  grid.innerHTML = `<p class="hint">Loading stock…</p>`;
  try {
    const stock = await api.get("/checker/vouchers/stock");
    if (!stock.length) {
      grid.innerHTML = `<p class="hint">No voucher stock loaded yet.</p>`;
      return;
    }
    grid.innerHTML = stock
      .map(
        (s) => `
      <div class="stat-card">
        <div class="label">${s._id.year} — ${s._id.used ? "Used" : "Available"}</div>
        <div class="value">${s.count}</div>
      </div>`
      )
      .join("");
  } catch (err) {
    grid.innerHTML = `<p class="error-text">${err.message}</p>`;
  }
}

async function uploadVouchers() {
  const year = document.getElementById("voucherYear").value;
  const raw = document.getElementById("voucherInput").value.trim();

  if (!raw) return showAlert("Paste at least one voucher line first");

  const vouchers = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, pin] = line.split(",").map((v) => v.trim());
      return { serial, pin };
    });

  if (vouchers.some((v) => !v.serial || !v.pin)) {
    return showAlert("Each line must be in the format: serial,pin");
  }

  const btn = document.getElementById("uploadVoucherBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Uploading…`;

  try {
    const res = await api.post("/checker/vouchers/bulk", { year, vouchers });
    showAlert(res.message, "success");
    document.getElementById("voucherInput").value = "";
    loadVoucherStock();
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Upload Vouchers";
  }
}

// Init
loadWallet();
loadOrders();
