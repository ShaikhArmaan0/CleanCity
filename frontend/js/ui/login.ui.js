/* ============================================================
   login.ui.js
   Screens: screenLogin → screenRegister | screenForgot
   ============================================================ */

// Only auto-redirect to dashboard if logged in AND not coming from a logout action
const _fromLogout = new URLSearchParams(window.location.search).get('logout');
if (!_fromLogout && Auth.isLoggedIn()) window.location.href = 'dashboard.html';

// ── Helpers ───────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)  e.className   = cls;
  if (html) e.innerHTML   = html;
  return e;
};

function validatePhone(raw) {
  const d = raw.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15;
}
function clampPhone(inp) {
  if (inp.value.replace(/\D/g, '').length > 15) inp.value = inp.value.slice(0, -1);
}
function setLoading(btn, on, label) { btn.disabled = on; btn.textContent = on ? 'Please wait…' : label; }
function showErr(id, msg) { const e = $(id); e.textContent = msg; e.classList.add('show'); }
function hideErr(id)      { $(id).classList.remove('show'); }

// ── Screen switcher ───────────────────────────────────────────
function showScreen(id) {
  ['screenLogin','screenRegister','screenForgot'].forEach(s => {
    $(s).style.display = (s === id) ? 'block' : 'none';
  });
  window.scrollTo({ top: 0 });
}

// ── Login tab switch ──────────────────────────────────────────
$('tabOtp').addEventListener('click', () => {
  $('tabOtp').classList.add('active');
  $('tabPassword').classList.remove('active');
  $('otpLoginSection').style.display      = 'block';
  $('passwordLoginSection').style.display = 'none';
});
$('tabPassword').addEventListener('click', () => {
  $('tabPassword').classList.add('active');
  $('tabOtp').classList.remove('active');
  $('passwordLoginSection').style.display = 'block';
  $('otpLoginSection').style.display      = 'none';
});
$('goToOtpTab').addEventListener('click', e => {
  e.preventDefault();
  $('tabOtp').click();
});

// ── OTP step management ───────────────────────────────────────
const otpInputs  = document.querySelectorAll('.otp-input');
let   resendInterval;

function showOtpStep(n) {
  $('step1').classList.toggle('hidden', n !== 1);
  $('step2').classList.toggle('hidden', n !== 2);
  // dots
  $('dot1').className = 'step-dot' + (n === 1 ? ' active' : ' done');
  $('dot2').className = 'step-dot' + (n === 2 ? ' active' : '');
}
function goBackToPhone() {
  clearInterval(resendInterval);
  showOtpStep(1);
  otpInputs.forEach(i => { i.value = ''; i.classList.remove('filled','error'); });
  $('devOtpBanner').classList.remove('show');
}
window.goBackToPhone = goBackToPhone;

function startTimer() {
  let s = 60;
  const btn = $('resendBtn');
  btn.disabled = true;
  btn.textContent = `Resend (${s}s)`;
  clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    s--;
    btn.textContent = `Resend (${s}s)`;
    if (s <= 0) { clearInterval(resendInterval); btn.disabled = false; btn.textContent = 'Resend OTP'; }
  }, 1000);
}

// OTP input behaviours
otpInputs.forEach((inp, i) => {
  inp.addEventListener('input', e => {
    const v = e.target.value.replace(/\D/g, '');
    e.target.value = v;
    e.target.classList.toggle('filled', !!v);
    e.target.classList.remove('error');
    if (v && i < 5) otpInputs[i + 1].focus();
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !inp.value && i > 0) {
      otpInputs[i-1].value = '';
      otpInputs[i-1].classList.remove('filled');
      otpInputs[i-1].focus();
    }
  });
  inp.addEventListener('paste', e => {
    const txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
    txt.split('').forEach((ch, idx) => {
      if (otpInputs[idx]) { otpInputs[idx].value = ch; otpInputs[idx].classList.add('filled'); }
    });
    if (txt.length >= 6) otpInputs[5].focus();
    e.preventDefault();
  });
});

