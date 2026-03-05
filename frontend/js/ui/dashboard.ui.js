/* ============================================================
   dashboard.js  –  User dashboard
   ============================================================ */

// Guard: must be logged in
if (!Auth.requireAuth()) throw new Error('Not authenticated');

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Logout ────────────────────────────────────────────────────
function logout() {
  // Clear all auth keys explicitly
  ['cc_token','cc_user','cc_temp_token','cc_temp_phone'].forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
  // Redirect to login with cache-bust so login.ui.js re-evaluates Auth.isLoggedIn()
  window.location.replace('login.html?logout=1');
}
window.logout = logout;

// ── Utilities ─────────────────────────────────────────────────
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const categoryIcons = {
  garbage: '🗑️', drainage: '💧', illegal_dumping: '⚠️',
  broken_infrastructure: '🔧', public_hygiene: '🧹', other: '📌',
};

function getScoreTitle(score) {
  if (score >= 200) return 'Eco Champion 🏆';
  if (score >= 100) return 'Green Guardian 🌿';
  if (score >= 50)  return 'Eco Warrior ⚡';
  return 'Eco Novice 🌱';
}

function statusLabel(s) {
  return { submitted: 'Submitted', in_progress: 'In Progress', resolved: 'Resolved' }[s] || s;
}
function statusBadgeClass(s) {
  return { submitted: 'badge-pending', in_progress: 'badge-in-progress', resolved: 'badge-resolved' }[s] || 'badge-pending';
}

// ── Load dashboard data ───────────────────────────────────────
async function loadDashboard() {
  // 1. User profile
  try {
    const user  = await http(API.auth.me);
    const score = user.cleanlinessScore || 0;

    document.getElementById('greetName').textContent   = user.name.split(' ')[0];
    document.getElementById('timeGreet').textContent   = timeGreeting();
    document.getElementById('sidebarName').textContent = user.name;
    document.getElementById('sidebarRole').textContent = user.role || 'citizen';
    document.getElementById('userAvatar').textContent  = user.name.charAt(0).toUpperCase();
    document.getElementById('statScore').textContent   = score;
    document.getElementById('scoreCenter').textContent = score;
    document.getElementById('scoreTitle').textContent  = getScoreTitle(score);

    // Animate SVG ring (circumference = 2πr = 2π×40 ≈ 251)
    const circumference = 251;
    const pct = Math.min(score / 200, 1);
    setTimeout(() => {
      document.getElementById('scoreRing').style.strokeDashoffset =
        circumference - pct * circumference;
    }, 300);
  } catch {
    Toast.show('Failed to load profile', 'error');
  }

  // 2. Complaints
  try {
    const complaints = await http(API.complaints.my);
    document.getElementById('statComplaints').textContent = complaints.length;
    document.getElementById('statResolved').textContent   =
      complaints.filter(c => c.status === 'resolved').length;

    const listEl = document.getElementById('myComplaintsList');
    if (!complaints.length) {
      listEl.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-state-icon">📋</div>' +
        '<div class="empty-state-title">No complaints yet</div>' +
        '<div class="empty-state-text"><a href="report.html" style="color:var(--green-600);font-weight:600">File your first report →</a></div>' +
        '</div>';
    } else {
      listEl.innerHTML = complaints.slice(0, 5).map(c => `
        <div class="complaint-item">
          <div class="complaint-cat-icon">${categoryIcons[c.category] || '📌'}</div>
          <div style="flex:1;min-width:0">
            <div class="complaint-item-desc">${c.description || c.category}</div>
            <div class="complaint-item-meta">${c.address || 'No location'} · ${timeAgo(c.created_at)}</div>
          </div>
          <span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span>
        </div>`).join('');
    }
  } catch {
    document.getElementById('statComplaints').textContent = '0';
    document.getElementById('statResolved').textContent   = '0';
  }

  // 3. Votes
  try {
    const votes = await http(API.votes.my);
    document.getElementById('statVotes').textContent = votes.length;

    const actEl = document.getElementById('activityList');
    if (!votes.length) {
      actEl.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-state-icon">🗳️</div>' +
        '<div class="empty-state-title">No votes cast yet</div>' +
        '<div class="empty-state-text"><a href="complaints.html" style="color:var(--green-600);font-weight:600">Browse complaints →</a></div>' +
        '</div>';
    } else {
      actEl.innerHTML = votes.slice(0, 5).map(v => `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div class="activity-text">Voted on a community complaint</div>
            <div class="activity-time">${timeAgo(v.created_at)}</div>
          </div>
        </div>`).join('');
    }
  } catch {
    document.getElementById('statVotes').textContent = '0';
  }
}

loadDashboard();

// ── Notification badge in sidebar ─────────────────────────────
async function loadNotifBadge() {
  try {
    const notifs = await http(API.notifications.list);
    const unread = notifs.filter(n => !n.read).length;
    const badge  = document.getElementById('sidebarNotifBadge');
    if (badge && unread > 0) {
      badge.textContent = unread;
      badge.style.display = 'inline-block';
    }
  } catch {}
}
loadNotifBadge();