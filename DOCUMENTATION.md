# CleanCity – Complete Project Documentation

> A community-driven civic waste reporting and tracking platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [File & Folder Structure](#3-file--folder-structure)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [Authentication Flow](#8-authentication-flow)
9. [Map Integration (Leaflet.js)](#9-map-integration-leafletjs)
10. [Admin Panel — Planned Features](#10-admin-panel--planned-features)
11. [How to Run Locally](#11-how-to-run-locally)
12. [Environment Variables](#12-environment-variables)
13. [Known Limitations & Future Work](#13-known-limitations--future-work)

---

## 1. Project Overview

CleanCity is a full-stack web application that lets citizens report civic waste issues (garbage overflow, illegal dumping, drainage problems, etc.), vote on reports from the community, and track the status of complaints in real time. Authorities can update complaint statuses, which triggers notifications to the reporter.

**Core user journey:**
1. Citizen registers via phone OTP
2. Reports a waste issue with location pin + photos + description
3. Other citizens find the report and upvote it to signal urgency
4. Authority updates the status (Submitted → In Progress → Resolved)
5. Reporter gets notified; cleanliness score updates

---

## 2. Technology Stack

### Frontend
| Layer | Tool | Notes |
|---|---|---|
| Markup | HTML5 (semantic) | No frameworks |
| Styling | CSS3 (custom design system) | CSS variables, responsive |
| JavaScript | Vanilla ES6+ | No frameworks; modular external files |
| Map | **Leaflet.js v1.9.4** | OpenStreetMap tiles; pin-drop; geolocation |
| Map tiles | **OpenStreetMap** | Free, no API key required |
| Fonts | Google Fonts | Fraunces (display) + Outfit (body) |
| CDN | unpkg.com | Leaflet JS + CSS |

### Backend
| Layer | Tool | Notes |
|---|---|---|
| Framework | **Flask** (Python 3.x) | Lightweight REST API |
| Auth | **Flask-JWT-Extended** | JWT tokens; Bearer auth |
| Database driver | **PyMongo** | Connects Flask to MongoDB |
| CORS | **Flask-CORS** | Allows frontend to call the API |
| Password hashing | `hashlib.sha256` | Simple SHA-256 (upgrade to bcrypt for production) |
| OTP generation | `random.randint` | Mock; prints to console in dev mode |

### Database
| Layer | Tool | Notes |
|---|---|---|
| Database | **MongoDB** | Document store; runs on localhost:27017 |
| Collections | users, complaints, votes, notifications, otp_verifications | |
| ObjectId | `bson.ObjectId` | All document IDs |

### Python packages (`requirements.txt`)
```
flask
flask-jwt-extended
flask-cors
pymongo
```

---

## 3. File & Folder Structure

```
cleancity/
│
├── backend/
│   ├── app.py                      # Flask app factory + blueprint registration
│   ├── config.py                   # Secret keys, JWT config
│   ├── extensions.py               # JWTManager, CORS, MongoClient instances
│   ├── requirements.txt
│   │
│   ├── models/                     # (placeholder — logic lives in routes for now)
│   │   ├── user_model.py
│   │   ├── complaint_model.py
│   │   └── vote_model.py
│   │
│   ├── routes/
│   │   ├── auth_routes.py          # OTP send/verify, register, login, /me
│   │   ├── complaint_routes.py     # CRUD complaints, trending, public feed
│   │   ├── vote_routes.py          # Cast vote, my votes, vote count
│   │   ├── notification_routes.py  # List & mark-read notifications
│   │   └── user_routes.py          # Update profile
│   │
│   └── utils/
│       ├── jwt_utils.py            # hash_password(), verify_password()
│       └── otp_utils.py            # generate_otp() — stores in DB, prints to console
│
└── frontend/
    ├── css/
    │   └── styles.css              # Global design system (CSS variables, all components)
    │
    ├── js/
    │   ├── core/
    │   │   └── api.config.js       # API URL map, http() helper, Toast, Auth utilities
    │   │
    │   └── pages/                  # One JS file per page — zero inline JS in HTML
    │       ├── index.js
    │       ├── login.js
    │       ├── dashboard.js
    │       ├── complaints.js
    │       ├── report.js
    │       └── track.js
    │
    └── pages/                      # Pure HTML markup — no <script> blocks
        ├── index.html
        ├── login.html
        ├── dashboard.html
        ├── complaints.html
        ├── report.html
        └── track.html
```

---

## 4. Frontend Architecture

### Design System (`css/styles.css`)

All visual tokens live as CSS custom properties:

```css
--green-50 … --green-900   /* forest green palette */
--beige-50 … --beige-900   /* warm cream palette */
--gray-50  … --gray-900    /* neutral greys */
--radius-sm | md | lg | xl | full
--shadow-sm | md | lg
--font-display: 'Fraunces'  /* serif for headings */
--font-body:   'Outfit'     /* clean sans-serif */
```

Component classes: `.btn`, `.card`, `.badge`, `.toast`, `.toggle-switch`, `.skeleton`, `.reveal`, `.navbar`, `.mobile-menu`

### Shared JS utilities (`js/core/api.config.js`)

**`API` object** — all endpoint URLs in one place:
```js
API.auth.sendOtp           // POST /api/auth/send-otp
API.auth.verifyOtp         // POST /api/auth/verify-otp
API.auth.completeProfile   // POST /api/auth/complete-profile
API.auth.login             // POST /api/auth/login
API.auth.me                // GET  /api/auth/me
API.complaints.public      // GET  /api/complaints/public
API.complaints.my          // GET  /api/complaints/my
API.complaints.trending    // GET  /api/complaints/trending
API.complaints.create      // POST /api/complaints/
API.complaints.byId(id)    // GET  /api/complaints/:id
API.votes.cast(id)         // POST /api/votes/:id
API.votes.my               // GET  /api/votes/my
API.notifications.list     // GET  /api/notifications/
API.notifications.markRead // PATCH /api/notifications/read
```

**`http(url, options)`** — fetch wrapper that:
- Automatically injects `Authorization: Bearer <token>` header
- Parses JSON and returns it directly (no `.data` wrapper)
- Throws an Error with `err.message` on non-2xx responses
- Auto-redirects to `login.html` on 401

**`Toast`** — `Toast.show(message, type, duration)` — types: `success | error | warning | info`

**`Auth`** — session helpers:
- `Auth.isLoggedIn()` — checks for `cc_token` in localStorage
- `Auth.getUser()` — parses `cc_user` from localStorage
- `Auth.setSession(token, user)` — stores both
- `Auth.clearSession()` — removes all `cc_*` keys
- `Auth.requireAuth()` — redirects to login if not authenticated

### Page JS files (`js/pages/`)

Each file handles exactly one page. They rely on `api.config.js` being loaded first (declared in HTML `<script>` tag order).

| File | Responsibilities |
|---|---|
| `index.js` | Navbar scroll, hamburger, scroll-reveal, animated live counters |
| `login.js` | OTP flow (send → verify → register), resend timer, auto-tab OTP inputs |
| `dashboard.js` | Load profile + complaints + votes in parallel; SVG ring animation |
| `complaints.js` | Filter/sort feed, card rendering, vote handler, slide-in drawer |
| `report.js` | 4-step form, Leaflet map, drag-drop image upload, submit |
| `track.js` | Complaint lookup by ID, timeline rendering, URL param auto-track |

### Pages (`pages/`)

All 6 HTML files contain **zero `<script>` blocks** — only markup and two `<script src>` tags at the bottom:
1. `../js/core/api.config.js` (shared utilities)
2. `../js/pages/<page>.js` (page logic)

`report.html` has an additional Leaflet CDN script before the others.

---

## 5. Backend Architecture

### App factory (`app.py`)

```python
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    # Blueprints:
    app.register_blueprint(auth_bp,         url_prefix="/api/auth")
    app.register_blueprint(complaint_bp,    url_prefix="/api/complaints")
    app.register_blueprint(vote_bp,         url_prefix="/api/votes")
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(user_bp,         url_prefix="/api/users")
    return app
```

### Route files

**`auth_routes.py`**
- `POST /api/auth/send-otp` — Generates 6-digit OTP, stores in `otp_verifications` collection with 5-minute expiry. In dev mode, returns the OTP in the response body (`dev_otp`).
- `POST /api/auth/verify-otp` — Validates OTP. Returns `temp_token` (phone as identity) for new users, or a real JWT + user object for existing users.
- `POST /api/auth/complete-profile` — Protected by temp token. Creates the user, returns a real JWT.
- `POST /api/auth/login` — Phone + password login.
- `GET  /api/auth/me` — Returns current user (requires real JWT).

**`complaint_routes.py`**
- Route order matters: `/trending`, `/public`, `/my`, `/` (POST) are declared **before** `/<complaint_id>` to avoid Flask matching "trending" as an ID.
- `serialize(complaint)` helper converts `ObjectId` and `datetime` fields to JSON-safe strings.
- Creating a complaint increments `cleanlinessScore` by 10 on the user.

**`vote_routes.py`**
- `/my` route is declared **before** `/<complaint_id>` (same routing order issue).
- Prevents duplicate votes via `db.votes.find_one({user_id, complaint_id})`.
- Increments embedded `votes` counter on the complaint document.
- Increments voter's `cleanlinessScore` by 2.
- Creates a notification for the complaint owner (except self-votes).

**`notification_routes.py`**
- Lists last 50 notifications sorted by date.
- Serializes all `datetime` fields before `jsonify`.

---

## 6. Database Schema

### `users`
```json
{
  "_id": ObjectId,
  "name": "string",
  "phone": "string (unique)",
  "email": "string",
  "password": "sha256 hex string",
  "address": "string",
  "role": "citizen | admin",
  "cleanlinessScore": 0,
  "is_active": true,
  "created_at": ISODate,
  "last_login": ISODate
}
```

### `complaints`
```json
{
  "_id": ObjectId,
  "user_id": "string (JWT identity)",
  "category": "garbage | drainage | illegal_dumping | broken_infrastructure | public_hygiene | other",
  "description": "string",
  "address": "string",
  "latitude": float,
  "longitude": float,
  "visibility": "public | private",
  "priority": "normal | high | urgent",
  "status": "submitted | in_progress | resolved",
  "votes": 0,
  "created_at": ISODate,
  "updated_at": ISODate,
  "status_history": [
    { "status": "submitted", "message": "string", "updated_at": ISODate }
  ]
}
```

### `votes`
```json
{
  "_id": ObjectId,
  "user_id": "string",
  "complaint_id": ObjectId,
  "created_at": ISODate
}
```

### `notifications`
```json
{
  "_id": ObjectId,
  "user_id": "string",
  "type": "VOTE | STATUS_UPDATE",
  "message": "string",
  "complaint_id": "string",
  "read": false,
  "created_at": ISODate
}
```

### `otp_verifications`
```json
{
  "_id": ObjectId,
  "phone": "string",
  "otp": "6-digit string",
  "verified": false,
  "expires_at": ISODate,
  "created_at": ISODate
}
```

---

## 7. API Reference

Base URL: `http://localhost:5000/api`

All protected routes require: `Authorization: Bearer <jwt_token>`

### Auth

| Method | Endpoint | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/send-otp` | None | `{ phone }` | `{ message, dev_otp }` |
| POST | `/auth/verify-otp` | None | `{ phone, otp }` | `{ existing_user, temp_token, token?, user? }` |
| POST | `/auth/complete-profile` | Temp token | `{ name, password, email?, address? }` | `{ token, user }` |
| POST | `/auth/login` | None | `{ phone, password }` | `{ token, user }` |
| GET | `/auth/me` | JWT | — | User object |

### Complaints

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/complaints/` | JWT | Create; returns `{ complaint_id }` |
| GET | `/complaints/public` | None | Filters: `?status=&category=` |
| GET | `/complaints/trending` | None | Top 10 by vote count |
| GET | `/complaints/my` | JWT | Current user's complaints |
| GET | `/complaints/:id` | None | Single complaint |
| GET | `/complaints/:id/history` | None | Status history array |
| PATCH | `/complaints/:id/status` | JWT | Body: `{ status, message? }` |

### Votes

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/votes/:id` | JWT | Cast a vote; 409 if already voted |
| GET | `/votes/:id/count` | None | Vote count for a complaint |
| GET | `/votes/my` | JWT | Current user's votes |

### Notifications

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/notifications/` | JWT | Last 50 notifications |
| PATCH | `/notifications/read` | JWT | Mark all as read |

### Users

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| PATCH | `/users/profile` | JWT | Update name, email, address |

---

## 8. Authentication Flow

```
User enters phone
      │
      ▼
POST /auth/send-otp
→ OTP stored in DB (5-min expiry)
→ OTP printed to Flask console (dev)
→ dev_otp returned in response (dev)
      │
      ▼
User enters 6-digit OTP
      │
      ▼
POST /auth/verify-otp
      │
      ├── existing_user = true
      │       → returns real JWT + user
      │       → frontend saves to localStorage
      │       → redirect to dashboard
      │
      └── existing_user = false
              → returns temp_token (identity = phone string)
              → frontend shows registration form
              │
              ▼
          POST /auth/complete-profile
          (Authorization: Bearer <temp_token>)
              → creates user in DB
              → returns real JWT
              → frontend saves to localStorage
              → redirect to dashboard
```

**Token storage:**
- `cc_token` — JWT (real session token)
- `cc_user` — serialised user object
- `cc_temp_token` — ephemeral OTP-verified token used only during registration
- `cc_temp_phone` — phone number held during OTP flow

---

## 9. Map Integration (Leaflet.js)

**Library:** Leaflet.js v1.9.4 (open-source, no API key)

**Tile provider:** OpenStreetMap (free, attribution required)

**Usage in `report.html`:**
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

**What it does in `report.js`:**
- Initialised lazily when user reaches Step 2 (avoids loading on Step 1)
- Centres on India (lat 20.59, lng 78.96) at zoom 5
- Calls `navigator.geolocation.getCurrentPosition()` to zoom to the user's real location
- Click on map → drops a draggable marker → stores `selectedLat` / `selectedLng`
- These coordinates are submitted with the complaint payload

**No API key is required** — OpenStreetMap tiles are free for low-volume use. For production, consider a tile CDN like Mapbox or Stadia Maps.

---

## 10. Admin Panel — Planned Features

The admin panel will be a separate section (`/admin/`) accessible only to users with `role: "admin"`.

### Pages to build

| Page | Purpose |
|---|---|
| `admin/index.html` | Dashboard: KPIs, charts (complaints by category, resolution rate, daily volume) |
| `admin/complaints.html` | Full complaints table with filters, search, bulk actions |
| `admin/complaint-detail.html` | View single complaint; update status; add internal notes |
| `admin/users.html` | User list; deactivate accounts; promote to admin |
| `admin/reports.html` | Export CSV/Excel; generate weekly report |
| `admin/settings.html` | Categories, city zones, SLA deadlines |

### New backend routes needed

```
GET    /api/admin/stats          — system-wide KPIs
GET    /api/admin/complaints      — all complaints (paginated + filterable)
PATCH  /api/admin/complaints/:id  — update status + add note
GET    /api/admin/users           — all users
PATCH  /api/admin/users/:id       — deactivate / promote
GET    /api/admin/export          — CSV export of complaints
```

### Admin middleware

Add a `@admin_required` decorator to all admin routes:

```python
from functools import wraps
from flask_jwt_extended import get_jwt_identity
from extensions import db
from bson import ObjectId

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper
```

### New JS files to create

```
frontend/js/pages/admin-dashboard.js
frontend/js/pages/admin-complaints.js
frontend/js/pages/admin-users.js
frontend/js/pages/admin-reports.js
```

### Charting library (for admin dashboard)

Recommend **Chart.js** (CDN, no API key):
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

Charts planned:
- **Bar chart** — complaints by category
- **Line chart** — daily complaint volume (last 30 days)
- **Doughnut chart** — status breakdown (submitted / in progress / resolved)
- **Stat cards** — total complaints, avg resolution time, active users

---

## 11. How to Run Locally

### 1. Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows
net start MongoDB
```

MongoDB runs on `mongodb://localhost:27017`

### 2. Start the backend

```bash
cd cleancity/backend
pip install -r requirements.txt
python app.py
# → API available at http://localhost:5000
```

The OTP for any phone number will be **printed to this terminal** during dev.

### 3. Open the frontend

Open `cleancity/frontend/pages/index.html` directly in a browser (file:// protocol works fine for the frontend since all API calls use absolute `http://localhost:5000` URLs).

Or serve with any static server:
```bash
cd cleancity/frontend
python -m http.server 3000
# Open http://localhost:3000/pages/index.html
```

### 4. Create an admin account

After registering via the normal flow, open MongoDB shell or Compass and set:

```js
db.users.updateOne(
  { phone: "+91XXXXXXXXXX" },
  { $set: { role: "admin" } }
)
```

---

## 12. Environment Variables

Currently hardcoded in `config.py`. For production, use environment variables:

```python
class Config:
    SECRET_KEY         = os.environ.get('SECRET_KEY', 'dev-secret')
    JWT_SECRET_KEY     = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret')
    MONGO_URI          = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cleancity')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
```

---

## 13. Known Limitations & Future Work

| Area | Current State | Recommended Upgrade |
|---|---|---|
| Password hashing | `hashlib.sha256` (fast, not salted) | `bcrypt` or `argon2` |
| OTP delivery | Prints to console | Integrate Twilio / MSG91 SMS |
| Image storage | Base64 in payload (large) | AWS S3 / Cloudinary presigned URLs |
| Map tiles | OpenStreetMap CDN | Stadia Maps or Mapbox (better SLA) |
| Pagination | Only public complaints are filtered | Add cursor-based pagination everywhere |
| Search | No full-text search | MongoDB Atlas Search or ElasticSearch |
| Real-time | No websockets | Socket.IO for live status updates |
| Rate limiting | None | Flask-Limiter |
| Tests | None | pytest for backend, Playwright for E2E |
| Deployment | Local only | Gunicorn + Nginx + Docker + cloud DB |
