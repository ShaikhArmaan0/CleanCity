import os
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import extensions
from utils.otp_utils import generate_otp
from utils.jwt_utils import hash_password, verify_password
from bson import ObjectId

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    data = request.json or {}
    phone = data.get("phone", "").strip()
    if not phone:
        return jsonify({"error": "Phone number required"}), 400

    otp = generate_otp(phone)

    response = {"message": "OTP sent successfully"}
    # Only return otp in dev mode
    if current_app.config.get("DEV_MODE", True):
        response["dev_otp"] = otp

    return jsonify(response), 200


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json or {}
    phone = data.get("phone", "").strip()
    otp   = data.get("otp", "").strip()

    if not phone or not otp:
        return jsonify({"error": "Phone and OTP required"}), 400

    record = extensions.db.otp_verifications.find_one({"phone": phone, "otp": otp, "verified": False})
    if not record:
        return jsonify({"error": "Invalid or expired OTP"}), 400

    if record.get("expires_at") and datetime.utcnow() > record["expires_at"]:
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    extensions.db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"verified": True}})

    existing_user = extensions.db.users.find_one({"phone": phone})
    temp_token = create_access_token(identity=phone)

    if existing_user:
        real_token = create_access_token(identity=str(existing_user["_id"]))
        return jsonify({
            "message": "OTP verified",
            "existing_user": True,
            "temp_token": temp_token,
            "token": real_token,
            "user": {
                "_id":   str(existing_user["_id"]),
                "name":  existing_user["name"],
                "phone": existing_user["phone"],
                "role":  existing_user.get("role", "citizen"),
            }
        }), 200

    return jsonify({
        "message": "OTP verified",
        "existing_user": False,
        "temp_token": temp_token,
    }), 200


@auth_bp.route("/complete-profile", methods=["POST"])
@jwt_required()
def complete_profile():
    phone = get_jwt_identity()
    data  = request.json or {}

    # Guard: identity must be a phone string (temp token), not a long ObjectId
    if len(phone) > 20:
        return jsonify({"error": "Invalid token. Please re-verify your phone."}), 401

    if extensions.db.users.find_one({"phone": phone}):
        return jsonify({"error": "Account already exists for this phone"}), 400

    name     = data.get("name", "").strip()
    password = data.get("password", "")
    if not name or not password:
        return jsonify({"error": "Name and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user = {
        "name":            name,
        "phone":           phone,
        "email":           data.get("email", ""),
        "password":        hash_password(password),
        "address":         data.get("address", ""),
        "role":            "citizen",
        "cleanlinessScore": 0,
        "total_complaints": 0,
        "total_votes":      0,
        "is_active":        True,
        "created_at":       datetime.utcnow(),
    }

    result = extensions.db.users.insert_one(user)
    token  = create_access_token(identity=str(result.inserted_id))

    return jsonify({
        "message": "Account created successfully",
        "token": token,
        "user": {
            "_id":   str(result.inserted_id),
            "name":  name,
            "phone": phone,
            "role":  "citizen",
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.json or {}
    phone    = data.get("phone", "").strip()
    password = data.get("password", "")

    if not phone or not password:
        return jsonify({"error": "Phone and password required"}), 400

    user = extensions.db.users.find_one({"phone": phone})
    if not user:
        return jsonify({"error": "No account found for this phone number"}), 404

    if not verify_password(password, user["password"]):
        return jsonify({"error": "Incorrect password"}), 401

    if user.get("role") in ("authority", "admin"):
        return jsonify({"error": "Authority and admin accounts must use the Admin Panel to log in."}), 403

    extensions.db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.utcnow()}})
    token = create_access_token(identity=str(user["_id"]))

    return jsonify({
        "message": "Login successful",
        "token":   token,
        "user": {
            "_id":   str(user["_id"]),
            "name":  user["name"],
            "phone": user["phone"],
            "role":  user.get("role", "citizen"),
        }
    }), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    try:
        oid = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid token"}), 401

    user = extensions.db.users.find_one({"_id": oid}, {"password": 0})
    if not user:
        return jsonify({"error": "User not found"}), 404

    user["_id"] = str(user["_id"])
    if isinstance(user.get("created_at"), datetime):
        user["created_at"] = user["created_at"].isoformat() + 'Z'
    if isinstance(user.get("last_login"), datetime):
        user["last_login"] = user["last_login"].isoformat() + 'Z'

    return jsonify(user), 200


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """Step 1: verify phone exists, send OTP for password reset."""
    data  = request.json or {}
    phone = data.get("phone", "").strip()
    if not phone:
        return jsonify({"error": "Phone number required"}), 400

    user = extensions.db.users.find_one({"phone": phone})
    if not user:
        return jsonify({"error": "No account found with this phone number"}), 404

    from utils.otp_utils import generate_otp
    otp = generate_otp(phone)
    return jsonify({"message": "OTP sent for password reset", "dev_otp": otp}), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Step 2: verify OTP + set new password."""
    data     = request.json or {}
    phone    = data.get("phone", "").strip()
    otp      = data.get("otp", "").strip()
    new_pass = data.get("new_password", "")

    if not phone or not otp or not new_pass:
        return jsonify({"error": "Phone, OTP and new password are required"}), 400
    if len(new_pass) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    record = extensions.db.otp_verifications.find_one(
        {"phone": phone, "otp": otp, "verified": False}
    )
    if not record:
        return jsonify({"error": "Invalid or expired OTP"}), 400

    if record.get("expires_at") and datetime.utcnow() > record["expires_at"]:
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400

    extensions.db.otp_verifications.update_one({"_id": record["_id"]}, {"$set": {"verified": True}})
    extensions.db.users.update_one(
        {"phone": phone},
        {"$set": {"password": hash_password(new_pass)}}
    )
    return jsonify({"message": "Password reset successfully. You can now log in."}), 200