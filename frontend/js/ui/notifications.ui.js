/* ============================================================
   notifications.ui.js  –  User notifications page
   ============================================================ */

// Guard: must be logged in
if (!Auth.requireAuth('login.html')) throw new Error('Not authenticated');

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Nav ───────────────────────────────────────────────────────
document.getElementById('navActions').innerHTML =
  '<a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>';

function logout() { Auth.clearSession(); window.location.href = 'index.html'; }
window.logout = logout;

// ── State ─────────────────────────────────────────────────────
let allNotifs  = [];
let showUnread = false;

// ── Icon + badge helper ───────────────────────────────────────
function notifIcon(type) {
  const map = {
    VOTE:          { icon: '👍', cls: 'vote',    badge: 'Vote'         },
    STATUS_UPDATE: { icon: '📋', cls: 'status',  badge: 'Status Update'},
    COMMENT:       { icon: '💬', cls: 'comment', badge: 'Comment'      },
  };
  return map[type] || { icon: '🔔', cls: 'system', badge: 'System' };
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const list = document.getElementById('notifList');
  const shown = showUnread ? allNotifs.filter(n => !n.read) : allNotifs;
  const unread = allNotifs.filter(n => !n.read).length;

  // Update summary bar
  document.getElementById('unreadSummary').innerHTML =
    unread > 0
      ? `<strong>${unread}</strong> unread notification${unread > 1 ? 's' : ''}`
      : 'All caught up! ✅';

  const markBtn = document.getElementById('markAllReadBtn');
  markBtn.style.display = unread > 0 ? '' : 'none';

  // Update unread tab badge
  document.getElementById('unreadTabBadge').textContent = unread > 0 ? `(${unread})` : '';

  if (!shown.length) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">${showUnread ? '🎉' : '🔔'}</div>
        <div class="notif-empty-title">${showUnread ? 'No unread notifications' : 'No notifications yet'}</div>
        <p style="font-size:0.9rem">${showUnread ? 'You\'re all caught up!' : 'Notifications appear here when someone votes on your reports, or your report status changes.'}</p>
        <a href="report.html" class="btn btn-primary" style="margin-top:1rem">Report an Issue →</a>
      </div>`;
    return;
  }

  list.innerHTML = shown.map(n => {
    const { icon, cls, badge } = notifIcon(n.type);
    const link = n.complaint_id ? `complaints.html` : '#';
    const time = timeAgo(n.created_at);
    return `
      <div class="notif-item ${n.read ? '' : 'unread'}"
           onclick="handleNotifClick('${n._id}', '${n.complaint_id || ''}', ${n.read})"
           id="notif-${n._id}">
        <div class="notif-icon ${cls}">${icon}</div>
        <div class="notif-body">
          <div class="notif-msg">${n.message}</div>
          <div class="notif-meta">
            <span class="notif-badge ${cls}">${badge}</span>
            <span>${time}</span>
            ${n.complaint_id ? `<a href="track.html?id=${n.complaint_id}" onclick="event.stopPropagation()" style="color:var(--green-600);font-size:0.78rem">View complaint →</a>` : ''}
          </div>
        </div>
        ${!n.read ? '<div class="notif-dot"></div>' : ''}
      </div>`;
  }).join('');
}

// ── Click notification → mark read + optionally navigate ──────
async function handleNotifClick(id, complaintId, alreadyRead) {
  if (!alreadyRead) {
    try {
      await http(API.notifications.markOne(id), { method: 'PATCH' });
      const n = allNotifs.find(n => n._id === id);
      if (n) n.read = true;
      render();
    } catch {}
  }
  if (complaintId) {
    window.location.href = `complaints.html`;
  }
}
window.handleNotifClick = handleNotifClick;

// ── Mark all read ─────────────────────────────────────────────
document.getElementById('markAllReadBtn').addEventListener('click', async () => {
  try {
    await http(API.notifications.markAll, { method: 'PATCH' });
    allNotifs.forEach(n => n.read = true);
    Toast.show('All notifications marked as read ✅');
    render();
  } catch (err) {
    Toast.show(err.message || 'Failed to mark as read', 'error');
  }
});

// ── Tabs ──────────────────────────────────────────────────────
document.getElementById('tabAll').addEventListener('click', () => {
  showUnread = false;
  document.getElementById('tabAll').classList.add('active');
  document.getElementById('tabUnread').classList.remove('active');
  render();
});
document.getElementById('tabUnread').addEventListener('click', () => {
  showUnread = true;
  document.getElementById('tabUnread').classList.add('active');
  document.getElementById('tabAll').classList.remove('active');
  render();
});

// ── Load ──────────────────────────────────────────────────────
async function loadNotifications() {
  const list = document.getElementById('notifList');
  list.innerHTML = `
    <div class="skeleton" style="height:80px;border-radius:var(--radius-lg)"></div>
    <div class="skeleton" style="height:80px;border-radius:var(--radius-lg)"></div>
    <div class="skeleton" style="height:80px;border-radius:var(--radius-lg)"></div>`;

  try {
    allNotifs = await http(API.notifications.list);
    render();
  } catch (err) {
    list.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon">⚠️</div>
        <div class="notif-empty-title">Failed to load notifications</div>
        <p style="font-size:0.9rem">Make sure the backend server is running.</p>
        <button class="btn btn-ghost btn-sm" onclick="loadNotifications()" style="margin-top:1rem">Try Again</button>
      </div>`;
  }
}

loadNotifications();
