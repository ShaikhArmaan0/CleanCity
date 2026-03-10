from pymongo import MongoClient
from utils.jwt_utils import hash_password
from config import Config

db = MongoClient(Config.MONGO_URI).get_default_database()

db.users.update_one(
    {"phone": "9876543210"},          # ← your registered phone number
    {"$set": {
        "email": "admin@cleancity.gov",       # ← email you'll use to login
        "password": hash_password("Admin@123"),  # ← your admin password
        "role": "admin"
    }}
)

print("✅ Admin account created successfully!")