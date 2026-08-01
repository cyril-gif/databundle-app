renderNav("");
renderFooter();

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 6000);
}

function saveSession(data) {
  localStorage.setItem("db_token", data.token);
  localStorage.setItem("db_name", data.name);
  localStorage.setItem("db_phone", data.phone);
}

// LOGIN (signin.html)
async function login() {
  const phone = document.getElementById("phone").value.trim();
  const pin = document.getElementById("pin").value.trim();

  if (!/^0\d{9}$/.test(phone)) return showAlert("Enter a valid phone number");
  if (!/^\d{4}$/.test(pin)) return showAlert("PIN must be 4 digits");

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Signing in…`;

  try {
    const data = await api.post("/auth/login", { phone, pin });
    saveSession(data);
    window.location.href = "index.html";
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

// SIGNUP (signup.html)
async function signup() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const pin = document.getElementById("pin").value.trim();
  const referralCode = document.getElementById("referralCode")?.value.trim();

  if (!name) return showAlert("Enter your full name");
  if (!/^0\d{9}$/.test(phone)) return showAlert("Enter a valid phone number");
  if (!/^\d{4}$/.test(pin)) return showAlert("PIN must be exactly 4 digits");

  const btn = document.getElementById("signupBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Creating account…`;

  try {
    const data = await api.post("/auth/register", { name, phone, pin, referralCode });
    saveSession(data);
    window.location.href = "index.html";
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

// Pre-fill referral code from URL (?ref=CODE) on signup page
const refParam = new URLSearchParams(window.location.search).get("ref");
if (refParam && document.getElementById("referralCode")) {
  document.getElementById("referralCode").value = refParam;
}
