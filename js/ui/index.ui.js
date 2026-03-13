/* ============================================================
   index.js  –  Home / Landing page
   ============================================================ */

// ── Navbar scroll effect ──────────────────────────────────────
const _navbar = document.getElementById("mainNav") || document.getElementById("navbar");
if (_navbar) {
  window.addEventListener("scroll", () => {
    _navbar.classList.toggle("scrolled", window.scrollY > 20);
  });
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
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

// ── Animated counter ──────────────────────────────────────────
function animateCounter(el, target) {
  if (!el) return;
  if (!target) { el.textContent = "0"; return; }
  const duration = 1500;
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString() + (target >= 1000 ? "+" : "");
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
      // Use API_BASE_URL from api.config.js — works on both localhost and production
      fetch(API.complaints.public)
        .then((r) => (r.ok ? r.json() : []))
        .then((complaints) => {
          const all = Array.isArray(complaints) ? complaints : [];
          const total    = all.length;
          const resolved = all.filter((c) => c.status === "resolved").length;
          const citizens = Math.max(1, Math.round(total * 0.6));

          animateCounter(document.getElementById("stat-reports"),  total);
          animateCounter(document.getElementById("bar-reports"),   total);
          animateCounter(document.getElementById("stat-resolved"), resolved);
          animateCounter(document.getElementById("bar-resolved"),  resolved);
          animateCounter(document.getElementById("stat-citizens"), citizens);
          animateCounter(document.getElementById("bar-citizens"),  citizens);
        })
        .catch(() => {});
    }
  });
});

const heroStats = document.querySelector(".hero-stats");
if (heroStats) statsObserver.observe(heroStats);