from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime
from bson import ObjectId
import extensions

comment_bp = Blueprint("comments", __name__)


def serialize_comment(c):
    c = dict(c)
    c["_id"] = str(c["_id"])
    if isinstance(c.get("created_at"), datetime):
        c["created_at"] = c["created_at"].isoformat() + 'Z'
    return c


# ── GET comments for a complaint (public) ─────────────────────
@comment_bp.route("/<complaint_id>", methods=["GET"])
def get_comments(complaint_id):
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    comments = list(
        extensions.db.comments.find({"complaint_id": complaint_id})
        .sort("created_at", 1)
        .limit(100)
    )
    return jsonify([serialize_comment(c) for c in comments]), 200


# ── POST a comment (authenticated) ────────────────────────────
@comment_bp.route("/<complaint_id>", methods=["POST"])
@jwt_required()
def add_comment(complaint_id):
    user_id = get_jwt_identity()

    try:
        ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    complaint = extensions.db.complaints.find_one({"_id": ObjectId(complaint_id)})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    if complaint.get("visibility") != "public":
        return jsonify({"error": "Comments only allowed on public complaints"}), 403

    data = request.json or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400
    if len(text) > 500:
        return jsonify({"error": "Comment too long (max 500 characters)"}), 400

    # Get user name for display
    user = extensions.db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1})
    user_name = user["name"] if user else "Anonymous"

    now = datetime.utcnow()
    comment = {
        "complaint_id": complaint_id,
        "user_id": user_id,
        "user_name": user_name,
        "text": text,
        "created_at": now,
    }

    result = extensions.db.comments.insert_one(comment)
    comment["_id"] = str(result.inserted_id)
    comment["created_at"] = now.isoformat() + 'Z'

    return jsonify(comment), 201


# ── DELETE own comment ─────────────────────────────────────────
@comment_bp.route("/delete/<comment_id>", methods=["DELETE"])
@jwt_required()
def delete_comment(comment_id):
    user_id = get_jwt_identity()
    try:
        oid = ObjectId(comment_id)
    except Exception:
        return jsonify({"error": "Invalid comment ID"}), 400

    comment = extensions.db.comments.find_one({"_id": oid})
    if not comment:
        return jsonify({"error": "Comment not found"}), 404
    if comment["user_id"] != user_id:
        return jsonify({"error": "Not authorised to delete this comment"}), 403

    extensions.db.comments.delete_one({"_id": oid})
    return jsonify({"message": "Comment deleted"}), 200