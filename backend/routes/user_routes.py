from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import extensions
from bson import ObjectId
import hashlib

user_bp = Blueprint("users", __name__)


def _hash(pw):
    return hashlib.sha256(pw.encode()).hexdigest()


@user_bp.route("/", methods=["GET"])
def health_check():
    return jsonify({"message": "User routes working"})


@user_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    try:
        user = extensions.db.users.find_one(
            {"_id": ObjectId(user_id)}, {"password": 0}
        )
    except Exception:
        return jsonify({"error": "Invalid user"}), 400
    if not user:
        return jsonify({"error": "User not found"}), 404
    user["_id"] = str(user["_id"])
    # Stats
    user["total_reports"]   = extensions.db.complaints.count_documents({"user_id": user_id})
    user["resolved_reports"]= extensions.db.complaints.count_documents({"user_id": user_id, "status": "resolved"})
    user["total_votes"]     = extensions.db.votes.count_documents({"user_id": user_id})
    return jsonify(user), 200


@user_bp.route("/profile", methods=["PATCH"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    data = request.json or {}
    allowed = ["name", "email", "address", "area", "bio"]
    update  = {k: data[k].strip() if isinstance(data[k], str) else data[k]
               for k in allowed if k in data and data[k] is not None}
    if not update:
        return jsonify({"error": "Nothing to update"}), 400
    extensions.db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    updated = extensions.db.users.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    updated["_id"] = str(updated["_id"])
    return jsonify({"message": "Profile updated", "user": updated}), 200


@user_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data    = request.json or {}
    old_pw  = data.get("old_password", "")
    new_pw  = data.get("new_password", "")
    if not old_pw or not new_pw:
        return jsonify({"error": "Both old and new passwords are required"}), 400
    if len(new_pw) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400
    user = extensions.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("password") != _hash(old_pw):
        return jsonify({"error": "Current password is incorrect"}), 400
    extensions.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": _hash(new_pw)}}
    )
    return jsonify({"message": "Password updated successfully"}), 200