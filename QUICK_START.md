# CleanCity – Quick Start Guide

## Project Structure
```
cleancity/
├── backend/           # Flask API
│   ├── app.py         # Entry point
│   ├── config.py      # Config (change MONGO_URI here)
│   ├── extensions.py  # Flask extensions + MongoDB client
│   ├── models/        # Data models
│   ├── routes/        # API route handlers
│   └── utils/         # OTP, JWT, response helpers
│
└── frontend/          # Vanilla HTML/CSS/JS
    ├── css/styles.css # Shared design system
    ├── js/core/       # API config + Auth helpers
    └── pages/         # All HTML pages
```

## Backend Setup

1. Install Python 3.8+ and MongoDB
2. Start MongoDB: `mongod`
3. Install deps: `pip install -r backend/requirements.txt`
4. Run: `python backend/app.py` (runs on http://localhost:5000)

## Frontend Setup

Just open `frontend/pages/index.html` in a browser, or use VS Code Live Server.

> The frontend expects the backend at `http://localhost:5000`. Update `frontend/js/core/api.config.js` to change the API URL.

## Pages
- `index.html`       — Landing page with stats, hero, how-it-works
- `login.html`       — Phone OTP authentication + registration
- `dashboard.html`   — User analytics, score ring, recent activity
- `report.html`      — 4-step complaint submission form
- `track.html`       — Complaint tracking with animated timeline
- `complaints.html`  — Public feed with voting, filters, comments drawer

## Dev Notes
- OTP is returned in the API response for development (remove in production)
- Images are stored as base64 in development (use a file upload service in production)
- JWT tokens expire in 24 hours
- Cleanliness score: +10 per complaint, +2 per vote cast
