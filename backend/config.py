import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env file from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


class Config:
    SECRET_KEY      = os.environ.get('d78571217af15a2644e1a008806e3729d40820b942822e16d6fda96cf7207dee', 'dev-fallback-secret')
    JWT_SECRET_KEY  = os.environ.get('J520e9eae56933a4db9f55c16d238f8f6211a33935cce81eab233921284068dd0', 'dev-fallback-jwt-secret')
    MONGO_URI       = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/cleancity')
    FLASK_ENV       = os.environ.get('FLASK_ENV', 'development')
    DEV_MODE        = os.environ.get('DEV_MODE', 'true').lower() == 'true'

    # JWT tokens expire after N days (set in .env)
    _expires_days = int(os.environ.get('JWT_EXPIRES_DAYS', '7'))
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=_expires_days)
