import os
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from pymongo import MongoClient

jwt  = JWTManager()
cors = CORS()

# MongoClient is lazy-initialised in create_app() after config is loaded
# We store the db reference globally so routes can import it
_client = None
db      = None


def init_db(mongo_uri: str):
    """Call this once from create_app() after config is loaded."""
    global _client, db
    _client = MongoClient(mongo_uri)
    db_name = mongo_uri.split('/')[-1] or 'cleancity'
    db = _client[db_name]
    return db
