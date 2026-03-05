import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


class Config:
    SECRET_KEY      = os.environ.get('SECRET_KEY', 'dev-fallback-secret')
    JWT_SECRET_KEY  = os.environ.get('JWT_SECRET_KEY', 'dev-fallback-jwt-secret')
    MONGO_URI       = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cleancity')
    FLASK_ENV       = os.environ.get('FLASK_ENV', 'development')
    DEV_MODE        = os.environ.get('DEV_MODE', 'true').lower() == 'true'

    # JWT tokens expire after N days (set in .env)
    _expires_days = int(os.environ.get('JWT_EXPIRES_DAYS', '7'))
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=_expires_days)
