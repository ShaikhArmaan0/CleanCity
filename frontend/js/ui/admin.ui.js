/* ============================================================
   admin.ui.js  –  CleanCity Admin Panel
   Place at: js/ui/admin.ui.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {


// Guard
if (!AdminAuth.isLoggedIn() || !AdminAuth.isAdmin()) { window.location.href = 'admin-login.html'; throw new Error('Unauthorized'); }

// ── Constants ──────────────────────────────────────────────────
const CAT_ICON  = { garbage:'🗑️', drainage:'💧', illegal_dumping:'⚠️', broken_infrastructure:'🔧', public_hygiene:'🧹', other:'📌' };
const CAT_LABEL = { garbage:'Garbage', drainage:'Drainage', illegal_dumping:'Illegal Dumping', broken_infrastructure:'Infrastructure', public_hygiene:'Public Hygiene', other:'Other' };
const ST_LABEL  = { submitted:'Submitted', in_progress:'In Progress', resolved:'Resolved' };
const PRI_HTML  = {
  high:   '<span class="pri-high">🔴 High</span>',
  normal: '<span class="pri-normal">🟡 Normal</span>',
  low:    '<span class="pri-low">🔵 Low</span>',
};

// ── State ───────────────────────────────────────────────────────
let _cPage = 1, _uPage = 1, _msgPage = 1;
let _statusTarget = null, _assignTarget = null, _deleteTarget = null, _msgTarget = null;
let _editingZoneId = null;
let _authUsersCache = [];
let _sidebarCollapsed = false;

// ── Boot ────────────────────────────────────────────────────────
(function boot() {
  const u = AdminAuth.getUser();
  if (!u) return;
  const initial = (u.name || 'A')[0].toUpperCase();
  document.getElementById('adminName').textContent    = u.name  || 'Admin';
  document.getElementById('adminRole').textContent    = u.role  || 'admin';
  document.getElementById('adminAvatar').textContent  = initial;
  document.getElementById('profileAvBig').textContent = initial;
  document.getElementById('profileName').textContent  = u.name  || 'Admin';
  document.getElementById('profileRole').textContent  = u.role  || 'admin';
  document.getElementById('pName').value  = u.name  || '';
  document.getElementById('pEmail').value = u.email || '';
  document.getElementById('pPhone').value = u.phone || '';
  document.getElementById('pArea').value  = u.area  || '';
})();

// ── Sidebar collapse ────────────────────────────────────────────
function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const layout = document.getElementById('adminLayout');
  const btn    = document.getElementById('collapseBtn');
  layout.classList.toggle('collapsed', _sidebarCollapsed);
  btn.textContent = _sidebarCollapsed ? '▶' : '◀';
  btn.title = _sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
}
window.toggleSidebar = toggleSidebar;

// ── Helpers ─────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dbc(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
window.openModal  = openModal;
window.closeModal = closeModal;
function setBadge(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = n > 0 ? 'inline-block' : 'none';
  el.textContent   = n;
}

// Close modals on backdrop click
document.querySelectorAll('.modal-overlay').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); })
);

// ── Section navigation ──────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');
  _cPage = _uPage = _msgPage = 1;
  const map = {
    overview: loadOverview, complaints: loadComplaints,
    zones: loadZones, users: loadUsers, contacts: loadContacts,
    profile: loadProfile, resolved: loadResolved,
  };
  if (map[name]) map[name]();
}
window.showSection = showSection;
window.loadOverview = loadOverview;

// ── Fixed unassigned navigation (sets filters BEFORE loading) ───
function goUnassigned() {
  // First activate section without triggering load
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('section-complaints').classList.add('active');
  document.getElementById('nav-unassigned').classList.add('active');
  _cPage = 1;
  // Set filters THEN load
  document.getElementById('cStatus').value   = 'submitted';
  document.getElementById('cAssigned').value = 'no';
  document.getElementById('cSort').value     = 'priority';
  document.getElementById('cSearch').value   = '';
  document.getElementById('cArea').value     = '';
  document.getElementById('cCat').value      = '';
  loadComplaints();
}
window.goUnassigned = goUnassigned;

function goPriority() {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('section-complaints').classList.add('active');
  document.getElementById('nav-priority').classList.add('active');
  _cPage = 1;
  // Show all unresolved sorted by priority (high first, then most votes)
  document.getElementById('cSearch').value   = '';
  document.getElementById('cArea').value     = '';
  document.getElementById('cCat').value      = '';
  document.getElementById('cAssigned').value = '';
  document.getElementById('cStatus').value   = 'submitted';   // only submitted = unresolved active
  document.getElementById('cSort').value     = 'priority';
  loadComplaints();
}
window.goPriority = goPriority;

// ══════════════════════════════════════════════════════════════
//  OVERVIEW
// ══════════════════════════════════════════════════════════════
async function loadOverview() {
  try {
    const s = await httpAdmin(API.admin.stats);
    document.getElementById('statsGrid').innerHTML = [
      { color:'var(--green-400)', icon:'👥', num:s.total_users,       label:'Total Users',       trend:`+${s.recent_users||0} this week`,       accent:'var(--green-600)' },
      { color:'#3b82f6',          icon:'📋', num:s.total_complaints,  label:'Total Reports',      trend:`+${s.recent_complaints||0} this week`,  accent:'#3b82f6' },
      { color:'var(--red)',        icon:'⚠️', num:s.unassigned,        label:'Unassigned Reports', trend:s.unassigned>0?'⚡ Needs assignment':'✓ All assigned', accent:s.unassigned>0?'var(--red)':'var(--green-600)' },
      { color:'#f59e0b',           icon:'🗺️', num:s.total_zones||0,    label:'Authority Zones',    trend:`${s.in_progress||0} in progress`,       accent:'#f59e0b' },
    ].map(b => `
      <div class="stat-box" style="border-top-color:${b.color}">
        <div class="stat-icon">${b.icon}</div>
        <div class="stat-num">${b.num}</div>
        <div class="stat-label">${b.label}</div>
        <div class="stat-trend" style="color:${b.accent}">${b.trend}</div>
      </div>`).join('');

    setBadge('badge-complaints', s.submitted  || 0);
    setBadge('badge-unassigned', s.unassigned || 0);
    setBadge('badge-contacts',   s.new_contacts || 0);

    // Category chart
    const maxC = Math.max(...(s.categories || []).map(c => c.count), 1);
    document.getElementById('catChart').innerHTML = (s.categories||[]).length
      ? s.categories.map(c => `
          <div class="bar-row">
            <div class="bar-label">${CAT_ICON[c.category]||'📌'} ${CAT_LABEL[c.category]||c.category}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c.count/maxC*100)}%"></div></div>
            <div class="bar-count">${c.count}</div>
          </div>`).join('')
      : '<div style="color:var(--gray-400);font-size:.83rem;padding:.5rem">No data yet</div>';

    // Status chart
    const tot = s.total_complaints || 1;
    document.getElementById('statusChart').innerHTML = `
      <div class="status-row"><span class="s-label" style="color:#92400e">Submitted</span><div class="s-track"><div class="s-fill" style="width:${Math.round((s.submitted||0)/tot*100)}%;background:linear-gradient(90deg,#fbbf24,#f59e0b)"></div></div><span style="font-weight:700;font-size:.85rem;color:var(--gray-700)">${s.submitted||0}</span></div>
      <div class="status-row"><span class="s-label" style="color:#1e40af">In Progress</span><div class="s-track"><div class="s-fill" style="width:${Math.round((s.in_progress||0)/tot*100)}%;background:linear-gradient(90deg,#60a5fa,#3b82f6)"></div></div><span style="font-weight:700;font-size:.85rem;color:var(--gray-700)">${s.in_progress||0}</span></div>
      <div class="status-row"><span class="s-label" style="color:var(--green-700)">Resolved</span><div class="s-track"><div class="s-fill" style="width:${Math.round((s.resolved||0)/tot*100)}%;background:linear-gradient(90deg,var(--green-400),var(--green-600))"></div></div><span style="font-weight:700;font-size:.85rem;color:var(--gray-700)">${s.resolved||0}</span></div>
      <div style="margin-top:.75rem;font-size:.78rem;color:var(--gray-400)">${Math.round((s.resolved||0)/tot*100)}% resolution rate</div>`;

    // Priority queue
    const pd = await httpAdmin(API.admin.complaints + '?sort=priority&status=submitted&per_page=6');
    const rows = pd.complaints || [];
    document.getElementById('priorityBody').innerHTML = rows.length
      ? rows.map(c => `
          <tr>
            <td>${c.images&&c.images.length?`<img src="${c.images[0]}" class="thumb" alt="">`:`<div class="thumb-ph">${CAT_ICON[c.category]||'📌'}</div>`}</td>
            <td><div class="td-b" style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.description||'—')}</div><div class="td-m">${esc(c.address||'')}</div></td>
            <td>${PRI_HTML[c.priority||'normal']}</td>
            <td style="font-weight:700;color:${(c.votes||0)>10?'var(--red)':'var(--gray-800)'}">${c.votes||0}</td>
            <td><span class="badge b-${c.status}">${ST_LABEL[c.status]||c.status}</span></td>
            <td>${c.assigned_to?`<span style="font-size:.78rem;color:#1e40af;font-weight:600">👮 ${esc(c.assigned_name||'Assigned')}</span>`:'<span style="font-size:.75rem;color:var(--gray-400)">Unassigned</span>'}</td>
            <td>
              <div class="acts">
                <button class="bx bx-b" onclick="openStatusModal('${c._id}','${c.status}')">Status</button>
                <button class="bx bx-o" onclick="openAssignModal('${c._id}')">Assign</button>
              </div>
            </td>
          </tr>`).join('')
      : `<tr><td colspan="7"><div class="empty-st"><div class="empty-st-icon">✅</div>No pending complaints</div></td></tr>`;
  } catch (e) {
    Toast.show('Failed to load stats: ' + (e.message||'Error'), 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  COMPLAINTS
// ══════════════════════════════════════════════════════════════
async function loadComplaints() {
  const params = new URLSearchParams({
    page:     _cPage,
    per_page: 20,
    search:   document.getElementById('cSearch').value.trim(),
    area:     document.getElementById('cArea').value.trim(),
    status:   document.getElementById('cStatus').value,
    category: document.getElementById('cCat').value,
    assigned: document.getElementById('cAssigned').value,
    sort:     document.getElementById('cSort').value,
  });
  const tbody = document.getElementById('complaintsBody');
  tbody.innerHTML = `<tr><td colspan="9"><div class="skeleton" style="height:40px;margin:.5rem 1rem"></div></td></tr>`;
  try {
    const data = await httpAdmin(`${API.admin.complaints}?${params}`);
    renderComplaints(data.complaints || []);
    renderPagination('c', data.page, data.pages, data.total, loadComplaints);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--red);padding:1rem;text-align:center">${esc(e.message)}</td></tr>`;
  }
}
window.loadComplaints = loadComplaints;

function renderComplaints(list) {
  const tbody = document.getElementById('complaintsBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-st"><div class="empty-st-icon">📋</div>No complaints found</div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${c.images&&c.images.length?`<img src="${c.images[0]}" class="thumb" alt="">`:`<div class="thumb-ph">${CAT_ICON[c.category]||'📌'}</div>`}</td>
      <td style="max-width:180px">
        <div class="td-b" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:165px">${esc(c.description||'—')}</div>
        <div class="td-m">${esc(c.address||'')}</div>
        ${c.region ? `<div class="td-m" style="color:var(--green-600)">🏘️ ${esc(c.region)}</div>` : ''}
        <div class="td-m">${CAT_ICON[c.category]||'📌'} ${CAT_LABEL[c.category]||c.category}</div>
      </td>
      <td>
        <div class="td-b" style="font-size:.82rem">${esc(c.reporter_name||'Unknown')}</div>
        <div class="td-m">${esc(c.reporter_phone||'')}</div>
      </td>
      <td>${PRI_HTML[c.priority||'normal']}</td>
      <td style="font-weight:700;color:${(c.votes||0)>10?'var(--red)':'var(--gray-800)'};text-align:center">${c.votes||0}</td>
      <td><span class="badge b-${c.status}">${ST_LABEL[c.status]||c.status}</span></td>
      <td>${c.assigned_to
        ? `<div style="font-size:.8rem;color:#1e40af;font-weight:600">👮 ${esc(c.assigned_name||'—')}</div><div class="td-m">${esc(c.assigned_area||'')}</div>`
        : '<span style="font-size:.75rem;color:var(--gray-400)">—</span>'}</td>
      <td class="td-m">${timeAgo(c.created_at)}</td>
      <td>
        <div class="acts">
          <button class="bx bx-g" onclick="openDetail('${c._id}')">👁</button>
          <button class="bx bx-b" onclick="openStatusModal('${c._id}','${c.status}')">Status</button>
          <button class="bx bx-o" onclick="openAssignModal('${c._id}')">Assign</button>
          <button class="bx bx-r" onclick="openDeleteModal('complaint','${c._id}','${esc(String(c.description||c._id)).slice(0,50).replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

// Status modal
function openStatusModal(id, currentStatus) {
  _statusTarget = { id };
  document.getElementById('mStatus').value  = currentStatus;
  document.getElementById('mMessage').value = '';
  openModal('statusModal');
}
window.openStatusModal = openStatusModal;

async function confirmStatus() {
  if (!_statusTarget) return;
  const status  = document.getElementById('mStatus').value;
  const message = document.getElementById('mMessage').value.trim() || 'Status updated by admin';
  try {
    await httpAdmin(API.admin.complaintStatus(_statusTarget.id), {
      method:'PATCH', body: JSON.stringify({ status, message })
    });
    Toast.show(`Status → "${ST_LABEL[status]}" — User notified via SMS ✓`);
    closeModal('statusModal');
    _refreshActiveComplaintView();
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.confirmStatus = confirmStatus;

// Assign modal
let _selectedAuthorityId = null;
let _selectedZoneData    = null; // holds selected zone info

async function openAssignModal(complaintId) {
  _assignTarget         = { id: complaintId };
  _selectedAuthorityId  = null;
  _selectedZoneData     = null;
  document.getElementById('mAssignNote').value = '';
  const listEl  = document.getElementById('mAuthorityList');
  const titleEl = document.getElementById('mAssignAreaTitle');
  listEl.innerHTML = '<div style="color:var(--gray-400);font-size:.83rem;padding:.5rem">Loading zones…</div>';
  openModal('assignModal');
  try {
    // Fetch complaint details to get its area/address
    const complaint = await httpAdmin(API.admin.complaint(complaintId));
    const area      = (complaint.area || complaint.region || complaint.address || '').trim();

    if (titleEl) {
      titleEl.textContent = area
        ? `Showing zones that cover: "${area}"`
        : 'Showing all authority zones';
    }

    // Fetch ALL zones then filter by area match
    const allZones = await httpAdmin(API.admin.zones);

    let matchingZones = [];
    if (area) {
      const areaLower = area.toLowerCase();
      // A zone matches if any of its areas partially matches the complaint area or vice-versa
      matchingZones = allZones.filter(z => {
        const zoneAreas = (z.areas || []).map(a => a.toLowerCase());
        const zoneName  = (z.name || '').toLowerCase();
        return zoneAreas.some(za => za.includes(areaLower) || areaLower.includes(za))
            || zoneName.includes(areaLower)
            || areaLower.includes(zoneName);
      });
    }
    // If no zone matches, fall back to ALL zones but label them clearly
    const showingFallback = matchingZones.length === 0;
    const zonesToShow     = showingFallback ? allZones : matchingZones;

    if (!zonesToShow.length) {
      listEl.innerHTML = '<div style="color:var(--gray-400);font-size:.83rem;padding:.5rem">⚠️ No authority zones found. Create zones with supervisors first.</div>';
      return;
    }

    if (showingFallback && titleEl) {
      titleEl.textContent = `No exact zone match for "${area}" — showing all zones`;
      titleEl.style.color = '#d97706';
    }

    listEl.innerHTML = zonesToShow.map(z => {
      const uid    = svId(z._id || '');
      const svName = z.supervisor_name  || 'No supervisor assigned';
      const svPhone= z.supervisor_phone || '—';
      const areas  = (z.areas || []).join(', ') || 'No areas defined';
      const hasSuper = !!(z.supervisor_name);
      return `
      <div class="sv-pick-card${!hasSuper ? ' sv-pick-disabled' : ''}"
           id="sv-${z._id}"
           onclick="${hasSuper ? `selectZoneSupervisor('${z._id}','${esc(z.supervisor_id||'')}','${esc(svName)}')` : "Toast.show('This zone has no supervisor assigned','warning')"}">
        <div class="sv-pick-av" style="background:${hasSuper?'var(--green-600)':'var(--gray-300)'}">
          ${(z.name||'?')[0].toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.88rem;font-weight:700;color:var(--gray-800)">${esc(z.name||'—')} Zone</div>
          <div style="font-size:.8rem;font-weight:600;color:${hasSuper?'var(--gray-700)':'var(--gray-400)'};margin-top:1px">
            👮 ${esc(svName)}
          </div>
          <div style="font-size:.74rem;color:var(--gray-400);margin-top:1px">
            📞 ${esc(svPhone)} &nbsp;·&nbsp; 🗺️ ${esc(areas)}
          </div>
          <div style="font-size:.7rem;color:var(--green-700);font-family:monospace;margin-top:2px">Zone ID: #${uid}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.75rem;color:${(z.active_complaints||0)>5?'var(--red)':'var(--gray-500)'}">
            ${z.active_complaints||0} active tasks
          </div>
          <div class="sv-check" id="svck-${z._id}" style="display:none;color:var(--green-600);font-size:1rem;margin-top:2px">✓ Selected</div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = `<div style="color:var(--red);font-size:.83rem">${esc(e.message)}</div>`;
  }
}
window.openAssignModal = openAssignModal;

function selectZoneSupervisor(zoneId, supervisorId, supervisorName) {
  // Deselect previous
  if (_selectedZoneData) {
    const prev = document.getElementById(`sv-${_selectedZoneData.zoneId}`);
    if (prev) { prev.style.borderColor = ''; prev.style.background = ''; }
    const prevCk = document.getElementById(`svck-${_selectedZoneData.zoneId}`);
    if (prevCk) prevCk.style.display = 'none';
  }
  _selectedZoneData    = { zoneId, supervisorId, supervisorName };
  _selectedAuthorityId = supervisorId; // keep compat with confirmAssign
  const card = document.getElementById(`sv-${zoneId}`);
  if (card) { card.style.borderColor = 'var(--green-400)'; card.style.background = 'var(--green-50)'; }
  const ck = document.getElementById(`svck-${zoneId}`);
  if (ck) ck.style.display = 'block';
}
window.selectZoneSupervisor = selectZoneSupervisor;



async function confirmAssign() {
  if (!_assignTarget) return;
  if (!_selectedAuthorityId) { Toast.show('Please select an authority supervisor', 'warning'); return; }
  const note = document.getElementById('mAssignNote').value.trim();
  try {
    const res = await httpAdmin(API.admin.complaintAssign(_assignTarget.id), {
      method:'PATCH', body: JSON.stringify({ authority_id: _selectedAuthorityId, note })
    });
    Toast.show(`Assigned to ${res.assigned_name||'authority'} — SMS sent ✓`);
    closeModal('assignModal');
    _authUsersCache = [];
    _selectedAuthorityId = null;
    _refreshActiveComplaintView();
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.confirmAssign = confirmAssign;

function _refreshActiveComplaintView() {
  const sec = document.getElementById('section-complaints');
  const ov  = document.getElementById('section-overview');
  if (sec && sec.classList.contains('active')) loadComplaints();
  else if (ov && ov.classList.contains('active')) loadOverview();
}

// Complaint detail
async function openDetail(id) {
  document.getElementById('detailContent').innerHTML = '<div class="skeleton" style="height:200px"></div>';
  openModal('detailModal');
  try {
    const c = await httpAdmin(API.admin.complaint(id));
    const imgs = (c.images || []).slice(0, 3);
    document.getElementById('detailContent').innerHTML = `
      ${imgs.length ? `<div style="display:flex;gap:.5rem;margin-bottom:.75rem">${imgs.map(i => `<img src="${i}" style="flex:1;height:150px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--gray-100)">`).join('')}</div>` : ''}
      <div class="detail-sec">
        <div class="detail-sec-title">Report Info</div>
        <div class="detail-grid">
          <div class="di"><label>Category</label><span>${CAT_ICON[c.category]||''} ${CAT_LABEL[c.category]||c.category}</span></div>
          <div class="di"><label>Status</label><span><span class="badge b-${c.status}">${ST_LABEL[c.status]||c.status}</span></span></div>
          <div class="di"><label>Priority</label><span>${PRI_HTML[c.priority||'normal']}</span></div>
          <div class="di"><label>Votes</label><span style="color:var(--green-600);font-weight:700">${c.vote_count||0}</span></div>
          <div class="di"><label>Address / Area</label><span>${esc(c.address||'—')}</span></div>
          <div class="di"><label>Submitted</label><span>${timeAgo(c.created_at)}</span></div>
        </div>
        <div style="margin-top:.6rem"><label style="font-size:.7rem;color:var(--gray-400);text-transform:uppercase;display:block;margin-bottom:4px">Description</label>
        <div style="font-size:.85rem;color:var(--gray-600)">${esc(c.description||'—')}</div></div>
      </div>
      ${c.reporter ? `
      <div class="detail-sec">
        <div class="detail-sec-title">Reporter</div>
        <div class="detail-grid">
          <div class="di"><label>Name</label><span>${esc(c.reporter.name||'—')}</span></div>
          <div class="di"><label>Phone</label><span>${esc(c.reporter.phone||'—')}</span></div>
          <div class="di"><label>Score</label><span style="color:var(--green-600);font-weight:700">${c.reporter.cleanlinessScore||0}</span></div>
          <div class="di"><label>Role</label><span><span class="badge b-${c.reporter.role}">${c.reporter.role}</span></span></div>
        </div>
      </div>` : ''}
      ${c.assigned_authority ? `
      <div class="detail-sec" style="border-left:3px solid #3b82f6">
        <div class="detail-sec-title">👮 Assigned Authority</div>
        <div class="detail-grid">
          <div class="di"><label>Name</label><span>${esc(c.assigned_authority.name||'—')}</span></div>
          <div class="di"><label>Area</label><span>${esc(c.assigned_authority.area||'—')}</span></div>
          <div class="di"><label>Phone</label><span>${esc(c.assigned_authority.phone||'—')}</span></div>
          <div class="di"><label>Assigned</label><span>${timeAgo(c.assigned_at)}</span></div>
        </div>
        ${c.assigned_note ? `<div style="margin-top:.5rem;font-size:.8rem;color:var(--gray-500)">📝 ${esc(c.assigned_note)}</div>` : ''}
      </div>` : ''}
      ${(c.status_history||[]).length ? `
      <div class="detail-sec">
        <div class="detail-sec-title">Status History</div>
        ${[...(c.status_history||[])].reverse().map(h => `
          <div class="history-item">
            <div class="h-dot" style="background:${h.status==='resolved'?'var(--green-500)':h.status==='in_progress'?'#3b82f6':'#f59e0b'}"></div>
            <div><div class="h-text">${ST_LABEL[h.status]||h.status} — ${esc(h.message||'')}</div><div class="h-time">${timeAgo(h.updated_at)}</div></div>
          </div>`).join('')}
      </div>` : ''}
      ${c.comments&&c.comments.length ? `
      <div class="detail-sec">
        <div class="detail-sec-title">Comments (${c.comments.length})</div>
        ${c.comments.slice(0,5).map(cm => `<div style="padding:.5rem 0;border-bottom:1px solid var(--gray-50)"><div style="font-size:.83rem;color:var(--gray-600)">${esc(cm.text||cm.comment||'')}</div><div style="font-size:.72rem;color:var(--gray-400);margin-top:2px">${esc(cm.user_name||'')} · ${timeAgo(cm.created_at)}</div></div>`).join('')}
      </div>` : ''}
      <div style="display:flex;gap:.6rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--gray-100)">
        <button class="bx bx-b" onclick="closeModal('detailModal');openStatusModal('${c._id}','${c.status}')">✏️ Update Status</button>
        <button class="bx bx-o" onclick="closeModal('detailModal');openAssignModal('${c._id}')">👮 Assign</button>
      </div>`;
  } catch (e) {
    document.getElementById('detailContent').innerHTML = `<div style="color:var(--red);padding:1rem">${esc(e.message)}</div>`;
  }
}
window.openDetail = openDetail;

// ══════════════════════════════════════════════════════════════
//  AUTHORITY ZONES
// ══════════════════════════════════════════════════════════════
// Generate deterministic 8-digit supervisor ID from MongoDB _id
function svId(id) {
  if (!id) return '00000000';
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = (Math.imul(31, h) + id.charCodeAt(i)) | 0; }
  return String(Math.abs(h) % 100000000).padStart(8, '0');
}

async function loadZones() {
  const container = document.getElementById('zoneGrid');
  container.innerHTML = `
    <div class="skeleton" style="height:220px;border-radius:var(--radius-lg)"></div>
    <div class="skeleton" style="height:220px;border-radius:var(--radius-lg)"></div>`;
  try {
    const zones = await httpAdmin(API.admin.zones);
    window._zonesCache = zones; // used by assign modal

    if (!zones.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1">
          <div class="empty-st">
            <div class="empty-st-icon">🗺️</div>
            <div style="font-weight:600;color:var(--gray-600);margin-bottom:.5rem">No authority zones yet</div>
            <div style="font-size:.83rem;color:var(--gray-400)">Click "+ New Zone" to create the first zone</div>
          </div>
        </div>`;
      return;
    }
    container.innerHTML = zones.map(z => {
      const uid     = svId(z.supervisor_id || z._id);
      const svName  = z.supervisor_name  || '';
      const svPhone = z.supervisor_phone || z.supervisor_email || '';
      return `
      <div class="zone-card" onclick="openZoneDetail('${z._id}')">
        <div class="zone-card-top">
          <div>
            <div class="zone-name">${esc(z.name)}</div>
            ${z.description ? `<div class="zone-desc">${esc(z.description)}</div>` : ''}
          </div>
          <span class="badge ${(z.active_complaints||0) > 0 ? 'b-in_progress' : 'b-active'}" style="font-size:.65rem">${z.active_complaints||0} active</span>
        </div>

        <div class="zone-sv">
          <div class="zone-sv-av">${svName ? svName[0].toUpperCase() : '?'}</div>
          <div style="flex:1;min-width:0">
            ${svName
              ? `<div class="zone-sv-name">👮 ${esc(svName)}</div>
                 <div class="zone-sv-phone">📞 ${esc(svPhone) || '—'}</div>
                 <div style="font-size:.68rem;color:var(--gray-400);margin-top:1px">ID: <strong style="color:var(--green-700);font-family:monospace;letter-spacing:.05em">#${uid}</strong></div>`
              : `<div style="font-size:.8rem;color:var(--gray-400)">⚠️ No supervisor assigned</div>`
            }
          </div>
        </div>

        <div class="zone-stats">
          <div class="zone-stat">
            <div class="zone-stat-num" style="color:var(--green-600)">${z.staff_count||0}</div>
            <div class="zone-stat-label">Staff</div>
          </div>
          <div class="zone-stat">
            <div class="zone-stat-num" style="color:${(z.active_complaints||0)>5?'var(--red)':'var(--gray-800)'}">${z.active_complaints||0}</div>
            <div class="zone-stat-label">Active</div>
          </div>
          <div class="zone-stat">
            <div class="zone-stat-num" style="color:var(--green-600)">${(z.areas||[]).length}</div>
            <div class="zone-stat-label">Areas</div>
          </div>
        </div>

        ${(z.areas||[]).length ? `
        <div class="zone-areas">
          ${z.areas.slice(0,4).map(a => `<span class="area-tag">📍 ${esc(a)}</span>`).join('')}
          ${z.areas.length > 4 ? `<span class="area-tag" style="background:var(--gray-100);color:var(--gray-500)">+${z.areas.length-4} more</span>` : ''}
        </div>` : ''}

        <div class="zone-card-footer">
          <button class="bx bx-b" onclick="event.stopPropagation();openZoneModal('${z._id}')">✏️ Edit</button>
          <button class="bx bx-r" onclick="event.stopPropagation();openDeleteModal('zone','${z._id}','${esc(z.name).replace(/'/g,"\'")}')">🗑 Delete</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div style="color:var(--red);padding:1.5rem;text-align:center">${esc(e.message)}</div>`;
  }
}
window.loadZones = loadZones;

// Open zone create/edit modal
async function openZoneModal(zoneId) {
  _editingZoneId = zoneId || null;
  document.getElementById('zoneModalTitle').textContent  = zoneId ? '✏️ Edit Authority Zone' : 'Create Authority Zone';
  document.getElementById('zoneSubmitBtn').textContent   = zoneId ? 'Save Changes' : 'Create Zone';
  document.getElementById('zName').value    = '';
  document.getElementById('zDesc').value    = '';
  document.getElementById('zAreas').value   = '';
  document.getElementById('zStaff').value   = '';
  document.getElementById('zSvName').value  = '';
  document.getElementById('zSvPhone').value = '';

  // Load supervisor options (for linking to existing account - optional)
  try {
    if (!_authUsersCache.length) _authUsersCache = await httpAdmin(API.admin.authorityUsers);
    const sel = document.getElementById('zSupervisor');
    sel.innerHTML = `<option value="">— Select existing user (optional) —</option>` +
      _authUsersCache.map(u =>
        `<option value="${u._id}">${esc(u.name)} (${u.role}) — ${esc(u.phone||u.email||'')}</option>`
      ).join('');
  } catch (e) {
    document.getElementById('zSupervisor').innerHTML = '<option value="">Could not load users</option>';
  }

  // If editing, prefill values
  if (zoneId) {
    try {
      const z = await httpAdmin(API.admin.zone(zoneId));
      document.getElementById('zName').value    = z.name || '';
      document.getElementById('zDesc').value    = z.description || '';
      document.getElementById('zAreas').value   = (z.areas||[]).join(', ');
      document.getElementById('zStaff').value   = z.staff_count || 0;
      document.getElementById('zSvName').value  = z.supervisor_name || '';
      document.getElementById('zSvPhone').value = z.supervisor_phone || '';
      if (z.supervisor_id) document.getElementById('zSupervisor').value = z.supervisor_id;
    } catch (e) { Toast.show('Failed to load zone data', 'error'); }
  }
  openModal('zoneModal');
}
window.openZoneModal = openZoneModal;

async function submitZone() {
  const name    = document.getElementById('zName').value.trim();
  const svName  = document.getElementById('zSvName').value.trim();
  const svPhone = document.getElementById('zSvPhone').value.trim();
  if (!name)    { Toast.show('Zone name is required', 'warning');              return; }
  if (!svName)  { Toast.show('Supervisor name is required', 'warning');        return; }
  if (!svPhone) { Toast.show('Supervisor phone is required', 'warning');       return; }
  const payload = {
    name,
    description:      document.getElementById('zDesc').value.trim(),
    areas:            document.getElementById('zAreas').value.split(',').map(a => a.trim()).filter(Boolean),
    supervisor_name:  svName,
    supervisor_phone: svPhone,
    supervisor_id:    document.getElementById('zSupervisor').value || '',
    staff_count:      parseInt(document.getElementById('zStaff').value) || 0,
  };
  try {
    if (_editingZoneId) {
      await httpAdmin(API.admin.zone(_editingZoneId), { method:'PATCH', body: JSON.stringify(payload) });
      Toast.show('Zone updated ✓');
    } else {
      await httpAdmin(API.admin.zones, { method:'POST', body: JSON.stringify(payload) });
      Toast.show('Zone created ✓');
    }
    closeModal('zoneModal');
    _authUsersCache = [];
    loadZones();
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.submitZone = submitZone;

// Zone detail modal
async function openZoneDetail(zoneId) {
  document.getElementById('zdTitle').textContent = '🗺️ Zone Details';
  document.getElementById('zdContent').innerHTML = '<div class="skeleton" style="height:200px"></div>';
  openModal('zoneDetailModal');
  try {
    const z = await httpAdmin(API.admin.zone(zoneId));
    document.getElementById('zdTitle').textContent = `🗺️ ${z.name}`;
    const activeComplaints   = (z.complaints||[]).filter(c => c.status !== 'resolved');
    const resolvedComplaints = (z.complaints||[]).filter(c => c.status === 'resolved');
    document.getElementById('zdContent').innerHTML = `
      <!-- Zone overview -->
      <div class="detail-sec">
        <div class="detail-sec-title">Zone Overview</div>
        <div class="detail-grid">
          <div class="di"><label>Zone Name</label><span>${esc(z.name)}</span></div>
          <div class="di"><label>Staff Count</label><span style="font-weight:700;font-size:1.1rem;color:var(--green-600)">${z.staff_count||0} staff</span></div>
          <div class="di"><label>Active Tasks</label><span style="color:${(z.active_complaints||0)>5?'var(--red)':'var(--gray-800)'};font-weight:700">${z.active_complaints||0}</span></div>
          <div class="di"><label>Resolved</label><span style="color:var(--green-600);font-weight:700">${z.resolved_complaints||0}</span></div>
        </div>
        ${z.description ? `<div style="margin-top:.6rem;font-size:.83rem;color:var(--gray-500)">${esc(z.description)}</div>` : ''}
        ${(z.areas||[]).length ? `
        <div style="margin-top:.75rem">
          <div style="font-size:.7rem;color:var(--gray-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">Areas Covered</div>
          <div style="display:flex;flex-wrap:wrap;gap:.3rem">
            ${z.areas.map(a => `<span class="area-tag">📍 ${esc(a)}</span>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <!-- Supervisor -->
      ${(z.supervisor || z.supervisor_name) ? (() => {
        const sv     = z.supervisor || {};
        const svName  = sv.name  || z.supervisor_name  || '—';
        const svPhone = sv.phone || z.supervisor_phone || '—';
        const svEmail = sv.email || '—';
        const svRole  = sv.role  || 'authority';
        const svId8   = svId(z.supervisor_id || z._id);
        return `
      <div class="detail-sec" style="border-left:3px solid #3b82f6">
        <div class="detail-sec-title">👮 Supervisor Details</div>
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.85rem;background:var(--gray-50);padding:.7rem;border-radius:var(--radius-sm)">
          <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#2563eb);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:white;flex-shrink:0">${svName[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:700;font-size:.95rem;color:var(--gray-900)">${esc(svName)}</div>
            <div style="font-size:.72rem;color:var(--gray-400);font-family:monospace;letter-spacing:.06em">Supervisor ID: <strong style="color:var(--green-700)">#${svId8}</strong></div>
          </div>
          <div style="margin-left:auto"><span class="badge b-authority">${svRole}</span></div>
        </div>
        <div class="detail-grid">
          <div class="di"><label>Phone</label><span>${esc(svPhone)}</span></div>
          <div class="di"><label>Email</label><span>${esc(svEmail)}</span></div>
          ${sv.cleanlinessScore !== undefined ? `<div class="di"><label>Score</label><span style="color:var(--green-600);font-weight:700">${sv.cleanlinessScore}</span></div>` : ''}
          ${sv.created_at ? `<div class="di"><label>Member Since</label><span>${timeAgo(sv.created_at)}</span></div>` : ''}
        </div>
      </div>`;
      })() : `
      <div class="detail-sec" style="opacity:.6">
        <div style="font-size:.85rem;color:var(--gray-500);text-align:center;padding:.5rem">⚠️ No supervisor assigned to this zone</div>
      </div>`}

      <!-- Active assignments -->
      <div class="detail-sec">
        <div class="detail-sec-title">📋 Active Assignments (${activeComplaints.length})</div>
        ${activeComplaints.length ? activeComplaints.map(c => `
          <div class="zone-complaint-item">
            <div class="zcl-desc">${esc(c.description||'—')}</div>
            <div class="zcl-meta">📍 ${esc(c.address||'—')} · ${timeAgo(c.created_at)}</div>
            <div class="zcl-row">
              <span class="badge b-${c.status}">${ST_LABEL[c.status]||c.status}</span>
              ${PRI_HTML[c.priority||'normal']}
              <span style="font-size:.75rem;color:var(--gray-400)">👤 ${esc(c.reporter_name||'')}</span>
              <span style="font-size:.75rem;color:var(--gray-400)">📞 ${esc(c.reporter_phone||'')}</span>
              <span style="font-size:.75rem;color:var(--green-600)">👍 ${c.vote_count||0} votes</span>
            </div>
          </div>`).join('')
        : '<div style="font-size:.83rem;color:var(--gray-400);padding:.5rem 0">No active assignments</div>'}
      </div>

      <!-- Resolved -->
      ${resolvedComplaints.length ? `
      <div class="detail-sec" style="opacity:.8">
        <div class="detail-sec-title">✅ Resolved (${resolvedComplaints.length})</div>
        ${resolvedComplaints.slice(0,5).map(c => `
          <div class="zone-complaint-item">
            <div class="zcl-desc">${esc(c.description||'—')}</div>
            <div class="zcl-meta">📍 ${esc(c.address||'—')} · Resolved ${timeAgo(c.updated_at||c.created_at)}</div>
          </div>`).join('')}
        ${resolvedComplaints.length>5 ? `<div style="font-size:.78rem;color:var(--gray-400);padding:.4rem 0">+${resolvedComplaints.length-5} more resolved</div>` : ''}
      </div>` : ''}

      <div style="display:flex;gap:.6rem;margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--gray-100)">
        <button class="bx bx-b" onclick="closeModal('zoneDetailModal');openZoneModal('${z._id}')">✏️ Edit Zone</button>
        <button class="bx bx-r" onclick="closeModal('zoneDetailModal');openDeleteModal('zone','${z._id}','${esc(z.name).replace(/'/g,"\\'")}')">🗑 Delete Zone</button>
      </div>`;
  } catch (e) {
    document.getElementById('zdContent').innerHTML = `<div style="color:var(--red);padding:1rem">${esc(e.message)}</div>`;
  }
}
window.openZoneDetail = openZoneDetail;

// ══════════════════════════════════════════════════════════════
//  USERS  (no role change — view + disable/delete only)
// ══════════════════════════════════════════════════════════════
async function loadUsers() {
  const params = new URLSearchParams({
    page: _uPage, per_page: 20,
    search: document.getElementById('uSearch').value.trim(),
    role:   document.getElementById('uRole').value,
  });
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:40px;margin:.5rem 1rem"></div></td></tr>`;
  try {
    const data = await httpAdmin(`${API.admin.users}?${params}`);
    renderUsers(data.users || []);
    renderPagination('u', data.page, data.pages, data.total, loadUsers);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red);padding:1rem;text-align:center">${esc(e.message)}</td></tr>`;
  }
}
window.loadUsers = loadUsers;

function renderUsers(list) {
  const tbody  = document.getElementById('usersBody');
  const selfId = (AdminAuth.getUser()||{})._id;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-st"><div class="empty-st-icon">👥</div>No users found</div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const isSelf = u._id === selfId;
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--green-400),var(--green-600));display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;color:white;flex-shrink:0">${(u.name||'?')[0].toUpperCase()}</div>
          <div>
            <div class="td-b">${esc(u.name||'—')} ${isSelf?'<span style="font-size:.65rem;background:var(--green-100);color:var(--green-700);padding:1px 5px;border-radius:99px">you</span>':''}</div>
            <div class="td-m">${esc(u.email||'')}</div>
          </div>
        </div>
      </td>
      <td class="td-m">${esc(u.phone||'—')}</td>
      <td>
        <span class="badge b-${u.role}">${u.role||'citizen'}</span>
        ${u.area ? `<div class="td-m">📍 ${esc(u.area)}</div>` : ''}
      </td>
      <td><span class="badge ${u.is_active!==false?'b-active':'b-inactive'}">${u.is_active!==false?'Active':'Disabled'}</span></td>
      <td style="font-weight:700;color:var(--green-600)">${u.cleanlinessScore||0}</td>
      <td class="td-m">${timeAgo(u.created_at)}</td>
      <td>
        <div class="acts">
          <button class="bx ${u.is_active!==false?'bx-y':'bx-g'}" onclick="toggleActive('${u._id}')" ${isSelf?'disabled title="Cannot disable yourself"':''}>
            ${u.is_active!==false?'🔒 Disable':'✅ Enable'}
          </button>
          <button class="bx bx-r" onclick="openDeleteModal('user','${u._id}','${esc(u.name||'').replace(/'/g,"\\'")}')" ${isSelf?'disabled title="Cannot delete yourself"':''}>🗑 Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function toggleActive(userId) {
  try {
    const res = await httpAdmin(API.admin.userToggleActive(userId), { method:'PATCH' });
    Toast.show(`User ${res.is_active ? 'enabled ✓' : 'disabled ✓'}`);
    loadUsers();
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.toggleActive = toggleActive;

// ══════════════════════════════════════════════════════════════
//  CREATE AUTHORITY
// ══════════════════════════════════════════════════════════════
function openCreateAuthorityModal() {
  ['caName','caPhone','caEmail','caArea','caPassword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const err = document.getElementById('caError');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  openModal('createAuthorityModal');
}
window.openCreateAuthorityModal = openCreateAuthorityModal;

async function submitCreateAuthority() {
  const name     = document.getElementById('caName').value.trim();
  const phone    = document.getElementById('caPhone').value.trim();
  const email    = document.getElementById('caEmail').value.trim();
  const area     = document.getElementById('caArea').value.trim();
  const password = document.getElementById('caPassword').value.trim();
  const errEl    = document.getElementById('caError');
  const btn      = document.getElementById('caSubmitBtn');

  errEl.style.display = 'none';
  if (!name || !phone || !password) {
    errEl.textContent = 'Name, phone, and password are required.';
    errEl.style.display = 'block';
    return;
  }
  btn.disabled = true; btn.textContent = 'Creating…';
  try {
    await httpAdmin(API.admin.createAuthority, {
      method: 'POST',
      body: JSON.stringify({ name, phone, email, area, password })
    });
    Toast.show('Authority account created ✓');
    closeModal('createAuthorityModal');
    loadUsers();
  } catch (e) {
    errEl.textContent = e.message || 'Failed to create account.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}
window.submitCreateAuthority = submitCreateAuthority;

function togglePwVis(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}
window.togglePwVis = togglePwVis;

// ══════════════════════════════════════════════════════════════
//  CONTACTS
// ══════════════════════════════════════════════════════════════
async function loadContacts() {
  const params = new URLSearchParams({ page:_msgPage, per_page:20, status:document.getElementById('msgStatus').value });
  const tbody  = document.getElementById('contactsBody');
  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:40px;margin:.5rem 1rem"></div></td></tr>`;
  try {
    const data = await httpAdmin(`${API.admin.contacts}?${params}`);
    renderContacts(data.messages || []);
    renderPagination('msg', data.page, data.pages, data.total, loadContacts);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red);padding:1rem;text-align:center">${esc(e.message)}</td></tr>`;
  }
}
window.loadContacts = loadContacts;

function renderContacts(list) {
  const tbody = document.getElementById('contactsBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-st"><div class="empty-st-icon">✉️</div>No messages</div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => `
    <tr>
      <td class="td-b">${esc(m.name||'—')}</td>
      <td class="td-m">${esc(m.email||'—')}</td>
      <td><div class="td-b" style="max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.subject||'—')}</div></td>
      <td><div class="td-m" style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.message||'')}</div></td>
      <td><span class="badge ${m.status==='resolved'?'b-msg-resolved':m.status==='read'?'b-read':'b-new'}">${m.status||'new'}</span></td>
      <td class="td-m">${timeAgo(m.created_at)}</td>
      <td>
        <button class="bx bx-b" onclick="openMsgModal(
          '${m._id}',
          ${JSON.stringify(m.name||'')},
          ${JSON.stringify(m.email||'')},
          ${JSON.stringify(m.subject||'')},
          ${JSON.stringify(m.message||'')},
          '${m.status||'new'}'
        )">👁 View</button>
      </td>
    </tr>`).join('');
}

function openMsgModal(id, name, email, subject, message, status) {
  _msgTarget = { id };
  document.getElementById('mMsgFrom').textContent    = name;
  document.getElementById('mMsgEmail').textContent   = email;
  document.getElementById('mMsgSubject').textContent = subject;
  document.getElementById('mMsgBody').textContent    = message;
  document.getElementById('mMsgStatus').value        = status;
  openModal('msgModal');
  if (status === 'new') {
    httpAdmin(API.admin.contactStatus(id), { method:'PATCH', body: JSON.stringify({ status:'read' }) })
      .then(() => loadContacts()).catch(() => {});
  }
}
window.openMsgModal = openMsgModal;

async function confirmMsgStatus() {
  if (!_msgTarget) return;
  const status = document.getElementById('mMsgStatus').value;
  try {
    await httpAdmin(API.admin.contactStatus(_msgTarget.id), { method:'PATCH', body: JSON.stringify({ status }) });
    Toast.show('Status updated ✓');
    closeModal('msgModal');
    loadContacts();
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.confirmMsgStatus = confirmMsgStatus;

// ══════════════════════════════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════════════════════════════
function loadProfile() {
  const u = AdminAuth.getUser();
  if (!u) return;
  const initial = (u.name||'A')[0].toUpperCase();
  document.getElementById('profileAvBig').textContent = initial;
  document.getElementById('profileName').textContent  = u.name  || 'Admin';
  document.getElementById('profileRole').textContent  = u.role  || 'admin';
  document.getElementById('profileEmail').textContent = u.email || '—';
  document.getElementById('profilePhone').textContent = u.phone || '—';
  document.getElementById('profileArea').textContent  = u.area  ? ('📍 ' + u.area) : '';
  document.getElementById('pName').value   = u.name  || '';
  document.getElementById('pEmail').value  = u.email || '';
  document.getElementById('pPhone').value  = u.phone || '';
  document.getElementById('pArea').value   = u.area  || '';
  document.getElementById('pCurPass').value = '';
  document.getElementById('pNewPass').value = '';
  // Load stats
  httpAdmin(API.admin.stats).then(s => {
    document.getElementById('pStatResolved').textContent = s.resolved    || 0;
    document.getElementById('pStatActive').textContent   = s.in_progress || 0;
  }).catch(() => {});
}

async function saveProfileInfo() {
  const payload = {};
  const name  = document.getElementById('pName').value.trim();
  const email = document.getElementById('pEmail').value.trim();
  const phone = document.getElementById('pPhone').value.trim();
  const area  = document.getElementById('pArea').value.trim();
  if (name)  payload.name  = name;
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (area)  payload.area  = area;
  if (!Object.keys(payload).length) { Toast.show('Nothing to update', 'warning'); return; }
  try {
    const res = await httpAdmin(API.admin.profile, { method:'PATCH', body: JSON.stringify(payload) });
    if (res.user) AdminAuth.setSession(AdminAuth.getToken(), res.user);
    Toast.show('Profile updated ✓');
    const n = res.user?.name || name;
    document.getElementById('adminName').textContent     = n;
    document.getElementById('adminAvatar').textContent   = (n||'A')[0].toUpperCase();
    document.getElementById('profileAvBig').textContent  = (n||'A')[0].toUpperCase();
    document.getElementById('profileName').textContent   = n;
    document.getElementById('profileEmail').textContent  = res.user?.email || email;
    document.getElementById('profilePhone').textContent  = res.user?.phone || phone;
    document.getElementById('profileArea').textContent   = area ? ('📍 ' + area) : '';
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.saveProfileInfo = saveProfileInfo;
window.loadProfile = loadProfile;

async function savePassword() {
  const curPass = document.getElementById('pCurPass').value;
  const newPass = document.getElementById('pNewPass').value;
  if (!curPass) { Toast.show('Enter your current password', 'warning'); return; }
  if (!newPass || newPass.length < 6) { Toast.show('New password must be at least 6 characters', 'warning'); return; }
  try {
    await httpAdmin(API.admin.profile, { method:'PATCH', body: JSON.stringify({ current_password: curPass, new_password: newPass }) });
    Toast.show('Password updated ✓');
    document.getElementById('pCurPass').value = '';
    document.getElementById('pNewPass').value = '';
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.savePassword = savePassword;

// Keep old saveProfile for backward compatibility
async function saveProfile() { await saveProfileInfo(); }
window.saveProfile = saveProfile;

// ══════════════════════════════════════════════════════════════
//  DELETE (complaints, users, zones)
// ══════════════════════════════════════════════════════════════
function openDeleteModal(type, id, label) {
  _deleteTarget = { type, id };
  const typeLabel = type === 'complaint' ? 'complaint' : type === 'zone' ? 'authority zone' : 'user account and all their data';
  document.getElementById('deleteText').innerHTML =
    `Permanently delete this ${typeLabel}:<br><br><strong>"${esc(label)}"</strong><br><br>This <strong>cannot be undone</strong>.`;
  openModal('deleteModal');
}
window.openDeleteModal = openDeleteModal;

async function confirmDelete() {
  if (!_deleteTarget) return;
  const { type, id } = _deleteTarget;
  try {
    let url;
    if (type === 'complaint') url = API.admin.deleteComplaint(id);
    else if (type === 'zone') url = API.admin.zone(id);
    else                       url = API.admin.deleteUser(id);
    await httpAdmin(url, { method:'DELETE' });
    Toast.show(`${type === 'complaint' ? 'Complaint' : type === 'zone' ? 'Zone' : 'User'} deleted ✓`);
    closeModal('deleteModal');
    if (type === 'complaint') _refreshActiveComplaintView();
    else if (type === 'zone') loadZones();
    else                       loadUsers();
  } catch (e) { Toast.show(e.message, 'error'); }
}
window.confirmDelete = confirmDelete;

// ══════════════════════════════════════════════════════════════
//  RESOLVED HISTORY
// ══════════════════════════════════════════════════════════════
let _rPage = 1;

async function loadResolved() {
  const params = new URLSearchParams({
    page:     _rPage,
    per_page: 12,
    status:   'resolved',
    search:   (document.getElementById('rSearch')?.value || '').trim(),
    area:     (document.getElementById('rRegion')?.value || '').trim(),
    category: document.getElementById('rCat')?.value || '',
    sort:     document.getElementById('rSort')?.value || 'date',
  });
  const container = document.getElementById('resolvedList');
  if (!container) return;
  container.innerHTML = '<div class="skeleton" style="height:150px;border-radius:var(--radius-lg);margin-bottom:1rem"></div>';
  try {
    const data = await httpAdmin(`${API.admin.complaints}?${params}`);
    const list = data.complaints || [];

    // Summary strip (first load)
    if (_rPage === 1) {
      const avg = list.length
        ? Math.round(list.reduce((s, c) => {
            const start = new Date(c.created_at), end = new Date(c.resolved_at || c.updated_at);
            return s + Math.max(0, (end - start) / 86400000);
          }, 0) / list.length)
        : 0;
      document.getElementById('resolvedSummary').innerHTML = `
        <div class="stat-box" style="border-top-color:var(--green-400)">
          <div class="stat-icon">✅</div>
          <div class="stat-num">${data.total || 0}</div>
          <div class="stat-label">Total Resolved</div>
        </div>
        <div class="stat-box" style="border-top-color:#3b82f6">
          <div class="stat-icon">⏱️</div>
          <div class="stat-num">${avg > 0 ? avg + 'd' : '—'}</div>
          <div class="stat-label">Avg. Resolution Time</div>
        </div>
        <div class="stat-box" style="border-top-color:#f59e0b">
          <div class="stat-icon">👍</div>
          <div class="stat-num">${list.reduce((s, c) => s + (c.votes || c.vote_count || 0), 0)}</div>
          <div class="stat-label">Total Votes (this page)</div>
        </div>`;
    }

    if (!list.length) {
      container.innerHTML = `<div class="empty-st"><div class="empty-st-icon">✅</div>No resolved complaints found</div>`;
      return;
    }

    container.innerHTML = list.map(c => {
      const history    = (c.status_history || []);
      const submitted  = history.find(h => h.status === 'submitted') || { updated_at: c.created_at };
      const inProgress = history.find(h => h.status === 'in_progress');
      const resolved   = [...history].reverse().find(h => h.status === 'resolved');
      const startDate  = new Date(c.created_at);
      const endDate    = new Date(c.resolved_at || resolved?.updated_at || c.updated_at);
      const days       = Math.max(0, Math.round((endDate - startDate) / 86400000));
      const imgs = (c.images || []).slice(0, 3);

      return `<div class="resolved-card">
        <div class="rc-top">
          <div style="flex:1">
            <div class="rc-title">${CAT_ICON[c.category]||'📌'} ${esc(c.description || '—').slice(0, 80)}${(c.description||'').length > 80 ? '…' : ''}</div>
            <div class="rc-meta">
              <span>📍 ${esc(c.address||'—')}</span>
              ${c.region ? `<span>🏘️ ${esc(c.region)}</span>` : ''}
              <span>📂 ${CAT_LABEL[c.category]||c.category}</span>
              <span>👍 ${c.votes || c.vote_count || 0} votes</span>
            </div>
          </div>
          <div class="rc-badges">
            <span class="badge b-resolved">✅ Resolved</span>
            ${PRI_HTML[c.priority||'normal']}
            <span style="background:#f0fdf4;color:var(--green-700);font-size:.72rem;font-weight:700;padding:.2rem .6rem;border-radius:var(--radius-full);border:1px solid var(--green-200)">${days === 0 ? 'Same day' : days + 'd'}</span>
          </div>
        </div>

        <!-- Timeline -->
        <div class="rc-timeline">
          <div class="rc-tl-item tl-submitted">
            <div class="rc-tl-label">📝 Submitted</div>
            <div class="rc-tl-msg">${esc(submitted.message || 'Complaint filed')}</div>
            <div class="rc-tl-time">${fmtDate(c.created_at)}</div>
          </div>
          ${inProgress ? `<div class="rc-tl-item tl-in_progress">
            <div class="rc-tl-label">🔄 In Progress</div>
            <div class="rc-tl-msg">${esc(inProgress.message || 'Work started')}</div>
            <div class="rc-tl-time">${fmtDate(inProgress.updated_at)} · ${timeAgo(inProgress.updated_at)}</div>
          </div>` : ''}
          ${resolved ? `<div class="rc-tl-item tl-resolved">
            <div class="rc-tl-label">✅ Resolved</div>
            <div class="rc-tl-msg">${esc(resolved.message || 'Issue resolved')}</div>
            <div class="rc-tl-time">${fmtDate(resolved.updated_at)} · ${timeAgo(resolved.updated_at)}</div>
          </div>` : ''}
        </div>

        <!-- Reporter + authority row -->
        <div class="rc-reporter">
          <span>👤 <strong>${esc(c.reporter_name||'Unknown')}</strong></span>
          <span>📞 ${esc(c.reporter_phone||'—')}</span>
          ${c.assigned_to ? `<span style="color:#1e40af">👮 ${esc(c.assigned_name||'Authority')}</span>` : ''}
          ${c.assigned_area ? `<span style="color:#1e40af">📍 ${esc(c.assigned_area)}</span>` : ''}
        </div>

        <!-- Images -->
        ${imgs.length ? `<div class="rc-imgs">${imgs.map(img => `<img src="${img}" class="rc-img" onclick="window.open('${img}','_blank')" title="View full image">`).join('')}</div>` : ''}
      </div>`;
    }).join('');

    renderPagination('r', data.page, data.pages, data.total, loadResolved);
    setBadge('badge-resolved', data.total || 0);
  } catch (e) {
    container.innerHTML = `<div style="color:var(--red);padding:1.5rem;text-align:center">${esc(e.message)}</div>`;
  }
}
window.loadResolved = loadResolved;

function fmtDate(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) +
           ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  } catch { return String(dt); }
}

// ══════════════════════════════════════════════════════════════
//  PAGINATION
// ══════════════════════════════════════════════════════════════
function renderPagination(prefix, page, pages, total, reloadFn) {
  const info = document.getElementById(`${prefix}PagInfo`);
  const btns = document.getElementById(`${prefix}PagBtns`);
  if (!info || !btns) return;
  info.textContent = `${total||0} total`;
  window[`_rl_${prefix}`] = reloadFn;
  const parts = [];
  parts.push(`<button class="pg-btn" onclick="pg('${prefix}',${page-1})" ${page<=1?'disabled':''}>‹</button>`);
  const s = Math.max(1, page-2), e = Math.min(pages||1, page+2);
  if (s > 1) parts.push(`<button class="pg-btn" onclick="pg('${prefix}',1)">1</button>`);
  if (s > 2) parts.push(`<span style="color:var(--gray-400);padding:0 2px">…</span>`);
  for (let i = s; i <= e; i++)
    parts.push(`<button class="pg-btn ${i===page?'active':''}" onclick="pg('${prefix}',${i})">${i}</button>`);
  if (e < (pages||1)-1) parts.push(`<span style="color:var(--gray-400);padding:0 2px">…</span>`);
  if (e < (pages||1)) parts.push(`<button class="pg-btn" onclick="pg('${prefix}',${pages})">${pages}</button>`);
  parts.push(`<button class="pg-btn" onclick="pg('${prefix}',${page+1})" ${page>=(pages||1)?'disabled':''}>›</button>`);
  btns.innerHTML = parts.join('');
}
function pg(prefix, page) {
  if (prefix==='c')   _cPage   = page;
  if (prefix==='u')   _uPage   = page;
  if (prefix==='msg') _msgPage = page;
  if (prefix==='r')   _rPage   = page;
  if (window[`_rl_${prefix}`]) window[`_rl_${prefix}`]();
}
window.pg = pg;

// ══════════════════════════════════════════════════════════════
//  INIT + LIVE BADGE REFRESH
// ══════════════════════════════════════════════════════════════
loadOverview();

setInterval(async () => {
  try {
    const s = await httpAdmin(API.admin.stats);
    setBadge('badge-complaints', s.submitted    || 0);
    setBadge('badge-unassigned', s.unassigned   || 0);
    setBadge('badge-contacts',   s.new_contacts || 0);
  } catch {}
}, 60000);

}); // end DOMContentLoaded