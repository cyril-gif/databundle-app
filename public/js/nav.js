// Injects a shared navbar + footer into every page.
// Each page just needs: <div id="navbar"></div> and <div id="footer"></div>

function renderNav(activePage) {
  const token = localStorage.getItem("db_token");
  const userName = localStorage.getItem("db_name");

  const navEl = document.getElementById("navbar");
  if (!navEl) return;

  navEl.innerHTML = `
    <nav class="navbar">
      <div class="container">
        <a href="index.html" class="logo">Ancestor<span>Data</span>Hub</a>
        <ul class="nav-links" id="navLinks">
          <li><a href="index.html" class="${activePage === "home" ? "active" : ""}">Home</a></li>
          <li><a href="buy.html" class="${activePage === "buy" ? "active" : ""}">Buy Data</a></li>
          <li><a href="checker.html" class="${activePage === "checker" ? "active" : ""}">Check BECE Results</a></li>
          <li><a href="refer.html" class="${activePage === "refer" ? "active" : ""}">Refer & Earn</a></li>
        </ul>
        <div class="nav-cta">
          ${
            token
              ? `<span class="hint" style="margin-right:4px;">Hi, ${userName || "there"}</span>
                 <button class="btn btn-outline" onclick="logout()">Sign Out</button>`
              : 
                <a href="buy.html" class="btn btn-primary">Buy Data</a>`
                 
          }
        </div>
        <button class="menu-toggle" id="menuToggle">☰</button>
      </div>
    </nav>
  `;

  document.getElementById("menuToggle")?.addEventListener("click", () => {
    const links = document.getElementById("navLinks");
    links.style.display = links.style.display === "flex" ? "none" : "flex";
    links.style.flexDirection = "column";
    links.style.position = "absolute";
    links.style.top = "68px";
    links.style.left = "0";
    links.style.right = "0";
    links.style.background = "#13131a";
    links.style.padding = "20px";
  });
}

function renderFooter() {
  const footerEl = document.getElementById("footer");
  if (!footerEl) return;

  footerEl.innerHTML = `
    <footer>
      <div class="container footer-grid">
        <div>
          <div class="logo" style="margin-bottom:10px;">Ancestor<span>Data</span>Hub</div>
          <p>Ghana's fast and reliable data bundle & BECE result checker platform.</p>
        </div>
        <ul class="footer-links">
          <li><a href="#">About Us</a></li>
          <li><a href="#">Terms of Service</a></li>
          <li><a href="#">Refund Policy</a></li>
          <li><a href="https://wa.me/233554320613" target="_blank">WhatsApp Support</a></li>
        </ul>
      </div>
      <div class="container" style="margin-top:24px; color:var(--text-dim);">
        &copy; ${new Date().getFullYear()} AncestorDatahub. All rights reserved.
      </div>
    </footer>
  `;
}

function logout() {
  localStorage.removeItem("db_token");
  localStorage.removeItem("db_name");
  localStorage.removeItem("db_phone");
  window.location.href = "index.html";
}
