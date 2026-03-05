/* ============================================================
   complaints.ui.js  –  City complaints feed + comment section
   ============================================================ */

// ── Hamburger ─────────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Auth-aware nav ────────────────────────────────────────────
document.getElementById('navActions').innerHTML = Auth.isLoggedIn()
  ? '<a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>'
  : '<a href="login.html" class="btn btn-primary btn-sm">Login</a>';

// ── URL param: ?mine=true shows only my complaints ─────────────
const urlParams  = new URLSearchParams(window.location.search);
const mineOnly   = urlParams.get('mine') === 'true';

if (mineOnly) {
  document.getElementById('pageTitle').textContent      = '📋 My Complaints';
  document.getElementById('pageSubtitle').textContent   = 'Complaints you have submitted';
  document.getElementById('mineFilterBar').style.display = 'none'; // hide status chips when viewing own
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; }
}

// ── Constants ─────────────────────────────────────────────────
const catIcons  = {
  garbage:'🗑️', drainage:'💧', illegal_dumping:'⚠️',
  broken_infrastructure:'🔧', public_hygiene:'🧹', other:'📌',
};
const catLabels = {
  garbage:'Garbage Overflow', drainage:'Drainage Problem',
  illegal_dumping:'Illegal Dumping', broken_infrastructure:'Infrastructure',
  public_hygiene:'Public Hygiene', other:'Other',
};
const statusMap = { submitted:'Submitted', in_progress:'In Progress', resolved:'Resolved' };
const statusCls = { submitted:'badge-pending', in_progress:'badge-in-progress', resolved:'badge-resolved' };

// ── State ─────────────────────────────────────────────────────
let currentStatus   = '';
let currentCategory = '';
let isTrending      = false;
let votedIds        = new Set();

