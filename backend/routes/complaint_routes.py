from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from datetime import datetime
import extensions
from bson import ObjectId

complaint_bp = Blueprint("complaints", __name__)

# ================= ROOT FALLBACK (handles /api/complaints with no sub-path) =================
@complaint_bp.route("", methods=["GET"])
def complaints_root():
    """Fallback: treat bare /api/complaints as /api/complaints/public"""
    return public_complaints()



def serialize(complaint, thumb_only=False):
    """Convert MongoDB document to JSON-safe dict."""
    c = dict(complaint)
    c["_id"] = str(c["_id"])
    # Serialize datetime objects inside status_history
    if "status_history" in c:
        for item in c["status_history"]:
            if isinstance(item.get("updated_at"), datetime):
                item["updated_at"] = item["updated_at"].isoformat() + 'Z'
    if isinstance(c.get("created_at"), datetime):
        c["created_at"] = c["created_at"].isoformat() + 'Z'
    if isinstance(c.get("updated_at"), datetime):
        c["updated_at"] = c["updated_at"].isoformat() + 'Z'
    # For listings, only send the first image (thumbnail) to keep response small
    if thumb_only and c.get("images") and len(c["images"]) > 1:
        c["images"] = c["images"][:1]
    return c


# ── IMPORTANT: specific routes MUST come before /<complaint_id> ──

# ================= TRENDING (must be before /<id>) =================
@complaint_bp.route("/trending", methods=["GET"])
def trending_complaints():
    pipeline = [
        {"$match": {"visibility": "public"}},
        {"$lookup": {"from": "votes", "localField": "_id", "foreignField": "complaint_id", "as": "vote_list"}},
        {"$addFields": {"vote_count": {"$size": "$vote_list"}}},
        {"$sort": {"vote_count": -1, "created_at": -1}},
        {"$project": {"vote_list": 0}},
        {"$limit": 10}
    ]
    complaints = [serialize(c, thumb_only=True) for c in extensions.db.complaints.aggregate(pipeline)]
    return jsonify(complaints), 200


# ================= PUBLIC COMPLAINTS =================
@complaint_bp.route("/public", methods=["GET"])
def public_complaints():
    status_filter = request.args.get("status", "")
    category_filter = request.args.get("category", "")
    query = {"visibility": "public"}
    if status_filter:
        query["status"] = status_filter
    if category_filter:
        query["category"] = category_filter
    complaints = [serialize(c, thumb_only=True) for c in extensions.db.complaints.find(query).sort("created_at", -1)]
    return jsonify(complaints), 200


# ================= MY COMPLAINTS =================
@complaint_bp.route("/my", methods=["GET"])
@jwt_required()
def my_complaints():
    user_id = get_jwt_identity()
    complaints = [serialize(c, thumb_only=True) for c in extensions.db.complaints.find({"user_id": user_id}).sort("created_at", -1)]
    return jsonify(complaints), 200


# ================= CREATE COMPLAINT =================
@complaint_bp.route("/", methods=["POST"])
@jwt_required()
def create_complaint():
    user_id = get_jwt_identity()
    data = request.json or {}

    if not data.get("category"):
        return jsonify({"error": "Category is required"}), 400
    if not data.get("description"):
        return jsonify({"error": "Description is required"}), 400

    now = datetime.utcnow()
    complaint = {
        "user_id": user_id,
        "category": data.get("category"),
        "description": data.get("description"),
        "address": data.get("address", ""),
        "region":  data.get("region", "").strip(),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "visibility": data.get("visibility", "public"),
        "priority":   data.get("priority", "normal"),
        "images":     data.get("images", []),
        "votes": 0,
        "status": "submitted",
        "created_at": now,
        "updated_at": now,
        "status_history": [
            {"status": "submitted", "message": "Complaint submitted successfully", "updated_at": now}
        ]
    }

    result = extensions.db.complaints.insert_one(complaint)

    # Increment user's total_complaints score
    extensions.db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"cleanlinessScore": 10}})

    return jsonify({
        "message": "Complaint created successfully",
        "complaint_id": str(result.inserted_id)
    }), 201


