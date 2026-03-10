from flask import Flask
from config import Config
from extensions import jwt, cors, init_db

from routes.notification_routes import notification_bp
from routes.auth_routes import auth_bp
from routes.complaint_routes import complaint_bp
from routes.vote_routes import vote_bp
from routes.user_routes import user_bp
from routes.comment_routes import comment_bp
from routes.admin_routes import admin_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Init extensions
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Init MongoDB
    init_db(app.config["MONGO_URI"])

    # Register blueprints
    app.register_blueprint(auth_bp,          url_prefix="/api/auth")
    app.register_blueprint(complaint_bp,     url_prefix="/api/complaints")
    app.register_blueprint(vote_bp,          url_prefix="/api/votes")
    app.register_blueprint(user_bp,          url_prefix="/api/users")
    app.register_blueprint(comment_bp,       url_prefix="/api/comments")
    app.register_blueprint(notification_bp,  url_prefix="/api/notifications")
    app.register_blueprint(admin_bp,         url_prefix="/api/admin")

    print(app.url_map)
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)