/* report.ui.js — Multi-step waste report form */

// ── Hamburger ──────────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Auth nav ───────────────────────────────────────────────────
document.getElementById('navActions').innerHTML = Auth.isLoggedIn()
  ? '<a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>'
  : '<a href="login.html"    class="btn btn-primary btn-sm">Login to Report</a>';

// ── State ──────────────────────────────────────────────────────
let currentStep      = 1;
let selectedCategory = null;
let selectedLat      = null;
let selectedLng      = null;
let uploadedImages   = [];

// ── Step navigation ────────────────────────────────────────────
function goToStep(n) {
  if (n < 1 || n > 4) return;
  document.getElementById('step' + currentStep).classList.remove('active');
  currentStep = n;
  document.getElementById('step' + n).classList.add('active');
  updateProgress(n);
  if (n === 2) setTimeout(initMap, 100);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.goToStep = goToStep;

function updateProgress(active) {
  for (let i = 1; i <= 4; i++) {
    const circ = document.getElementById('pcirc' + i);
    const item = document.getElementById('prog' + i);
    circ.classList.remove('active', 'done');
    item.classList.remove('active');
    if (i < active)        { circ.classList.add('done');   circ.textContent = '✓'; }
    else if (i === active) { circ.classList.add('active'); circ.textContent = i; item.classList.add('active'); }
    else                   { circ.textContent = i; }
    if (i < 4) document.getElementById('pline' + i).classList.toggle('done', i < active);
  }
}

// ── Step 1: issue type ─────────────────────────────────────────
document.querySelectorAll('.issue-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.issue-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedCategory = card.dataset.value;
    document.getElementById('next1Btn').disabled = false;
  });
});
document.getElementById('next1Btn').addEventListener('click', () => goToStep(2));

// ── Step 2: map ────────────────────────────────────────────────
let map, marker;

function initMap() {
  if (map) { setTimeout(() => map.invalidateSize(), 100); return; }
  map = L.map('map').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
  }).addTo(map);
  map.on('click', e => { selectedLat = e.latlng.lat; selectedLng = e.latlng.lng; placeMarker(e.latlng); });
}

function placeMarker(latlng) {
  if (marker) marker.setLatLng(latlng);
  else {
    marker = L.marker(latlng, { draggable: true }).addTo(map);
    marker.on('dragend', ev => { selectedLat = ev.target.getLatLng().lat; selectedLng = ev.target.getLatLng().lng; });
  }
}

document.getElementById('useLocationBtn').addEventListener('click', () => {
  const btn    = document.getElementById('useLocationBtn');
  const status = document.getElementById('locationStatus');

  // Geolocation requires HTTPS on mobile — detect and explain clearly
  const isHTTP     = location.protocol === 'http:';
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (!navigator.geolocation) {
    status.textContent = '❌ Geolocation not supported by this browser';
    status.style.color = 'var(--red)';
    return;
  }

  if (isHTTP && isMobileUA) {
    status.innerHTML = '📌 Tip: On mobile, tap the map directly to drop a pin — it\'s faster!';
    status.style.color = 'var(--gray-500)';
    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  btn.disabled = true; btn.textContent = '📡 Locating…';
  status.textContent = ''; 

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      selectedLat = lat; selectedLng = lng;
      map.setView([lat, lng], 16);
      placeMarker(L.latLng(lat, lng));
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        .then(r => r.json()).then(d => {
          document.getElementById('addressInput').value = d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          status.textContent = '✅ Location detected'; status.style.color = 'var(--green-600)';
        }).catch(() => {
          document.getElementById('addressInput').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          status.textContent = '✅ Coordinates set'; status.style.color = 'var(--green-600)';
        });
      btn.disabled = false; btn.textContent = '📍 Use Current Location';
    },
    err => {
      btn.disabled = false; btn.textContent = '📍 Use Current Location';
      if (err.code === 1) {
        // PERMISSION_DENIED — on mobile over HTTP this is the actual error code returned
        if (isHTTP && isMobileUA) {
          status.innerHTML = '📌 Tip: Tap the map to drop a pin on your location manually.';
          status.style.color = 'var(--gray-500)';
          document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          status.textContent = '❌ Permission denied — please allow location in browser settings.';
          status.style.color = 'var(--red)';
        }
      } else if (err.code === 2) {
        status.textContent = '❌ Location unavailable. Tap the map to set manually.';
        status.style.color = 'var(--red)';
      } else if (err.code === 3) {
        status.textContent = '❌ Location timed out. Tap the map to set manually.';
        status.style.color = 'var(--red)';
      } else {
        status.textContent = '❌ Could not get location. Tap the map to set manually.';
        status.style.color = 'var(--red)';
      }
    },
    { timeout: 10000, maximumAge: 60000 }
  );
});

document.getElementById('next2Btn').addEventListener('click', () => {
  const addr = document.getElementById('addressInput').value.trim();
  if (!addr) { document.getElementById('addressInput').classList.add('error'); Toast.show('Please enter an address', 'warning'); return; }
  document.getElementById('addressInput').classList.remove('error');
  goToStep(3);
});

// ── Step 3: photos ─────────────────────────────────────────────
const uploadArea  = document.getElementById('uploadArea');
const fileInput   = document.getElementById('fileInput');
const previewGrid = document.getElementById('imagePreviewGrid');

function updateCounter() {
  const n = uploadedImages.length;
  document.getElementById('photoCounter').textContent = n === 0
    ? '0 / 5 photos added — at least 1 required'
    : n + ' / 5 photo' + (n > 1 ? 's' : '') + ' added';
  document.getElementById('photoCounter').style.color = n > 0 ? 'var(--green-600)' : 'var(--gray-500)';
  document.getElementById('next3Btn').disabled = n === 0;
}

