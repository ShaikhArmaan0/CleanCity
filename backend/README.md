# CleanCity Backend

Flask REST API for the CleanCity civic reporting platform.

## Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Requires MongoDB running on localhost:27017 (or set MONGO_URI env var).

## API Endpoints

### Auth
- POST /api/auth/send-otp — Send OTP to phone
- POST /api/auth/verify-otp — Verify OTP (returns token or temp_token)
- POST /api/auth/register — Complete registration (requires temp_token)
- POST /api/auth/login — Login with phone + password
- GET  /api/auth/me — Get current user (requires token)

### Complaints
- GET  /api/complaints — Public complaints feed (filters: status, category, page, limit)
- POST /api/complaints — Create complaint (auth required)
- GET  /api/complaints/trending — Top voted complaints
- GET  /api/complaints/my — User's own complaints (auth required)
- GET  /api/complaints/:id — Get complaint details
- PATCH /api/complaints/:id/status — Update status (auth required)
- GET  /api/complaints/:id/comments — Get comments
- POST /api/complaints/:id/comments — Post comment (auth required)

### Votes
- POST /api/votes/:complaint_id — Cast vote (auth required)
- GET  /api/votes/my — Get user's voted complaint IDs (auth required)

### Users
- GET  /api/users/profile — Get user profile (auth required)
- PUT  /api/users/profile — Update profile (auth required)
- GET  /api/users/dashboard — Get dashboard data (auth required)
- GET  /api/users/stats — Get public platform stats

### Notifications
- GET  /api/notifications — Get user notifications (auth required)
- PATCH /api/notifications/read/:id — Mark notification as read
- PATCH /api/notifications/read-all — Mark all read
