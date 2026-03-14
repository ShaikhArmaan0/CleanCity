from flask import Flask, jsonify
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
    cors.init_app(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})
    init_db(app)

    # Ensure CORS headers on every response including errors
    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"]  = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    @app.route("/")
    def health():
        return jsonify({
            "status": "live",
            "app": "CleanCity API",
            "message": "🌿 CleanCity backend is running!"
        }), 200

    @app.route("/api/", methods=["OPTIONS"])
    @app.route("/api/<path:path>", methods=["OPTIONS"])
    def handle_options(path=""):
        return "", 204

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