function addFiles(files) {
  Array.from(files).forEach(file => {
    if (uploadedImages.length >= 5) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { Toast.show('Max 5 MB per photo', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      uploadedImages.push(ev.target.result);
      renderPreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  previewGrid.innerHTML = uploadedImages.map((src, i) => `
    <div class="image-preview-item">
      <img src="${src}" alt="Photo ${i+1}">
      <div class="image-preview-remove" onclick="removeImage(${i})">✕</div>
    </div>`).join('');
  updateCounter();
}

function removeImage(i) { uploadedImages.splice(i, 1); renderPreviews(); }
window.removeImage = removeImage;

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('drag-over'); addFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

document.getElementById('next3Btn').addEventListener('click', () => {
  if (uploadedImages.length === 0) { Toast.show('Please add at least one photo', 'warning'); return; }
  goToStep(4);
});

updateCounter();

// ── Step 4: description ────────────────────────────────────────
document.getElementById('descInput').addEventListener('input', function () {
  const n = this.value.length;
  document.getElementById('charCount').textContent = n + ' / 500';
  document.getElementById('charCount').classList.toggle('warn', n > 400);
});

// ── Submit ─────────────────────────────────────────────────────
document.getElementById('submitBtn').addEventListener('click', async () => {
  if (!Auth.isLoggedIn()) {
    Toast.show('Please sign in to submit', 'warning');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }
  const desc = document.getElementById('descInput').value.trim();
  if (!desc) {
    document.getElementById('descInput').classList.add('error');
    Toast.show('Please add a description', 'warning');
    return;
  }
  document.getElementById('descInput').classList.remove('error');
  if (uploadedImages.length === 0) { Toast.show('Please add at least one photo', 'warning'); goToStep(3); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  const payload = {
    category:    selectedCategory,
    description: desc,
    address:     document.getElementById('addressInput').value.trim(),
    latitude:    selectedLat,
    longitude:   selectedLng,
    images:      uploadedImages,
    visibility:  document.getElementById('publicToggle').checked ? 'public' : 'private',
    priority:    document.getElementById('prioritySelect').value,
  };
  console.log('[CleanCity] Submitting complaint, images count:', payload.images.length);
  if (payload.images.length > 0) console.log('[CleanCity] First image prefix:', payload.images[0].substring(0, 60));

  try {
    const res = await http(API.complaints.create, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Hide step 4, show success
    document.getElementById('step4').classList.remove('active');
    document.getElementById('submitSuccess').classList.add('show');
    document.getElementById('successId').textContent = res.complaint_id;
    document.getElementById('trackLink').href = 'track.html?id=' + res.complaint_id;
    updateProgress(5);
    Toast.show('Report submitted! 🌿');
  } catch (err) {
    Toast.show(err.message || 'Failed to submit. Is the backend running?', 'error');
    btn.disabled = false; btn.textContent = 'Submit Report 📢';
  }
});

// ── Camera modal ───────────────────────────────────────────────
let camStream  = null;
let facingMode = 'environment';

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

async function openCamera() {
  if (isMobile()) {
    // On mobile: dynamically create a fresh input with capture="environment"
    // This forces the native camera app to open directly (not the file picker)
    const tmp = document.createElement('input');
    tmp.type    = 'file';
    tmp.accept  = 'image/*';
    tmp.capture = 'environment'; // back camera
    tmp.style.display = 'none';
    document.body.appendChild(tmp);
    tmp.addEventListener('change', () => {
      if (tmp.files && tmp.files.length) addFiles(tmp.files);
      document.body.removeChild(tmp);
    });
    tmp.click();
    return;
  }
  // Desktop: use getUserMedia in-page camera modal
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.getElementById('fileInput').click();
    return;
  }
  document.getElementById('camModal').classList.add('open');
  document.getElementById('camError').style.display = 'none';
  document.body.style.overflow = 'hidden';
  await _startStream();
}
window.openCamera = openCamera;

async function _startStream() {
  if (camStream) camStream.getTracks().forEach(t => t.stop());
  const video = document.getElementById('camVideo');
  const errEl = document.getElementById('camError');
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = camStream;
    document.getElementById('camFacing').textContent =
      facingMode === 'environment' ? 'back camera' : 'front camera';
  } catch (err) {
    errEl.style.display = 'block';
    errEl.textContent =
      err.name === 'NotAllowedError' ? 'Camera permission denied. Allow access in browser settings.' :
      err.name === 'NotFoundError'   ? 'No camera found on this device.' :
      'Could not open camera: ' + err.message;
  }
}

function closeCamera() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  document.getElementById('camVideo').srcObject = null;
  document.getElementById('camModal').classList.remove('open');
  document.body.style.overflow = '';
}
window.closeCamera = closeCamera;

function camTakePhoto() {
  const video  = document.getElementById('camVideo');
  const canvas = document.getElementById('camCanvas');
  if (!camStream) { Toast.show('Camera not ready', 'warning'); return; }
  if (uploadedImages.length >= 5) { Toast.show('Maximum 5 photos reached', 'warning'); closeCamera(); return; }

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  uploadedImages.push(dataUrl);
  renderPreviews();

  // Flash effect
  const flash = document.createElement('div');
  Object.assign(flash.style, { position:'fixed', inset:'0', background:'white', opacity:'0.8',
    zIndex:'99999', pointerEvents:'none', transition:'opacity 0.18s' });
  document.body.appendChild(flash);
  setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 200); }, 30);

  Toast.show('Photo captured! 📷');
  if (uploadedImages.length >= 5) closeCamera();
}
window.camTakePhoto = camTakePhoto;

async function camSwitchFacing() {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  document.getElementById('camError').style.display = 'none';
  await _startStream();
}
window.camSwitchFacing = camSwitchFacing;