/* ============================================================
   index.js  –  Home / Landing page
   ============================================================ */

// ── Navbar scroll effect ──────────────────────────────────────
window.addEventListener("scroll", () => {
  document
    .getElementById("navbar")
    .classList.toggle("scrolled", window.scrollY > 20);
});

// ── Hamburger menu ────────────────────────────────────────────
document.getElementById("hamburger").addEventListener("click", function () {
  this.classList.toggle("open");
  document.getElementById("mobileMenu").classList.toggle("open");
});

// ── Auth-aware nav actions ────────────────────────────────────
if (Auth.isLoggedIn()) {
  document.getElementById("navActions").innerHTML =
    '<a href="dashboard.html" class="btn btn-secondary btn-sm">Dashboard</a>' +
    '<a href="report.html" class="btn btn-primary btn-sm">Report Now</a>';
}

// ── Scroll reveal ─────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("revealed");
    });
  },
  { threshold: 0.1 },
);
document
  .querySelectorAll(".reveal")
  .forEach((el) => revealObserver.observe(el));

// ── Animated counter ──────────────────────────────────────────
function animateCounter(el, target) {
  if (!el) return;
  if (!target) {
    el.textContent = "0";
    return;
  }
  const duration = 1500;
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent =
      Math.round(eased * target).toLocaleString() + (target >= 1000 ? "+" : "");
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Live stats (loaded once hero-stats enters viewport) ───────
let statsLoaded = false;
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting && !statsLoaded) {
      statsLoaded = true;
      fetch(`http://${window.location.hostname}:5000/api/complaints/public`)
        .then((r) => (r.ok ? r.json() : []))
        .then((complaints) => {
          const all = Array.isArray(complaints) ? complaints : [];
          const total = all.length;
          const resolved = all.filter((c) => c.status === "resolved").length;
          const citizens = Math.max(1, Math.round(total * 0.6));

          animateCounter(document.getElementById("stat-reports"), total);
          animateCounter(document.getElementById("bar-reports"), total);
          animateCounter(document.getElementById("stat-resolved"), resolved);
          animateCounter(document.getElementById("bar-resolved"), resolved);
          animateCounter(document.getElementById("stat-citizens"), citizens);
          animateCounter(document.getElementById("bar-citizens"), citizens);
        })
        .catch(() => {});
    }
  });
});

const heroStats = document.querySelector(".hero-stats");
if (heroStats) statsObserver.observe(heroStats);