// ── Card HTML ─────────────────────────────────────────────────
function createCard(c) {
  const id    = c._id;
  const voted = votedIds.has(id);
  const votes = c.votes || 0;
  return `
    <div class="complaint-card" onclick="openDrawer('${id}', event)">
      <div class="complaint-card-img">
        ${c.images && c.images.length > 0
          ? `<img src="${c.images[0]}" alt="complaint photo" style="width:100%;height:100%;object-fit:cover;display:block;">`
          : `<div class="complaint-card-img-placeholder">${catIcons[c.category] || '📌'}</div>`
        }
      </div>
      <div class="complaint-card-body">
        <div class="complaint-card-cat">
          <span class="complaint-card-cat-icon">${catIcons[c.category] || '📌'}</span>
          <span class="complaint-card-cat-label">${catLabels[c.category] || c.category || 'Issue'}</span>
        </div>
        <div class="complaint-card-title">${c.description || 'No description.'}</div>
        <div class="complaint-card-location">📍 ${c.address || 'Location not provided'}</div>
        <div class="complaint-card-footer">
          <span class="badge ${statusCls[c.status] || 'badge-pending'}">${statusMap[c.status] || c.status}</span>
          <div style="display:flex;align-items:center;gap:0.75rem">
            <span style="font-size:0.78rem;color:var(--gray-400)">${timeAgo(c.created_at)}</span>
            <button class="vote-btn ${voted ? 'voted' : ''}" id="vote-${id}" onclick="handleVote(event,'${id}')">
              👍 <span id="voteCount-${id}">${votes}</span>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Load complaints ───────────────────────────────────────────
async function loadComplaints() {
  const grid = document.getElementById('complaintsGrid');
  grid.innerHTML = '<div class="skeleton" style="height:300px;border-radius:var(--radius-lg)"></div>'.repeat(3);
  try {
    let complaints;
    if (mineOnly) {
      // My complaints only
      complaints = await http(API.complaints.my);
    } else if (isTrending) {
      complaints = await http(API.complaints.trending);
    } else {
      const params = [];
      if (currentStatus)   params.push('status='   + encodeURIComponent(currentStatus));
      if (currentCategory) params.push('category=' + encodeURIComponent(currentCategory));
      const url = API.complaints.public + (params.length ? '?' + params.join('&') : '');
      complaints = await http(url);
    }
    if (!complaints || !complaints.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">${mineOnly ? 'No complaints yet' : 'No complaints found'}</div>
        <div class="empty-state-text">${mineOnly
          ? '<a href="report.html" style="color:var(--green-600);font-weight:600">File your first report →</a>'
          : 'Try adjusting your filters'}</div>
      </div>`;
      return;
    }
    grid.innerHTML = complaints.map(createCard).join('');
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Failed to load complaints</div>
      <div class="empty-state-text">Make sure the backend server is running</div>
    </div>`;
  }
}

async function loadVotedIds() {
  if (!Auth.isLoggedIn()) return;
  try {
    const votes = await http(API.votes.my);
    votes.forEach(v => { if (v.complaint_id) votedIds.add(v.complaint_id); });
  } catch {}
}

// ── Vote ──────────────────────────────────────────────────────
async function handleVote(e, id) {
  e.stopPropagation();
  if (!Auth.isLoggedIn()) { Toast.show('Login to vote on complaints', 'warning'); return; }
  const btn = document.getElementById('vote-' + id);
  if (!btn) return;
  btn.classList.add('bounce');
  setTimeout(() => btn.classList.remove('bounce'), 300);
  try {
    const res = await http(API.votes.cast(id), { method: 'POST' });
    const newCount = res.votes;
    const voted = res.voted;
    // Update local voted set
    if (voted) { votedIds.add(id); } else { votedIds.delete(id); }
    // Update all vote buttons for this complaint (card + drawer)
    document.querySelectorAll('#vote-' + id).forEach(b => {
      b.classList.toggle('voted', voted);
    });
    // Update card count
    const cardCountEl = document.getElementById('voteCount-' + id);
    if (cardCountEl) cardCountEl.textContent = newCount;
    // Update drawer count
    const drawerCountEl = document.getElementById('drawerVoteCount');
    if (drawerCountEl) drawerCountEl.textContent = newCount;
    Toast.show(voted ? 'Vote registered! 👍' : 'Vote removed');
  } catch (err) { Toast.show(err.message || 'Vote failed', 'error'); }
}
window.handleVote = handleVote;

// ── Drawer ────────────────────────────────────────────────────
let activeComplaintId = null;

async function openDrawer(id, event) {
  if (event && event.target.closest('.vote-btn')) return;
  activeComplaintId = id;
  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';

  const body = document.getElementById('drawerBody');
  body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-400)">Loading…</div>';

  try {
    const c     = await http(API.complaints.byId(id));
    const voted = votedIds.has(id);
    const votes = c.votes || 0;

    document.getElementById('drawerTitle').textContent = catLabels[c.category] || 'Complaint';

    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem">
        <span class="badge ${statusCls[c.status] || 'badge-pending'}">${statusMap[c.status] || c.status}</span>
        <span style="font-size:0.8rem;color:var(--gray-400)">${timeAgo(c.created_at)}</span>
      </div>
      <p style="font-size:0.925rem;color:var(--gray-700);line-height:1.7;margin-bottom:0.5rem">${c.description || 'No description.'}</p>
      <p style="font-size:0.8rem;color:var(--gray-500);margin-bottom:1rem">📍 ${c.address || 'No location'}</p>

      ${c.images && c.images.length > 0 ? `
      <div style="margin-bottom:1rem;">
        <div style="display:grid;grid-template-columns:repeat(${Math.min(c.images.length,3)},1fr);gap:4px;border-radius:10px;overflow:hidden;">
          ${c.images.map((src,i) => `
            <div data-lb-src="${src}" onclick="openLightbox(${i})" style="cursor:zoom-in;aspect-ratio:1;overflow:hidden;background:#eee;">
              <img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="photo">
            </div>`).join('')}
        </div>
        ${c.images.length > 1 ? `<div style="font-size:0.72rem;color:var(--gray-400);margin-top:5px;text-align:right;">📷 ${c.images.length} photos &nbsp;·&nbsp; tap to view fullscreen</div>` : `<div style="font-size:0.72rem;color:var(--gray-400);margin-top:5px;text-align:right;">📷 tap to view fullscreen</div>`}
      </div>` : ''}

      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.25rem">
        <button class="vote-btn ${voted ? 'voted' : ''}" id="vote-${c._id}" onclick="handleVote(event,'${c._id}')">
          👍 <span id="drawerVoteCount">${votes}</span> Votes
        </button>
        <a href="track.html?id=${c._id}" class="btn btn-ghost btn-sm">🔍 Track Status</a>
        ${Auth.isLoggedIn() ? '<a href="report.html" class="btn btn-ghost btn-sm">+ Report Similar</a>' : ''}
      </div>

      <div style="border-top:1px solid var(--gray-100);padding-top:1.25rem">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:1rem;color:var(--gray-900)">
          💬 Community Comments
        </div>
        <div id="commentsList" style="margin-bottom:1rem"></div>
        ${Auth.isLoggedIn()
          ? `<div style="display:flex;gap:0.5rem;align-items:flex-start">
               <textarea id="commentInput" class="form-input" placeholder="Share your thoughts on this issue…"
                 rows="2" style="resize:vertical;flex:1;font-family:var(--font-body);font-size:0.875rem"></textarea>
               <button class="btn btn-primary btn-sm" onclick="postComment('${c._id}')" style="margin-top:2px">Post</button>
             </div>
             <div style="font-size:0.75rem;color:var(--gray-400);margin-top:0.3rem">Max 500 characters</div>`
          : `<div style="text-align:center;padding:0.75rem;background:var(--gray-50);border-radius:var(--radius-md);font-size:0.85rem;color:var(--gray-500)">
               <a href="login.html" style="color:var(--green-600);font-weight:600">Log in</a> to leave a comment
             </div>`
        }
      </div>`;

    // Load comments
    loadComments(id);
  } catch {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Failed to load</div></div>`;
  }
}
window.openDrawer = openDrawer;

// ── Load comments ─────────────────────────────────────────────
async function loadComments(complaintId) {
  const el = document.getElementById('commentsList');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--gray-400);font-size:0.82rem">Loading comments…</div>';
  try {
    const comments = await http(API.comments.forComplaint(complaintId));
    const currentUser = Auth.getUser();
    if (!comments.length) {
      el.innerHTML = '<div style="color:var(--gray-400);font-size:0.82rem;padding:0.5rem 0">No comments yet. Be the first to share your thoughts!</div>';
      return;
    }
    el.innerHTML = comments.map(cm => `
      <div class="comment-item" id="cm-${cm._id}">
        <div class="comment-avatar">${(cm.user_name || 'A').charAt(0).toUpperCase()}</div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-author">${cm.user_name || 'Anonymous'}</span>
            <span class="comment-time">${timeAgo(cm.created_at)}</span>
            ${currentUser && cm.user_id === currentUser._id
              ? `<button class="comment-delete" onclick="deleteComment('${cm._id}','${complaintId}')">✕</button>`
              : ''}
          </div>
          <div class="comment-text">${escapeHtml(cm.text)}</div>
        </div>
      </div>`).join('');
  } catch {
    el.innerHTML = '<div style="color:var(--gray-400);font-size:0.82rem">Could not load comments.</div>';
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Post comment ──────────────────────────────────────────────
async function postComment(complaintId) {
  if (!Auth.isLoggedIn()) { Toast.show('Login to comment', 'warning'); return; }
  const input = document.getElementById('commentInput');
  const text  = (input.value || '').trim();
  if (!text) { Toast.show('Comment cannot be empty', 'warning'); return; }
  if (text.length > 500) { Toast.show('Comment too long (max 500 chars)', 'warning'); return; }

  const btn = document.querySelector(`button[onclick="postComment('${complaintId}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    await http(API.comments.post(complaintId), { method: 'POST', body: JSON.stringify({ text }) });
    input.value = '';
    Toast.show('Comment posted! 💬');
    loadComments(complaintId);
  } catch (err) {
    Toast.show(err.message || 'Failed to post comment', 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
}
window.postComment = postComment;

// ── Delete comment ────────────────────────────────────────────
async function deleteComment(commentId, complaintId) {
  try {
    await http(API.comments.delete(commentId), { method: 'DELETE' });
    Toast.show('Comment deleted');
    loadComments(complaintId);
  } catch (err) {
    Toast.show(err.message || 'Failed to delete', 'error');
  }
}
window.deleteComment = deleteComment;

// ── Close drawer ──────────────────────────────────────────────
function closeDrawer() {
  if (typeof closeLightbox === 'function') closeLightbox();
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.body.style.overflow = '';
  activeComplaintId = null;
}
window.closeDrawer = closeDrawer;

// ── Filters (only show when not in mine-only mode) ────────────
if (!mineOnly) {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentStatus = chip.dataset.status || '';
      isTrending = false;
      loadComplaints();
    });
  });

  document.getElementById('categoryFilter').addEventListener('change', e => {
    currentCategory = e.target.value;
    loadComplaints();
  });

  document.getElementById('sortFilter').addEventListener('change', e => {
    isTrending = e.target.value === 'trending';
    loadComplaints();
  });
}

