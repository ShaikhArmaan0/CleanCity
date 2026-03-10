from flask_jwt_extended import JWTManager
from flask_cors import CORS
from pymongo import MongoClient

jwt  = JWTManager()
cors = CORS()

# Global DB reference — populated by init_db() called from app.py
client = None
db     = None

def init_db(mongo_uri):
    """Called once from create_app() to connect to MongoDB."""
    global client, db
    client = MongoClient(mongo_uri)
    # Extract database name from URI, default to 'cleancity'
    db_name = mongo_uri.rstrip("/").split("/")[-1] or "cleancity"
    db = client[db_name]
    return db