/* ============================================================
   dashboard.js  –  User dashboard
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {


// Guard: must be logged in
if (!Auth.requireAuth()) return;

// ── Null-safe element setter ───────────────────────────────────
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// ── Logout ────────────────────────────────────────────────────
function logout() { Auth.clearSession(); window.location.replace('login.html?logout=1'); }
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

    setText('greetName',   user.name.split(' ')[0]);
    setText('timeGreet',   timeGreeting());
    setText('sbName',      user.name);
    setText('sbRole',      user.role || 'citizen');
    setText('sbAvatar',    user.name.charAt(0).toUpperCase());
    setText('statScore',   score);
    setText('scoreCenter', score);
    setText('scoreTitle',  getScoreTitle(score));
    setText('scoreDesc',   score >= 200 ? 'Outstanding civic engagement! You are a true CleanCity champion.' :
                           score >= 100 ? 'Great work! Keep reporting and voting to reach Champion status.' :
                           score >= 50  ? 'You\'re making a real difference. Keep it up!' :
                           'Start reporting waste and voting on complaints to build your score.');

    const circumference = 251;
    const pct = Math.min(score / 200, 1);
    setTimeout(() => {
      const ring = document.getElementById('scoreRing');
      if (ring) ring.style.strokeDashoffset = circumference - pct * circumference;
    }, 300);
  } catch {
    Toast.show('Failed to load profile', 'error');
  }

  // 2. Complaints
  try {
    const complaints = await http(API.complaints.my);
    setText('statComplaints', complaints.length);
    setText('statResolved',   complaints.filter(c => c.status === 'resolved').length);

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
    setText('statComplaints', '0');
    setText('statResolved',   '0');
  }

  // 3. Votes
  try {
    const votes = await http(API.votes.my);
    setText('statVotes', votes.length);

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
    setText('statVotes', '0');
  }
}

loadDashboard();

// ── Notification badge in sidebar ─────────────────────────────
async function loadNotifBadge() {
  try {
    const notifs = await http(API.notifications.list);
    const unread = notifs.filter(n => !n.read).length;
    const badge  = document.getElementById('sbBadge');
    if (badge && unread > 0) {
      badge.textContent = unread;
      badge.style.display = 'inline-block';
    }
  } catch {}
}
loadNotifBadge();

}); // end DOMContentLoaded