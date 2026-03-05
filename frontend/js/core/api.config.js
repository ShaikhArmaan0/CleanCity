/* ============================================================
   api.config.js  –  Shared API URLs, http helper, Toast, Auth
   ============================================================ */

// Auto-detect backend URL:
// - On PC (localhost): uses localhost:5000
// - On phone on same WiFi (192.168.x.x): uses same host IP with port 5000
const _host = window.location.hostname;
const _isLocal = _host === 'localhost' || _host === '127.0.0.1';
const API_BASE_URL = _isLocal
  ? 'http://localhost:5000/api'
  : `http://${_host}:5000/api`;

const API = {
  auth: {
    sendOtp:         `${API_BASE_URL}/auth/send-otp`,
    verifyOtp:       `${API_BASE_URL}/auth/verify-otp`,
    completeProfile: `${API_BASE_URL}/auth/complete-profile`,
    login:           `${API_BASE_URL}/auth/login`,
    forgotPassword:  `${API_BASE_URL}/auth/forgot-password`,
    resetPassword:   `${API_BASE_URL}/auth/reset-password`,
    me:              `${API_BASE_URL}/auth/me`,
  },
  users: {
    profile: `${API_BASE_URL}/users/profile`,
  },
  contact: `${API_BASE_URL}/complaints/contact`,

  complaints: {
    public:   `${API_BASE_URL}/complaints/public`,
    trending: `${API_BASE_URL}/complaints/trending`,
    my:       `${API_BASE_URL}/complaints/my`,
    create:   `${API_BASE_URL}/complaints/`,
    byId:     (id) => `${API_BASE_URL}/complaints/${id}`,
    history:  (id) => `${API_BASE_URL}/complaints/${id}/history`,
    status:   (id) => `${API_BASE_URL}/complaints/${id}/status`,
  },
  votes: {
    cast:    (id) => `${API_BASE_URL}/votes/${id}`,
    my:             `${API_BASE_URL}/votes/my`,
  },
  comments: {
    forComplaint: (id) => `${API_BASE_URL}/comments/${id}`,
    post:         (id) => `${API_BASE_URL}/comments/${id}`,
    delete:       (id) => `${API_BASE_URL}/comments/delete/${id}`,
  },
  notifications: {
    list:      `${API_BASE_URL}/notifications/`,
    markAll:   `${API_BASE_URL}/notifications/read`,
    markOne:   (id) => `${API_BASE_URL}/notifications/${id}/read`,
  },
};

// ── HTTP Helper ──────────────────────────────────────────────
async function http(url, options = {}) {
  const token   = localStorage.getItem('cc_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('cc_token');
      localStorage.removeItem('cc_user');
      if (!window.location.pathname.includes('login')) {
        window.location.href = '../pages/login.html';
      }
    }
    const err  = new Error(data.error || data.message || 'Request failed');
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

// ── Toast ─────────────────────────────────────────────────────
const Toast = {
  _container: null,
  _get() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
    return this._container;
  },
  show(message, type = 'success', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast${type !== 'success' ? ' toast-' + type : ''}`;
    t.innerHTML = `<span>${icons[type] || '✅'}</span><span class="toast-message">${message}</span>`;
    this._get().appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 320); }, duration);
  },
};

// ── Auth ──────────────────────────────────────────────────────
const Auth = {
  getToken:   () => localStorage.getItem('cc_token'),
  getUser:    () => { try { return JSON.parse(localStorage.getItem('cc_user')); } catch { return null; } },
  isLoggedIn: () => !!localStorage.getItem('cc_token'),
  setSession(token, user) {
    localStorage.setItem('cc_token', token);
    localStorage.setItem('cc_user', JSON.stringify(user));
  },
  clearSession() {
    ['cc_token','cc_user','cc_temp_token','cc_temp_phone'].forEach(k => localStorage.removeItem(k));
  },
  requireAuth(redirect = '../pages/login.html') {
    if (!this.isLoggedIn()) { window.location.href = redirect; return false; }
    return true;
  },
};

// ── Shared timeAgo (UTC-aware) ────────────────────────────────
// Backend sends ISO strings with 'Z' suffix → always UTC
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);   // Z suffix → parsed as UTC correctly
  const diff = Date.now() - date.getTime();
  if (isNaN(diff)) return '';
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}


// ── Global logout (usable from any page) ────────────────────
function logout() {
  ['cc_token','cc_user','cc_temp_token','cc_temp_phone'].forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
  window.location.replace('login.html?logout=1');
}
window.logout = logout;