from flask import Flask
from config import Config
from extensions import jwt, cors, init_db

from routes.auth_routes import auth_bp
from routes.complaint_routes import complaint_bp
from routes.vote_routes import vote_bp
from routes.user_routes import user_bp
from routes.notification_routes import notification_bp
from routes.admin_routes import admin_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:3000",
        "https://shaikharmaan0.github.io",
    ]}})
    init_db(app)

    app.register_blueprint(auth_bp,         url_prefix="/api/auth")
    app.register_blueprint(complaint_bp,    url_prefix="/api/complaints")
    app.register_blueprint(vote_bp,         url_prefix="/api/votes")
    app.register_blueprint(user_bp,         url_prefix="/api/users")
    app.register_blueprint(notification_bp, url_prefix="/api/notifications")
    app.register_blueprint(admin_bp,        url_prefix="/api/admin")

    return app

# ← This is what gunicorn needs — app at module level
app = create_app()

if __name__ == "__main__":
    app.run(debug=True)