# ================= GET STATUS HISTORY (no auth required for tracking) =================
@complaint_bp.route("/<complaint_id>/history", methods=["GET"])
def complaint_status_history(complaint_id):
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    complaint = extensions.db.complaints.find_one({"_id": oid}, {"status_history": 1})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    history = complaint.get("status_history", [])
    # Serialize datetimes
    for item in history:
        if isinstance(item.get("updated_at"), datetime):
            item["updated_at"] = item["updated_at"].isoformat() + 'Z'

    return jsonify(history), 200


# ================= UPDATE STATUS =================
@complaint_bp.route("/<complaint_id>/status", methods=["PATCH"])
@jwt_required()
def update_complaint_status(complaint_id):
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    data = request.json or {}
    new_status = data.get("status")
    message = data.get("message", "Status updated")

    valid_statuses = ["submitted", "in_progress", "resolved"]
    if new_status not in valid_statuses:
        return jsonify({"error": f"Invalid status. Must be one of: {valid_statuses}"}), 400

    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    now = datetime.utcnow()
    extensions.db.complaints.update_one(
        {"_id": oid},
        {
            "$set": {"status": new_status, "updated_at": now},
            "$push": {"status_history": {"status": new_status, "message": message, "updated_at": now}}
        }
    )

    extensions.db.notifications.insert_one({
        "user_id": complaint["user_id"],
        "type": "STATUS_UPDATE",
        "message": f"Your complaint status changed to: {new_status.replace('_', ' ').title()}",
        "complaint_id": complaint_id,
        "read": False,
        "created_at": now
    })

    return jsonify({"message": "Status updated", "new_status": new_status}), 200


# ================= DELETE COMPLAINT (owner only) =================
@complaint_bp.route("/<complaint_id>", methods=["DELETE"])
@jwt_required()
def delete_complaint(complaint_id):
    user_id = get_jwt_identity()
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    # Only the owner (or admin/authority) may delete
    user = extensions.db.users.find_one({"_id": ObjectId(user_id)}, {"role": 1})
    is_admin = user and user.get("role") in ("admin", "authority")
    if complaint["user_id"] != user_id and not is_admin:
        return jsonify({"error": "Not authorised to delete this complaint"}), 403

    # Cascade delete all linked data
    extensions.db.votes.delete_many({"complaint_id": complaint_id})
    extensions.db.comments.delete_many({"complaint_id": complaint_id})
    extensions.db.notifications.delete_many({"complaint_id": complaint_id})
    extensions.db.complaints.delete_one({"_id": oid})

    # Reverse the +10 cleanlinessScore given on creation
    extensions.db.users.update_one(
        {"_id": ObjectId(complaint["user_id"])},
        {"$inc": {"cleanlinessScore": -10}}
    )

    return jsonify({"message": "Complaint deleted successfully"}), 200

# ================= GET SINGLE COMPLAINT =================
@complaint_bp.route("/<complaint_id>", methods=["GET"])
def get_single_complaint(complaint_id):
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid complaint ID"}), 400

    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404

    return jsonify(serialize(complaint)), 200


# ================= DEBUG — check last complaint's images =================
@complaint_bp.route("/debug/last", methods=["GET"])
def debug_last_complaint():
    """Dev-only: returns last complaint's image count and first 80 chars of first image."""
    c = extensions.db.complaints.find_one({}, sort=[("created_at", -1)])
    if not c:
        return jsonify({"error": "No complaints in DB"}), 404
    imgs = c.get("images", [])
    return jsonify({
        "id":           str(c["_id"]),
        "description":  c.get("description", ""),
        "images_count": len(imgs),
        "first_image_prefix": imgs[0][:80] if imgs else None,
        "keys": list(c.keys()),
    }), 200


# ================= CONTACT FORM =================
from flask import Blueprint as _B  # already imported, just for reference
@complaint_bp.route("/contact", methods=["POST"])
def submit_contact():
    """Public contact form submission — stores in DB, no auth required."""
    data = request.json or {}
    name    = (data.get("name") or "").strip()
    email   = (data.get("email") or "").strip()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not subject or not message:
        return jsonify({"error": "All fields are required"}), 400
    if "@" not in email:
        return jsonify({"error": "Invalid email address"}), 400

    extensions.db.contact_messages.insert_one({
        "name": name,
        "email": email,
        "subject": subject,
        "message": message,
        "created_at": datetime.utcnow(),
        "status": "new"
    })
    return jsonify({"message": "Message received. We'll respond within 2 business days."}), 201