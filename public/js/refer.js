renderNav("refer");
renderFooter();

function showAlert(message, type = "error") {
  const box = document.getElementById("alertBox");
  box.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => (box.innerHTML = ""), 5000);
}

async function loadReferralStats() {
  const token = localStorage.getItem("db_token");

  if (!token) {
    document.getElementById("loggedOutView").style.display = "block";
    return;
  }

  try {
    const stats = await api.get("/referrals/my-stats");
    document.getElementById("loggedInView").style.display = "block";
    document.getElementById("referralLink").value = stats.referralLink;
    document.getElementById("totalReferrals").textContent = stats.totalReferrals;
    document.getElementById("totalEarned").textContent = `GH₵${stats.totalEarned}`;
    document.getElementById("pendingCount").textContent = stats.pendingCount;
  } catch (err) {
    showAlert(err.message);
  }
}

function copyLink() {
  const input = document.getElementById("referralLink");
  input.select();
  navigator.clipboard.writeText(input.value);
  showAlert("Referral link copied!", "success");
}

async function withdraw() {
  try {
    const res = await api.post("/referrals/withdraw", {});
    showAlert(res.message, "success");
    loadReferralStats();
  } catch (err) {
    showAlert(err.message);
  }
}

loadReferralStats();