// ── Init ──────────────────────────────────────────────────────
loadVotedIds().then(() => loadComplaints());

// ── Lightbox ─────────────────────────────────────────────────
let _lbImgs = [];
let _lbIdx  = 0;

function _ensureLightbox() {
  if (document.getElementById('lbOverlay')) return;
  const lb = document.createElement('div');
  lb.id = 'lbOverlay';
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:9999;display:none;align-items:center;justify-content:center;';
  lb.innerHTML = `
    <button onclick="closeLightbox()" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.2);border:none;color:white;width:38px;height:38px;border-radius:50%;font-size:1.3rem;cursor:pointer;">✕</button>
    <div id="lbCounter" style="position:absolute;top:18px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:0.85rem;font-family:var(--font-body);"></div>
    <button id="lbPrev" onclick="lbNav(-1)" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;width:42px;height:42px;border-radius:50%;font-size:1.5rem;cursor:pointer;">‹</button>
    <button id="lbNext" onclick="lbNav(1)"  style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;width:42px;height:42px;border-radius:50%;font-size:1.5rem;cursor:pointer;">›</button>
    <img id="lbImg" src="" style="max-width:calc(100vw - 100px);max-height:85vh;object-fit:contain;border-radius:6px;" alt="photo">
    <div id="lbDots" style="position:absolute;bottom:18px;left:0;right:0;display:flex;justify-content:center;gap:6px;"></div>
  `;
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  let _tx = 0;
  lb.addEventListener('touchstart', e => { _tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - _tx;
    if (Math.abs(dx) > 50) lbNav(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (document.getElementById('lbOverlay').style.display !== 'flex') return;
    if (e.key === 'ArrowLeft')  lbNav(-1);
    if (e.key === 'ArrowRight') lbNav(1);
    if (e.key === 'Escape')     closeLightbox();
  });
  document.body.appendChild(lb);
}

function openLightbox(idx) {
  // Collect images from thumbnail grid in the drawer
  _lbImgs = Array.from(document.querySelectorAll('#drawerBody [data-lb-src]')).map(el => el.dataset.lbSrc);
  if (!_lbImgs.length) return;
  _lbIdx = idx;
  _ensureLightbox();
  const lb = document.getElementById('lbOverlay');
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('lbPrev').style.display = _lbImgs.length > 1 ? '' : 'none';
  document.getElementById('lbNext').style.display = _lbImgs.length > 1 ? '' : 'none';
  document.getElementById('lbDots').innerHTML = _lbImgs.length > 1
    ? _lbImgs.map((_, i) => `<span onclick="lbGoTo(${i})" style="width:7px;height:7px;border-radius:50%;background:${i===idx?'white':'rgba(255,255,255,0.4)'};cursor:pointer;display:inline-block;"></span>`).join('')
    : '';
  _updateLb();
}

function closeLightbox() {
  const lb = document.getElementById('lbOverlay');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

function lbNav(dir) {
  _lbIdx = (_lbIdx + dir + _lbImgs.length) % _lbImgs.length;
  _updateLb();
}

function lbGoTo(i) { _lbIdx = i; _updateLb(); }

function _updateLb() {
  const img = document.getElementById('lbImg');
  if (!img) return;
  img.src = _lbImgs[_lbIdx];
  document.getElementById('lbCounter').textContent = _lbImgs.length > 1 ? `${_lbIdx+1} / ${_lbImgs.length}` : '';
  document.querySelectorAll('#lbDots span').forEach((d,i) => {
    d.style.background = i === _lbIdx ? 'white' : 'rgba(255,255,255,0.4)';
  });
}

window.openLightbox  = openLightbox;
window.closeLightbox = closeLightbox;
window.lbNav         = lbNav;
window.lbGoTo        = lbGoTo;