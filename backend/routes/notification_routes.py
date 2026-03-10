from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
import extensions

notification_bp = Blueprint("notifications", __name__)


@notification_bp.route("/", methods=["GET"])
@jwt_required()
def my_notifications():
    user_id = get_jwt_identity()
    notifications = list(
        extensions.db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(50)
    )
    for n in notifications:
        n["_id"] = str(n["_id"])
        if isinstance(n.get("created_at"), datetime):
            n["created_at"] = n["created_at"].isoformat() + 'Z'
    return jsonify(notifications), 200


@notification_bp.route("/read", methods=["PATCH"])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    result = extensions.db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return jsonify({"message": "Notifications marked as read", "updated": result.modified_count}), 200


@notification_bp.route("/<notification_id>/read", methods=["PATCH"])
@jwt_required()
def mark_one_read(notification_id):
    user_id = get_jwt_identity()
    try:
        oid = ObjectId(notification_id)
    except Exception:
        return jsonify({"error": "Invalid notification ID"}), 400
    extensions.db.notifications.update_one(
        {"_id": oid, "user_id": user_id},
        {"$set": {"read": True}}
    )
    return jsonify({"message": "Notification marked as read"}), 200