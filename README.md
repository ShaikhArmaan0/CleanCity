# 🌿 CleanCity — Full Stack Civic Reporting Platform

## Quick Start

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
# Backend runs at http://localhost:5000
```

**Requirements**: Python 3.8+, MongoDB running on `localhost:27017`

Install MongoDB: https://www.mongodb.com/try/download/community

### Frontend Setup

Open `frontend/pages/index.html` in a browser.  
**No build step needed** — pure HTML/CSS/JS.

For local dev with proper routing, use a simple server:
```bash
cd frontend
npx serve .   # or python -m http.server 3000
```

Then open `http://localhost:3000/pages/index.html`

---

## Project Structure

```
cleancity/
├── backend/
│   ├── app.py               # Flask entry point
│   ├── config.py            # Configuration
│   ├── extensions.py        # JWT, CORS, MongoDB
│   ├── requirements.txt
│   ├── models/
│   │   ├── user_model.py
│   │   ├── complaint_model.py
│   │   └── vote_model.py
│   ├── routes/
│   │   ├── auth_routes.py        # /api/auth
│   │   ├── complaint_routes.py   # /api/complaints
│   │   ├── vote_routes.py        # /api/votes
│   │   ├── notification_routes.py# /api/notifications
│   │   └── user_routes.py        # /api/users
│   └── utils/
│       ├── jwt_utils.py     # Password hashing
│       ├── otp_utils.py     # OTP generation (mock, prints to console)
│       └── response_utils.py
└── frontend/
    ├── css/styles.css        # Full design system
    ├── js/
    │   ├── app.js            # Shared utilities (toast, animations)
    │   ├── core/
    │   │   ├── api.config.js # API URLs + HTTP helpers
    │   │   └── auth.service.js # JWT session management
    │   └── ui/               # Page-specific UI logic (inline in pages)
    └── pages/
        ├── index.html        # Landing page
        ├── login.html        # Auth (OTP + password)
        ├── dashboard.html    # User dashboard
        ├── report.html       # Multi-step report form
        ├── track.html        # Complaint tracker
        └── complaints.html   # Public feed
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP, get temp token |
| POST | `/api/auth/complete-profile` | Register new user (requires temp token) |
| POST | `/api/auth/login` | Login with phone + password |
| GET  | `/api/auth/me` | Get current user (JWT required) |

### Complaints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/complaints/` | Create complaint (JWT required) |
| GET  | `/api/complaints/my` | My complaints (JWT required) |
| GET  | `/api/complaints/public` | All public complaints |
| GET  | `/api/complaints/trending` | Top voted complaints |
| GET  | `/api/complaints/<id>` | Single complaint |
| GET  | `/api/complaints/<id>/history` | Status history (JWT required) |
| PATCH| `/api/complaints/<id>/status` | Update status (JWT required) |

### Votes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/votes/<complaint_id>` | Vote on complaint (JWT required) |
| GET  | `/api/votes/<complaint_id>/count` | Vote count |
| GET  | `/api/votes/my` | My votes (JWT required) |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/notifications/` | My notifications (JWT required) |
| PATCH| `/api/notifications/read` | Mark all as read (JWT required) |

---

## OTP Development Mode

OTPs are printed to the Flask console (no SMS service required):
```
[MOCK OTP] +919876543210 -> 483921
```

To add real SMS, update `backend/utils/otp_utils.py` with Twilio/MSG91.

---

## Design System

- **Fonts**: Fraunces (display) + DM Sans (body)
- **Colors**: Forest green palette + warm cream backgrounds
- **Animation**: CSS keyframes + IntersectionObserver for scroll reveals
- **No frameworks**: Pure vanilla JS, HTML5, CSS3
