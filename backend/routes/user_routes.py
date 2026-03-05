from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import extensions
from bson import ObjectId

user_bp = Blueprint("users", __name__)


@user_bp.route("/", methods=["GET"])
def health_check():
    return jsonify({"message": "User routes working"})


@user_bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.json

    allowed = ["name", "email", "address"]
    update = {k: data[k] for k in allowed if k in data}

    extensions.db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return jsonify({"message": "Profile updated"}), 200
