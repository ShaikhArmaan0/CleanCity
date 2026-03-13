from flask_jwt_extended import JWTManager
from flask_cors import CORS
from pymongo import MongoClient

jwt  = JWTManager()
cors = CORS()

client = None
db     = None

def init_db(app):
    global client, db
    mongo_uri = app.config.get("MONGO_URI", "mongodb://localhost:27017/cleancity")
    client = MongoClient(mongo_uri)
    # Extract DB name from URI or default to "cleancity"
    db_name = mongo_uri.split("/")[-1].split("?")[0] or "cleancity"
    db = client[db_name]
    app.extensions["db"] = db