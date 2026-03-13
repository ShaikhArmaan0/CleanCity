/* ============================================================
   profile.ui.js  –  User profile view/edit page
   ============================================================ */
document.addEventListener('DOMContentLoaded', async function () {

if (!Auth.requireAuth('login.html')) return;

const $ = id => document.getElementById(id);

// ── Load profile ──────────────────────────────────────────────
async function loadProfile() {
  try {
    const user = await http(API.users.profile);
    // Hero
    const initial = (user.name || 'U')[0].toUpperCase();
    $('profileAvatar').textContent = initial;
    $('heroName').textContent  = user.name  || '—';
    $('heroPhone').textContent = user.phone ? `📞 ${user.phone}` : '—';
    $('heroRole').textContent  = (user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1);

    // Sidebar
    const sbAv = document.getElementById('sbAvatar');
    const sbNm = document.getElementById('sbName');
    const sbRl = document.getElementById('sbRole');
    if (sbAv) sbAv.textContent = initial;
    if (sbNm) sbNm.textContent = user.name || '—';
    if (sbRl) sbRl.textContent = user.role || 'citizen';

    // Stats
    $('statReports').textContent  = user.total_reports   ?? 0;
    $('statResolved').textContent = user.resolved_reports ?? 0;
    $('statVotes').textContent    = user.total_votes      ?? 0;

    // Form fields
    $('pName').value    = user.name    || '';
    $('pEmail').value   = user.email   || '';
    $('pPhone').value   = user.phone   || '';
    $('pArea').value    = user.area    || '';
    $('pAddress').value = user.address || '';
    $('pBio').value     = user.bio     || '';

    // Also update stored user object (keeps navbar etc. in sync)
    Auth.setSession(Auth.getToken(), user);
  } catch (e) {
    Toast.show(e.message || 'Failed to load profile', 'error');
  }
}

// ── Save profile ──────────────────────────────────────────────
async function saveProfile() {
  const btn = $('saveInfoBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await http(API.users.updateProfile, {
      method: 'PATCH',
      body: JSON.stringify({
        name:    $('pName').value.trim(),
        email:   $('pEmail').value.trim(),
        area:    $('pArea').value.trim(),
        address: $('pAddress').value.trim(),
        bio:     $('pBio').value.trim(),
      }),
    });
    // Update stored session with new info
    if (res.user) Auth.setSession(Auth.getToken(), res.user);
    Toast.show('Profile updated ✓');
    // Refresh hero
    const u = res.user || {};
    if (u.name) {
      $('heroName').textContent = u.name;
      $('profileAvatar').textContent = u.name[0].toUpperCase();
    }
  } catch (e) {
    Toast.show(e.message || 'Failed to save', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}
window.saveProfile = saveProfile;

// ── Change password ───────────────────────────────────────────
async function changePassword() {
  const oldPw     = $('pOldPw').value;
  const newPw     = $('pNewPw').value;
  const confirmPw = $('pConfirmPw').value;

  if (!oldPw)             { Toast.show('Enter your current password', 'warning'); return; }
  if (newPw.length < 8)   { Toast.show('New password must be at least 8 characters', 'warning'); return; }
  if (newPw !== confirmPw){ Toast.show('Passwords do not match', 'warning'); return; }

  const btn = $('savePwBtn');
  btn.disabled = true; btn.textContent = 'Updating…';
  try {
    await http(API.users.changePassword, {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPw, new_password: newPw }),
    });
    Toast.show('Password changed ✓');
    $('pOldPw').value = ''; $('pNewPw').value = ''; $('pConfirmPw').value = '';
  } catch (e) {
    Toast.show(e.message || 'Failed to change password', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Update Password';
  }
}
window.changePassword = changePassword;

// ── Init ──────────────────────────────────────────────────────
loadProfile();

}); // end DOMContentLoaded