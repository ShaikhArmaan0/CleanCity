from flask import Flask
from config import Config
from extensions import jwt, cors, init_db

from routes.auth_routes         import auth_bp
from routes.complaint_routes    import complaint_bp
from routes.vote_routes         import vote_bp
from routes.notification_routes import notification_bp
from routes.comment_routes      import comment_bp
from routes.user_routes         import user_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Disable trailing-slash redirects — these cause CORS preflight failures
    app.url_map.strict_slashes = False

    # Init extensions
    jwt.init_app(app)

    # Allow ALL origins, methods, and headers (dev mode — lock down for production)
    cors.init_app(app,
        resources={r"/api/*": {"origins": "*"}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        supports_credentials=False
    )

    # Handle OPTIONS preflight globally so CORS headers are always returned
    @app.after_request
    def after_request(response):
        response.headers["Access-Control-Allow-Origin"]  = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    # Init DB
    init_db(app.config["MONGO_URI"])

    # Register blueprints
    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(complaint_bp,     url_prefix="/api/complaints")
    app.register_blueprint(vote_bp,          url_prefix="/api/votes")
    app.register_blueprint(notification_bp,  url_prefix="/api/notifications")
    app.register_blueprint(comment_bp,       url_prefix="/api/comments")
    app.register_blueprint(user_bp,          url_prefix="/api/users")

    return app


if __name__ == "__main__":
    app = create_app()
    debug = app.config.get("DEV_MODE", True)
    # host='0.0.0.0' makes Flask accept connections from all devices on the network
    app.run(debug=debug, host="0.0.0.0", port=5000)