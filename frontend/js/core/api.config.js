/* ============================================================
   api.config.js  –  Shared API URLs, http helper, Toast, Auth
   ============================================================ */

// Auto-detect backend URL
const _host = window.location.hostname;
const _isLocal = _host === "localhost" || _host === "127.0.0.1";
const API_BASE_URL = _isLocal
  ? "http://localhost:5000/api"
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
    profile:        `${API_BASE_URL}/users/profile`,
    updateProfile:  `${API_BASE_URL}/users/profile`,
    changePassword: `${API_BASE_URL}/users/change-password`,
  },
  contact: `${API_BASE_URL}/complaints/contact`,

  complaints: {
    public:  `${API_BASE_URL}/complaints/public`,
    trending:`${API_BASE_URL}/complaints/trending`,
    my:      `${API_BASE_URL}/complaints/my`,
    create:  `${API_BASE_URL}/complaints/`,
    byId:    (id) => `${API_BASE_URL}/complaints/${id}`,
    history: (id) => `${API_BASE_URL}/complaints/${id}/history`,
    status:  (id) => `${API_BASE_URL}/complaints/${id}/status`,
  },
  votes: {
    cast: (id) => `${API_BASE_URL}/votes/${id}`,
    my:   `${API_BASE_URL}/votes/my`,
  },
  comments: {
    forComplaint: (id) => `${API_BASE_URL}/comments/${id}`,
    post:         (id) => `${API_BASE_URL}/comments/${id}`,
    delete:       (id) => `${API_BASE_URL}/comments/delete/${id}`,
  },
  notifications: {
    list:    `${API_BASE_URL}/notifications/`,
    markAll: `${API_BASE_URL}/notifications/read`,
    markOne: (id) => `${API_BASE_URL}/notifications/${id}/read`,
  },

  // ── Admin ──────────────────────────────────────────────────
  admin: {
    login:           `${API_BASE_URL}/admin/login`,
    stats:           `${API_BASE_URL}/admin/stats`,
    profile:         `${API_BASE_URL}/admin/profile`,
    zones:           `${API_BASE_URL}/admin/zones`,
    zone:            (id) => `${API_BASE_URL}/admin/zones/${id}`,
    zonesByArea:     (area) => `${API_BASE_URL}/admin/zones/by-area?area=${encodeURIComponent(area)}`,
    authorityUsers:  `${API_BASE_URL}/admin/authority-users`,
    complaints:      `${API_BASE_URL}/admin/complaints`,
    complaint:       (id) => `${API_BASE_URL}/admin/complaints/${id}`,
    complaintStatus: (id) => `${API_BASE_URL}/admin/complaints/${id}/status`,
    complaintAssign: (id) => `${API_BASE_URL}/admin/complaints/${id}/assign`,
    deleteComplaint: (id) => `${API_BASE_URL}/admin/complaints/${id}`,
    users:           `${API_BASE_URL}/admin/users`,
    createAuthority: `${API_BASE_URL}/admin/users/create-authority`,
    userToggleActive:(id) => `${API_BASE_URL}/admin/users/${id}/toggle-active`,
    deleteUser:      (id) => `${API_BASE_URL}/admin/users/${id}`,
    contacts:        `${API_BASE_URL}/admin/contacts`,
    contactStatus:   (id) => `${API_BASE_URL}/admin/contacts/${id}/status`,
  },
};

// ── HTTP Helper (user) ───────────────────────────────────────
// Uses cc_token for regular user endpoints
async function http(url, options = {}) {
  const token = localStorage.getItem("cc_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("cc_token");
      localStorage.removeItem("cc_user");
      if (!window.location.pathname.includes("login")) {
        const isAdminPage = window.location.pathname.includes("admin");
        window.location.href = isAdminPage ? "admin-login.html" : "../pages/login.html";
      }
    }
    const err = new Error(data.error || data.message || "Request failed");
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

// ── HTTP Helper (admin) ──────────────────────────────────────
// Uses cc_admin_token — completely separate from user session
async function httpAdmin(url, options = {}) {
  const token = localStorage.getItem("cc_admin_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("cc_admin_token");
      localStorage.removeItem("cc_admin_user");
      if (!window.location.pathname.includes("admin-login")) {
        window.location.href = "admin-login.html";
      }
    }
    const err = new Error(data.error || data.message || "Request failed");
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

// ── Toast ─────────────────────────────────────────────────────
const Toast = {
  _container: null,
  _get() {
    if (!this._container) {
      this._container = document.createElement("div");
      this._container.className = "toast-container";
      document.body.appendChild(this._container);
    }
    return this._container;
  },
  show(message, type = "success", duration = 3500) {
    const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
    const t = document.createElement("div");
    t.className = `toast${type !== "success" ? " toast-" + type : ""}`;
    t.innerHTML = `<span>${icons[type] || "✅"}</span><span class="toast-message">${message}</span>`;
    this._get().appendChild(t);
    setTimeout(() => {
      t.classList.add("toast-out");
      setTimeout(() => t.remove(), 320);
    }, duration);
  },
};

// ── Auth (USER) ───────────────────────────────────────────────
const Auth = {
  getToken:   () => localStorage.getItem("cc_token"),
  getUser:    () => { try { return JSON.parse(localStorage.getItem("cc_user")); } catch { return null; } },
  isLoggedIn: () => !!localStorage.getItem("cc_token"),
  isAdmin:    () => { const u = Auth.getUser(); return u && (u.role === "admin" || u.role === "authority"); },

  setSession(token, user) {
    localStorage.setItem("cc_token", token);
    localStorage.setItem("cc_user", JSON.stringify(user));
  },
  clearSession() {
    ["cc_token", "cc_user", "cc_temp_token", "cc_temp_phone"].forEach(k => localStorage.removeItem(k));
  },
  requireAuth(redirect = "../pages/login.html") {
    if (!this.isLoggedIn()) { window.location.href = redirect; return false; }
    return true;
  },
  requireAdmin(redirect = "admin-login.html") {
    if (!AdminAuth.isLoggedIn()) { window.location.href = redirect; return false; }
    if (!AdminAuth.isAdmin())    { window.location.href = redirect; return false; }
    return true;
  },
};

// ── AdminAuth (ADMIN — separate session) ─────────────────────
const AdminAuth = {
  getToken:   () => localStorage.getItem("cc_admin_token"),
  getUser:    () => { try { return JSON.parse(localStorage.getItem("cc_admin_user")); } catch { return null; } },
  isLoggedIn: () => !!localStorage.getItem("cc_admin_token"),
  isAdmin:    () => { const u = AdminAuth.getUser(); return u && (u.role === "admin" || u.role === "authority"); },

  setSession(token, user) {
    localStorage.setItem("cc_admin_token", token);
    localStorage.setItem("cc_admin_user", JSON.stringify(user));
  },
  clearSession() {
    ["cc_admin_token", "cc_admin_user"].forEach(k => localStorage.removeItem(k));
  },
};

// ── Shared timeAgo (UTC-aware) ────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  if (isNaN(diff)) return "";
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Global logout (user) ──────────────────────────────────────
function logout() {
  Auth.clearSession();
  sessionStorage.clear();
  window.location.replace("login.html?logout=1");
}
window.logout = logout;

// ── Global logout (admin) ─────────────────────────────────────
function adminLogout() {
  AdminAuth.clearSession();
  sessionStorage.clear();
  window.location.replace("admin-login.html");
}
window.adminLogout = adminLogout;