function getOtp() { return Array.from(otpInputs).map(i => i.value).join(''); }
function shakeOtp() {
  otpInputs.forEach(i => i.classList.add('error'));
  setTimeout(() => otpInputs.forEach(i => i.classList.remove('error')), 600);
}

// ── Send OTP ──────────────────────────────────────────────────
const phoneInput = $('phoneInput');
const sendBtn    = $('sendOtpBtn');
phoneInput.addEventListener('input', () => clampPhone(phoneInput));

async function sendOtp() {
  const phone = phoneInput.value.trim();
  const errEl = $('phoneError');
  if (!validatePhone(phone)) {
    errEl.textContent = 'Enter a valid phone number (10–15 digits)';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');
  setLoading(sendBtn, true, 'Send OTP');
  try {
    const res = await http(API.auth.sendOtp, { method:'POST', body: JSON.stringify({ phone }) });
    localStorage.setItem('cc_temp_phone', phone);
    $('phoneDisplay').textContent = phone;
    if (res.dev_otp) { $('devOtpCode').textContent = res.dev_otp; $('devOtpBanner').classList.add('show'); }
    showOtpStep(2);
    startTimer();
    otpInputs[0].focus();
  } catch (err) { Toast.show(err.message || 'Failed to send OTP', 'error'); }
  setLoading(sendBtn, false, 'Send OTP');
}
sendBtn.addEventListener('click', sendOtp);
phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(); });
$('resendBtn').addEventListener('click', () => sendOtp());

// ── Verify OTP ────────────────────────────────────────────────
$('verifyOtpBtn').addEventListener('click', async () => {
  const phone = localStorage.getItem('cc_temp_phone');
  const otp   = getOtp();
  if (otp.length < 6) { shakeOtp(); Toast.show('Enter all 6 digits', 'warning'); return; }

  const btn = $('verifyOtpBtn');
  setLoading(btn, true, 'Verify OTP');
  try {
    const res = await http(API.auth.verifyOtp, { method:'POST', body: JSON.stringify({ phone, otp }) });
    clearInterval(resendInterval);
    $('devOtpBanner').classList.remove('show');
    if (res.existing_user) {
      Auth.setSession(res.token, res.user);
      Toast.show('Welcome back, ' + res.user.name + '! 🌿');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
    } else {
      // NEW user — go to registration screen
      localStorage.setItem('cc_temp_token', res.temp_token);
      showScreen('screenRegister');
    }
  } catch (err) { shakeOtp(); Toast.show(err.message || 'Invalid OTP', 'error'); }
  setLoading(btn, false, 'Verify OTP');
});

// ── Password Login ────────────────────────────────────────────
const pwdPhone = $('pwdPhone');
pwdPhone.addEventListener('input', () => clampPhone(pwdPhone));

$('passwordLoginBtn').addEventListener('click', async () => {
  const phone = pwdPhone.value.trim();
  const pass  = $('pwdPassword').value;
  hideErr('pwdError');
  if (!validatePhone(phone)) { showErr('pwdError', 'Enter a valid phone number (10–15 digits)'); return; }
  if (!pass)                  { showErr('pwdError', 'Password is required');                      return; }

  const btn = $('passwordLoginBtn');
  setLoading(btn, true, 'Sign In →');
  try {
    const res = await http(API.auth.login, { method:'POST', body: JSON.stringify({ phone, password: pass }) });
    Auth.setSession(res.token, res.user);
    Toast.show('Welcome back, ' + res.user.name + '! 🌿');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
  } catch (err) { showErr('pwdError', err.message || 'Wrong phone or password'); }
  setLoading(btn, false, 'Sign In →');
});

// ── Registration ──────────────────────────────────────────────
$('backToLoginBtn').addEventListener('click', () => showScreen('screenLogin'));

