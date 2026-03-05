from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId
import extensions

vote_bp = Blueprint("votes", __name__)


@vote_bp.route("/my", methods=["GET"])
@jwt_required()
def my_votes():
    user_id = get_jwt_identity()
    votes = list(extensions.db.votes.find({"user_id": user_id}).sort("created_at", -1))
    for v in votes:
        v["_id"] = str(v["_id"])
        v["complaint_id"] = str(v["complaint_id"])
        if isinstance(v.get("created_at"), datetime):
            v["created_at"] = v["created_at"].isoformat() + 'Z'
    return jsonify(votes), 200


@vote_bp.route("/<complaint_id>", methods=["POST"])
@jwt_required()
def vote_complaint(complaint_id):
    user_id = get_jwt_identity()

    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    existing = extensions.db.votes.find_one({"user_id": user_id, "complaint_id": oid})

    if existing:
        # ── UNVOTE ──────────────────────────────────────────────
        extensions.db.votes.delete_one({"_id": existing["_id"]})
        extensions.db.complaints.update_one({"_id": oid}, {"$inc": {"votes": -1}})
        extensions.db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"cleanlinessScore": -2}})
        new_count = max(0, complaint.get("votes", 1) - 1)
        return jsonify({"message": "Vote removed", "votes": new_count, "voted": False}), 200
    else:
        # ── VOTE ────────────────────────────────────────────────
        now = datetime.utcnow()
        extensions.db.votes.insert_one({
            "user_id": user_id,
            "complaint_id": oid,
            "created_at": now
        })
        extensions.db.complaints.update_one({"_id": oid}, {"$inc": {"votes": 1}})

        if complaint["user_id"] != user_id:
            extensions.db.notifications.insert_one({
                "user_id": complaint["user_id"],
                "type": "VOTE",
                "message": "Someone upvoted your complaint!",
                "complaint_id": complaint_id,
                "read": False,
                "created_at": now
            })

        extensions.db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"cleanlinessScore": 2}})
        new_count = complaint.get("votes", 0) + 1
        return jsonify({"message": "Vote registered", "votes": new_count, "voted": True}), 201


@vote_bp.route("/<complaint_id>/count", methods=["GET"])
def vote_count(complaint_id):
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    complaint = extensions.db.complaints.find_one({"_id": oid}, {"votes": 1})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify({"complaint_id": complaint_id, "votes": complaint.get("votes", 0)}), 200