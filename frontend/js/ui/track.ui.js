/* ============================================================
   track.js  –  Complaint status tracker
   ============================================================ */

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Auth-aware nav ────────────────────────────────────────────
document.getElementById('navActions').innerHTML = Auth.isLoggedIn()
  ? `<a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>
     <a href="profile.html" class="btn btn-ghost btn-sm">👤 Profile</a>
     <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>`
  : '<a href="login.html" class="btn btn-primary btn-sm">Login</a>';

// ── Constants ─────────────────────────────────────────────────
const categoryLabels = {
  garbage: 'Garbage Overflow', drainage: 'Drainage Problem',
  illegal_dumping: 'Illegal Dumping', broken_infrastructure: 'Broken Infrastructure',
  public_hygiene: 'Public Hygiene', other: 'Other',
};

// Backend status keys: submitted → in_progress → resolved
const STATUS_STEPS = [
  { key: 'submitted',   label: 'Submitted',   desc: 'Your complaint has been received and queued for review.' },
  { key: 'in_progress', label: 'In Progress',  desc: 'The complaint is being actively worked on by the authorities.' },
  { key: 'resolved',    label: 'Resolved',     desc: 'Issue has been resolved. Thank you for your contribution! 🌿' },
];
const STATUS_BADGE = {
  submitted:   'badge-pending',
  in_progress: 'badge-in-progress',
  resolved:    'badge-resolved',
};

// ── Utility ───────────────────────────────────────────────────

// ── Render result ─────────────────────────────────────────────
function renderResult(data) {
  const container   = document.getElementById('trackResult');
  const complaintId = data._id || '';
  const curStatus   = data.status || 'submitted';
  const curIdx      = STATUS_STEPS.findIndex(s => s.key === curStatus);
  const badgeClass  = STATUS_BADGE[curStatus] || 'badge-pending';
  const badgeLabel  = curIdx >= 0 ? STATUS_STEPS[curIdx].label : curStatus;

  // Map status_history entries (keyed by backend status values)
  const historyMap = {};
  (data.status_history || []).forEach(h => { historyMap[h.status] = h.updated_at; });

  const timelineHTML = STATUS_STEPS.map(({ key, label, desc }, i) => {
    const isReached  = i <= curIdx;
    const isCurrent  = i === curIdx && key !== 'resolved';
    const dotClass   = isReached ? (isCurrent ? 'current' : 'done') : '';
    const dotContent = key === 'resolved' ? '✓' : String(i + 1);
    const date       = historyMap[key] ? timeAgo(historyMap[key]) : '';
    return `
      <div class="timeline-item">
        <div class="timeline-dot ${dotClass}">${dotContent}</div>
        <div class="timeline-item-title ${isReached ? 'active' : ''}">${label}</div>
        ${date ? `<div class="timeline-item-date">${date}</div>` : ''}
        ${isReached ? `<div class="timeline-item-desc">${desc}</div>` : ''}
      </div>`;
  }).join('');

  // Line fill: 0% | 50% | 100%
  const progressPct = curIdx <= 0 ? 0 : curIdx === 1 ? 50 : 100;

  container.innerHTML = `
    <div class="complaint-detail-card" style="animation:fadeInUp 0.4s ease both">
      <div class="complaint-detail-header">
        <div>
          <h2 style="font-family:var(--font-display);font-size:1.3rem;font-weight:600;color:var(--gray-900);margin-bottom:0.5rem">
            ${categoryLabels[data.category] || data.category || 'Complaint'}
          </h2>
          <p style="font-size:0.85rem;color:var(--gray-400);word-break:break-all">ID: ${complaintId}</p>
        </div>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="complaint-detail-body">
        <div class="detail-grid">
          <div><div class="detail-label">Filed On</div><div class="detail-value">${timeAgo(data.created_at)}</div></div>
          <div><div class="detail-label">Location</div><div class="detail-value">${data.address || '—'}</div></div>
          <div><div class="detail-label">Priority</div><div class="detail-value" style="text-transform:capitalize">${data.priority || 'normal'}</div></div>
        </div>
        <div>
          <div class="detail-label" style="margin-bottom:0.5rem">Description</div>
          <div style="font-size:0.925rem;color:var(--gray-700);line-height:1.7">${data.description || '—'}</div>
        </div>
        ${data.images && data.images.length ? `
          <div style="margin-top:1.25rem">
            <div class="detail-label" style="margin-bottom:0.5rem">Photos</div>
            <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
              ${data.images.map(img => `<img src="${img}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">`).join('')}
            </div>
          </div>` : ''}
        <div style="margin-top:1.5rem">
          <a href="complaints.html" class="btn btn-ghost btn-sm">← All Complaints</a>
        </div>
      </div>
    </div>

    <div class="timeline-card" style="animation:fadeInUp 0.4s ease 0.1s both">
      <div class="timeline-title">📊 Status Timeline</div>
      <div class="timeline">
        <div class="timeline-line-fill" id="timelineFill"></div>
        ${timelineHTML}
      </div>
    </div>`;

  container.style.display = 'block';

  setTimeout(() => {
    const fill = document.getElementById('timelineFill');
    if (fill) fill.style.height = progressPct + '%';
  }, 200);
}

// ── Track complaint ───────────────────────────────────────────
async function trackComplaint() {
  const id = document.getElementById('trackInput').value.trim();
  if (!id) { Toast.show('Please enter a complaint ID', 'warning'); return; }

  const btn       = document.getElementById('trackBtn');
  const container = document.getElementById('trackResult');

  btn.disabled    = true;
  btn.textContent = 'Tracking…';

  try {
    const data = await http(API.complaints.byId(id));
    renderResult(data);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    container.style.display = 'block';
    container.innerHTML = `
      <div class="not-found" style="animation:fadeInUp 0.4s ease both">
        <div style="font-size:3rem;margin-bottom:1rem">🔍</div>
        <h3 style="font-weight:700;margin-bottom:0.5rem">Complaint Not Found</h3>
        <p style="color:var(--gray-500)">No complaint found with ID: <strong>${id}</strong></p>
        <p style="font-size:0.8rem;color:var(--gray-400);margin-top:0.5rem">Make sure you copied the full ID correctly</p>
      </div>`;
  }

  btn.disabled    = false;
  btn.textContent = 'Track';
}

// ── Event bindings ────────────────────────────────────────────
document.getElementById('trackBtn').addEventListener('click', trackComplaint);
document.getElementById('trackInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') trackComplaint();
});

// ── Auto-track from URL param: track.html?id=abc123 ──────────
const urlId = new URLSearchParams(window.location.search).get('id');
if (urlId) {
  document.getElementById('trackInput').value = urlId;
  trackComplaint();
}