$('registerBtn').addEventListener('click', async () => {
  const name    = $('regName').value.trim();
  const pass    = $('regPassword').value;
  const confirm = $('regPasswordConfirm').value;
  const email   = $('regEmail').value.trim();
  const address = $('regAddress').value.trim();
  hideErr('regError');

  if (!name)             { showErr('regError', 'Full name is required');                     return; }
  if (pass.length < 6)   { showErr('regError', 'Password must be at least 6 characters');   return; }
  if (pass !== confirm)  { showErr('regError', 'Passwords do not match');                    return; }

  const btn = $('registerBtn');
  setLoading(btn, true, 'Creating Account…');
  try {
    const temp = localStorage.getItem('cc_temp_token');
    const res  = await http(API.auth.completeProfile, {
      method:  'POST',
      body:    JSON.stringify({ name, password: pass, email, address }),
      headers: { 'Authorization': 'Bearer ' + temp },
    });
    Auth.setSession(res.token, res.user);
    localStorage.removeItem('cc_temp_token');
    localStorage.removeItem('cc_temp_phone');
    Toast.show('Welcome to CleanCity, ' + name + '! 🌿');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
  } catch (err) { showErr('regError', err.message || 'Registration failed. Please try again.'); }
  setLoading(btn, false, 'Create Account →');
});

// ── Forgot Password ───────────────────────────────────────────
let forgotPhone = '';

$('showForgotBtn').addEventListener('click', () => {
  showScreen('screenForgot');
  hideErr('forgotError');
  $('forgotDevBanner').classList.remove('show');
  $('forgotPhone').disabled = false;
  $('sendForgotOtpBtn').style.display = 'block';
  $('forgotOtpSection').style.display = 'none';
  $('forgotPhone').value = '';
  $('forgotOtp').value   = '';
  $('newPassword').value = '';
  $('confirmNewPassword').value = '';
});
$('backFromForgotBtn').addEventListener('click', () => showScreen('screenLogin'));

const forgotPhoneInp = $('forgotPhone');
forgotPhoneInp.addEventListener('input', () => clampPhone(forgotPhoneInp));

$('sendForgotOtpBtn').addEventListener('click', async () => {
  forgotPhone = forgotPhoneInp.value.trim();
  hideErr('forgotError');
  if (!validatePhone(forgotPhone)) { showErr('forgotError', 'Enter a valid phone number (10–15 digits)'); return; }

  const btn = $('sendForgotOtpBtn');
  setLoading(btn, true, 'Sending…');
  try {
    const res = await http(API.auth.forgotPassword, { method:'POST', body: JSON.stringify({ phone: forgotPhone }) });
    if (res.dev_otp) { $('forgotDevOtp').textContent = res.dev_otp; $('forgotDevBanner').classList.add('show'); }
    $('forgotPhone').disabled   = true;
    $('sendForgotOtpBtn').style.display = 'none';
    $('forgotOtpSection').style.display = 'block';
    Toast.show('OTP sent to ' + forgotPhone);
  } catch (err) { showErr('forgotError', err.message || 'Account not found for this number'); }
  setLoading(btn, false, 'Send Reset OTP →');
});

$('resetPasswordBtn').addEventListener('click', async () => {
  const otp     = $('forgotOtp').value.trim();
  const newPass = $('newPassword').value;
  const confirm = $('confirmNewPassword').value;
  hideErr('forgotError');

  if (otp.length < 6)     { showErr('forgotError', 'Enter the 6-digit OTP');                  return; }
  if (newPass.length < 6) { showErr('forgotError', 'Password must be at least 6 characters'); return; }
  if (newPass !== confirm) { showErr('forgotError', 'Passwords do not match');                 return; }

  const btn = $('resetPasswordBtn');
  setLoading(btn, true, 'Resetting…');
  try {
    await http(API.auth.resetPassword, {
      method: 'POST',
      body:   JSON.stringify({ phone: forgotPhone, otp, new_password: newPass }),
    });
    Toast.show('Password reset! You can now log in. 🌿');
    setTimeout(() => showScreen('screenLogin'), 800);
  } catch (err) { showErr('forgotError', err.message || 'Reset failed. Check your OTP.'); }
  setLoading(btn, false, 'Reset Password →');
});

// ── Init ──────────────────────────────────────────────────────
showScreen('screenLogin');
showOtpStep(1);