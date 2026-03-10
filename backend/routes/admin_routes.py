from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from datetime import datetime, timedelta
from bson import ObjectId
import extensions
from utils.jwt_utils import hash_password

admin_bp = Blueprint("admin", __name__)

# ── Guards ─────────────────────────────────────────────────────
def require_admin():
    uid = get_jwt_identity()
    try:
        u = extensions.db.users.find_one({"_id": ObjectId(uid)}, {"role": 1, "name": 1})
    except Exception:
        return None, (jsonify({"error": "Invalid token"}), 401)
    if not u or u.get("role") not in ("admin", "authority"):
        return None, (jsonify({"error": "Admin access required"}), 403)
    return u, None

def require_admin_only():
    uid = get_jwt_identity()
    try:
        u = extensions.db.users.find_one({"_id": ObjectId(uid)}, {"role": 1})
    except Exception:
        return None, (jsonify({"error": "Invalid token"}), 401)
    if not u or u.get("role") != "admin":
        return None, (jsonify({"error": "Admin access required"}), 403)
    return u, None

def _fmt(doc, *fields):
    for f in fields:
        if isinstance(doc.get(f), datetime):
            doc[f] = doc[f].isoformat() + "Z"
    return doc

def ser_user(u):
    u = dict(u); u["_id"] = str(u["_id"])
    _fmt(u, "created_at", "last_login"); u.pop("password", None)
    return u

def ser_complaint(c):
    c = dict(c); c["_id"] = str(c["_id"])
    _fmt(c, "created_at", "updated_at", "assigned_at")
    for item in c.get("status_history", []): _fmt(item, "updated_at")
    return c

# ── SMS stub ───────────────────────────────────────────────────
def send_sms(phone, message):
    """
    Replace with real SMS API:

    Twilio:
        from twilio.rest import Client
        Client(SID, TOKEN).messages.create(body=message, from_=FROM, to=phone)

    Fast2SMS (India):
        import requests
        requests.post("https://www.fast2sms.com/dev/bulkV2",
            headers={"authorization": API_KEY},
            data={"message": message, "language": "english",
                  "route": "q", "numbers": phone.lstrip("+91")})
    """
    print(f"[SMS -> {phone}]: {message}")
    extensions.db.sms_log.insert_one({
        "phone": phone, "message": message, "sent_at": datetime.utcnow()
    })

# ═══════════════════════════════════════════════════════════════
#  ADMIN LOGIN
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/login", methods=["POST"])
def admin_login():
    from utils.jwt_utils import verify_password
    data     = request.json or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    user = extensions.db.users.find_one({"email": email})
    if not user:
        return jsonify({"error": "No account found for this email"}), 404
    if user.get("role") not in ("admin", "authority"):
        return jsonify({"error": "This account does not have admin/authority access"}), 403
    if not verify_password(password, user["password"]):
        return jsonify({"error": "Incorrect password"}), 401
    if user.get("is_active") is False:
        return jsonify({"error": "This account has been disabled"}), 403
    extensions.db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.utcnow()}})
    token = create_access_token(identity=str(user["_id"]))
    return jsonify({
        "message": "Login successful", "token": token,
        "user": {
            "_id":   str(user["_id"]), "name":  user["name"],
            "email": user.get("email", ""), "phone": user.get("phone", ""),
            "role":  user.get("role", "admin"), "area": user.get("area", ""),
        }
    }), 200

# ═══════════════════════════════════════════════════════════════
#  ADMIN PROFILE UPDATE
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/profile", methods=["PATCH"])
@jwt_required()
def admin_update_profile():
    admin, err = require_admin()
    if err: return err
    uid  = get_jwt_identity()
    data = request.json or {}
    update = {}
    if data.get("name"):  update["name"]  = data["name"].strip()
    if data.get("phone"): update["phone"] = data["phone"].strip()
    if data.get("area"):  update["area"]  = data["area"].strip()
    if data.get("email"): update["email"] = data["email"].strip().lower()
    if data.get("new_password"):
        from utils.jwt_utils import hash_password, verify_password
        user = extensions.db.users.find_one({"_id": ObjectId(uid)})
        if not verify_password(data.get("current_password", ""), user["password"]):
            return jsonify({"error": "Current password is incorrect"}), 400
        update["password"] = hash_password(data["new_password"])
    if not update:
        return jsonify({"error": "Nothing to update"}), 400
    extensions.db.users.update_one({"_id": ObjectId(uid)}, {"$set": update})
    updated = extensions.db.users.find_one({"_id": ObjectId(uid)}, {"password": 0})
    return jsonify({"message": "Profile updated", "user": ser_user(updated)}), 200

# ═══════════════════════════════════════════════════════════════
#  STATS
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/stats", methods=["GET"])
@jwt_required()
def admin_stats():
    admin, err = require_admin()
    if err: return err
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    cats = list(extensions.db.complaints.aggregate([
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]))
    # Area stats
    areas = list(extensions.db.complaints.aggregate([
        {"$group": {"_id": "$area", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 10}
    ]))
    return jsonify({
        "total_users":       extensions.db.users.count_documents({}),
        "total_complaints":  extensions.db.complaints.count_documents({}),
        "submitted":         extensions.db.complaints.count_documents({"status": "submitted"}),
        "in_progress":       extensions.db.complaints.count_documents({"status": "in_progress"}),
        "resolved":          extensions.db.complaints.count_documents({"status": "resolved"}),
        "unassigned":        extensions.db.complaints.count_documents({"assigned_to": {"$exists": False}, "status": "submitted"}),
        "total_votes":       extensions.db.votes.count_documents({}),
        "total_comments":    extensions.db.comments.count_documents({}),
        "new_contacts":      extensions.db.contact_messages.count_documents({"status": "new"}),
        "recent_complaints": extensions.db.complaints.count_documents({"created_at": {"$gte": seven_days_ago}}),
        "recent_users":      extensions.db.users.count_documents({"created_at": {"$gte": seven_days_ago}}),
        "categories":        [{"category": r["_id"], "count": r["count"]} for r in cats],
        "area_stats":        [{"area": r["_id"] or "Unknown", "count": r["count"]} for r in areas],
        "total_zones":       extensions.db.authority_zones.count_documents({}),
    }), 200

# ═══════════════════════════════════════════════════════════════
#  AUTHORITY ZONES  — full CRUD
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/zones/by-area", methods=["GET"])
@jwt_required()
def zones_by_area():
    """Return zones whose areas list matches the given area query (case-insensitive partial match)."""
    admin, err = require_admin()
    if err: return err
    area = (request.args.get("area") or "").strip().lower()
    all_zones = list(extensions.db.authority_zones.find({}).sort("name", 1))
    if area:
        matched = []
        for z in all_zones:
            zone_areas = [a.lower() for a in z.get("areas", [])]
            zone_name  = z.get("name", "").lower()
            if any(area in za or za in area for za in zone_areas) or area in zone_name or zone_name in area:
                matched.append(z)
        # Fallback: if nothing matched, return all
        result = matched if matched else all_zones
    else:
        result = all_zones
    for z in result:
        z["_id"] = str(z["_id"])
        _fmt(z, "created_at", "updated_at")
        if z.get("supervisor_id"):
            try:
                sv = extensions.db.users.find_one(
                    {"_id": ObjectId(z["supervisor_id"])}, {"name": 1, "phone": 1}
                )
                if sv:
                    z["supervisor_name"]  = sv["name"]
                    z["supervisor_phone"] = sv.get("phone", "")
            except Exception:
                pass
        active = extensions.db.complaints.count_documents(
            {"assigned_to": z.get("supervisor_id", ""), "status": {"$ne": "resolved"}}
        )
        z["active_complaints"] = active
    return jsonify(result), 200


@admin_bp.route("/zones", methods=["GET"])
@jwt_required()
def list_zones():
    admin, err = require_admin()
    if err: return err
    zones = list(extensions.db.authority_zones.find({}).sort("name", 1))
    result = []
    for z in zones:
        z["_id"] = str(z["_id"])
        _fmt(z, "created_at", "updated_at")
        # Enrich supervisor info — prefer user account, fall back to stored name/phone
        if z.get("supervisor_id"):
            try:
                sv = extensions.db.users.find_one(
                    {"_id": ObjectId(z["supervisor_id"])}, {"name": 1, "phone": 1, "email": 1}
                )
                if sv:
                    z["supervisor_name"]  = sv["name"]
                    z["supervisor_phone"] = sv.get("phone", "")
                    z["supervisor_email"] = sv.get("email", "")
            except Exception:
                pass
        # Always keep stored supervisor_name/phone as fallback
        if not z.get("supervisor_name"):
            z["supervisor_name"]  = z.get("supervisor_name", "")
        if not z.get("supervisor_phone"):
            z["supervisor_phone"] = z.get("supervisor_phone", "")
        # Assigned complaints
        z["active_complaints"] = extensions.db.complaints.count_documents(
            {"assigned_to": z.get("supervisor_id", ""), "status": {"$ne": "resolved"}}
        )
        result.append(z)
    return jsonify(result), 200


@admin_bp.route("/zones", methods=["POST"])
@jwt_required()
def create_zone():
    admin, err = require_admin()
    if err: return err
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Zone name is required"}), 400
    if extensions.db.authority_zones.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}}):
        return jsonify({"error": "Zone with this name already exists"}), 409
    now = datetime.utcnow()
    zone = {
        "name":             name,
        "areas":            [a.strip() for a in data.get("areas", []) if a.strip()],
        "supervisor_id":    data.get("supervisor_id", ""),
        "supervisor_name":  data.get("supervisor_name", "").strip(),
        "supervisor_phone": data.get("supervisor_phone", "").strip(),
        "staff_count":      int(data.get("staff_count", 0)),
        "description":      data.get("description", "").strip(),
        "created_at":       now,
        "updated_at":       now,
    }
    result = extensions.db.authority_zones.insert_one(zone)
    # Update supervisor's area field
    if data.get("supervisor_id"):
        try:
            extensions.db.users.update_one(
                {"_id": ObjectId(data["supervisor_id"])},
                {"$set": {"role": "authority", "area": name}}
            )
        except Exception: pass
    zone["_id"] = str(result.inserted_id)
    _fmt(zone, "created_at", "updated_at")
    return jsonify({"message": "Zone created", "zone": zone}), 201


@admin_bp.route("/zones/<zone_id>", methods=["PATCH"])
@jwt_required()
def update_zone(zone_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(zone_id)
    except Exception:
        return jsonify({"error": "Invalid zone ID"}), 400
    data   = request.json or {}
    update = {"updated_at": datetime.utcnow()}
    if "name"             in data: update["name"]             = data["name"].strip()
    if "areas"            in data: update["areas"]            = [a.strip() for a in data["areas"] if a.strip()]
    if "supervisor_id"    in data: update["supervisor_id"]    = data["supervisor_id"]
    if "supervisor_name"  in data: update["supervisor_name"]  = data["supervisor_name"].strip()
    if "supervisor_phone" in data: update["supervisor_phone"] = data["supervisor_phone"].strip()
    if "staff_count"      in data: update["staff_count"]      = int(data["staff_count"])
    if "description"      in data: update["description"]      = data["description"].strip()
    res = extensions.db.authority_zones.update_one({"_id": oid}, {"$set": update})
    if res.matched_count == 0:
        return jsonify({"error": "Zone not found"}), 404
    # Update supervisor's area
    if data.get("supervisor_id") and data.get("name"):
        try:
            extensions.db.users.update_one(
                {"_id": ObjectId(data["supervisor_id"])},
                {"$set": {"role": "authority", "area": data["name"]}}
            )
        except Exception: pass
    return jsonify({"message": "Zone updated"}), 200


@admin_bp.route("/zones/<zone_id>", methods=["DELETE"])
@jwt_required()
def delete_zone(zone_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(zone_id)
    except Exception:
        return jsonify({"error": "Invalid zone ID"}), 400
    zone = extensions.db.authority_zones.find_one({"_id": oid})
    if not zone:
        return jsonify({"error": "Zone not found"}), 404
    # Demote supervisor back to citizen if they only had this zone
    if zone.get("supervisor_id"):
        other = extensions.db.authority_zones.find_one({
            "supervisor_id": zone["supervisor_id"],
            "_id": {"$ne": oid}
        })
        if not other:
            try:
                extensions.db.users.update_one(
                    {"_id": ObjectId(zone["supervisor_id"])},
                    {"$set": {"role": "citizen"}, "$unset": {"area": ""}}
                )
            except Exception: pass
    extensions.db.authority_zones.delete_one({"_id": oid})
    return jsonify({"message": "Zone deleted"}), 200


@admin_bp.route("/zones/<zone_id>", methods=["GET"])
@jwt_required()
def get_zone(zone_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(zone_id)
    except Exception:
        return jsonify({"error": "Invalid zone ID"}), 400
    z = extensions.db.authority_zones.find_one({"_id": oid})
    if not z:
        return jsonify({"error": "Zone not found"}), 404
    z["_id"] = str(z["_id"])
    _fmt(z, "created_at", "updated_at")
    # Supervisor details
    if z.get("supervisor_id"):
        try:
            sv = extensions.db.users.find_one({"_id": ObjectId(z["supervisor_id"])}, {"password": 0})
            if sv: z["supervisor"] = ser_user(sv)
        except Exception: pass
    # Assigned complaints with full details
    assigned = list(extensions.db.complaints.find(
        {"assigned_to": z.get("supervisor_id", "")}
    ).sort("created_at", -1).limit(50))
    for c in assigned:
        c["_id"] = str(c["_id"])
        _fmt(c, "created_at", "updated_at")
        try:
            reporter = extensions.db.users.find_one(
                {"_id": ObjectId(c["user_id"])}, {"name": 1, "phone": 1}
            )
            c["reporter_name"]  = reporter["name"]  if reporter else "Unknown"
            c["reporter_phone"] = reporter.get("phone", "") if reporter else ""
        except Exception:
            c["reporter_name"] = "Unknown"
        c["vote_count"] = extensions.db.votes.count_documents({"complaint_id": c["_id"]})
    z["complaints"] = assigned
    z["active_complaints"]   = sum(1 for c in assigned if c.get("status") != "resolved")
    z["resolved_complaints"] = sum(1 for c in assigned if c.get("status") == "resolved")
    return jsonify(z), 200


# List all users with authority/admin role for supervisor dropdown
@admin_bp.route("/authority-users", methods=["GET"])
@jwt_required()
def list_authority_users():
    admin, err = require_admin()
    if err: return err
    users = list(extensions.db.users.find(
        {"role": {"$in": ["authority", "admin"]}},
        {"password": 0}
    ).sort("name", 1))
    return jsonify([ser_user(u) for u in users]), 200


# ═══════════════════════════════════════════════════════════════
#  COMPLAINTS
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/complaints", methods=["GET"])
@jwt_required()
def admin_list_complaints():
    admin, err = require_admin()
    if err: return err
    status   = request.args.get("status", "")
    category = request.args.get("category", "")
    search   = request.args.get("search", "").strip()
    area     = request.args.get("area", "").strip()
    assigned = request.args.get("assigned", "")
    sort_by  = request.args.get("sort", "priority")
    page     = max(int(request.args.get("page", 1)), 1)
    per_page = min(int(request.args.get("per_page", 20)), 100)

    query = {}
    if status:   query["status"]   = status
    if category: query["category"] = category
    if area:
        area_filter = {"$or": [
            {"address": {"$regex": area, "$options": "i"}},
            {"region":  {"$regex": area, "$options": "i"}},
        ]}
        if "$and" in query:
            query["$and"].append(area_filter)
        elif "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, area_filter]
        else:
            query["$and"] = [area_filter]
    if assigned == "yes": query["assigned_to"] = {"$exists": True}
    if assigned == "no":
        query["$and"] = [
            {"$or": [{"assigned_to": {"$exists": False}}, {"assigned_to": ""}]},
        ]
    if search:
        or_clause = [
            {"description": {"$regex": search, "$options": "i"}},
            {"address":     {"$regex": search, "$options": "i"}},
        ]
        if "$and" in query:
            query["$and"].append({"$or": or_clause})
        else:
            query["$or"] = or_clause

    if sort_by == "priority":
        pipeline = [
            {"$match": query},
            {"$addFields": {
                "_po": {"$switch": {
                    "branches": [
                        {"case": {"$eq": ["$priority", "high"]},   "then": 0},
                        {"case": {"$eq": ["$priority", "normal"]}, "then": 1},
                        {"case": {"$eq": ["$priority", "low"]},    "then": 2},
                    ],
                    "default": 1
                }}
            }},
            {"$sort": {"_po": 1, "votes": -1, "created_at": -1}},
            {"$skip": (page - 1) * per_page}, {"$limit": per_page},
        ]
        complaints = list(extensions.db.complaints.aggregate(pipeline))
    elif sort_by == "votes":
        complaints = list(extensions.db.complaints.find(query)
            .sort([("votes", -1), ("created_at", -1)])
            .skip((page - 1) * per_page).limit(per_page))
    else:
        complaints = list(extensions.db.complaints.find(query)
            .sort("created_at", -1)
            .skip((page - 1) * per_page).limit(per_page))

    total = extensions.db.complaints.count_documents(query)

    for c in complaints:
        c["_id"] = str(c["_id"])
        _fmt(c, "created_at", "updated_at")
        for item in c.get("status_history", []): _fmt(item, "updated_at")
        try:
            u = extensions.db.users.find_one({"_id": ObjectId(c["user_id"])}, {"name": 1, "phone": 1})
            c["reporter_name"]  = u["name"]  if u else "Unknown"
            c["reporter_phone"] = u.get("phone", "") if u else ""
        except Exception:
            c["reporter_name"] = "Unknown"; c["reporter_phone"] = ""
        if c.get("assigned_to"):
            try:
                a = extensions.db.users.find_one({"_id": ObjectId(c["assigned_to"])}, {"name": 1, "area": 1})
                c["assigned_name"] = a["name"]        if a else "Unknown"
                c["assigned_area"] = a.get("area", "") if a else ""
            except Exception:
                c["assigned_name"] = "Unknown"; c["assigned_area"] = ""

    return jsonify({"complaints": complaints, "total": total,
                    "page": page, "per_page": per_page,
                    "pages": (total + per_page - 1) // per_page}), 200


@admin_bp.route("/complaints/<complaint_id>", methods=["GET"])
@jwt_required()
def admin_get_complaint(complaint_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    c = extensions.db.complaints.find_one({"_id": oid})
    if not c: return jsonify({"error": "Not found"}), 404
    c = ser_complaint(c)
    c["vote_count"] = extensions.db.votes.count_documents({"complaint_id": complaint_id})
    try:
        u = extensions.db.users.find_one({"_id": ObjectId(c["user_id"])}, {"password": 0})
        if u: c["reporter"] = ser_user(u)
    except Exception: pass
    comments = list(extensions.db.comments.find({"complaint_id": complaint_id}).sort("created_at", 1))
    for cm in comments:
        cm["_id"] = str(cm["_id"]); _fmt(cm, "created_at")
    c["comments"] = comments
    if c.get("assigned_to"):
        try:
            a = extensions.db.users.find_one({"_id": ObjectId(c["assigned_to"])}, {"password": 0})
            if a: c["assigned_authority"] = ser_user(a)
        except Exception: pass
    return jsonify(c), 200


@admin_bp.route("/complaints/<complaint_id>/status", methods=["PATCH"])
@jwt_required()
def admin_update_status(complaint_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    data       = request.json or {}
    new_status = data.get("status")
    message    = data.get("message", "Status updated by admin")
    if new_status not in ("submitted", "in_progress", "resolved"):
        return jsonify({"error": "Invalid status"}), 400
    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint: return jsonify({"error": "Not found"}), 404
    now = datetime.utcnow()
    extensions.db.complaints.update_one({"_id": oid}, {
        "$set":  {"status": new_status, "updated_at": now},
        "$push": {"status_history": {"status": new_status, "message": message, "updated_at": now}},
    })
    extensions.db.notifications.insert_one({
        "user_id": complaint["user_id"], "type": "STATUS_UPDATE",
        "message": f"Your complaint status changed to: {new_status.replace('_',' ').title()}. {message}",
        "complaint_id": complaint_id, "read": False, "created_at": now,
    })
    try:
        reporter = extensions.db.users.find_one({"_id": ObjectId(complaint["user_id"])}, {"phone": 1, "name": 1})
        if reporter and reporter.get("phone"):
            send_sms(reporter["phone"],
                f"CleanCity: Hi {reporter.get('name','')}, your complaint status is now "
                f"'{new_status.replace('_',' ').title()}'. {message}")
    except Exception as e:
        print(f"SMS error: {e}")
    return jsonify({"message": "Status updated", "new_status": new_status}), 200


@admin_bp.route("/complaints/<complaint_id>/assign", methods=["PATCH"])
@jwt_required()
def admin_assign_complaint(complaint_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    data         = request.json or {}
    authority_id = data.get("authority_id", "")
    note         = data.get("note", "")
    if not authority_id:
        return jsonify({"error": "authority_id required"}), 400
    try:
        auth_user = extensions.db.users.find_one(
            {"_id": ObjectId(authority_id)}, {"role": 1, "name": 1, "phone": 1, "area": 1}
        )
    except Exception:
        return jsonify({"error": "Invalid authority ID"}), 400
    if not auth_user or auth_user.get("role") not in ("authority", "admin"):
        return jsonify({"error": "Selected user is not an authority"}), 400
    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint: return jsonify({"error": "Not found"}), 404
    now = datetime.utcnow()
    area_label  = auth_user.get("area", "")
    assign_msg  = f"Assigned to {auth_user['name']}{' (' + area_label + ')' if area_label else ''}. {note}".strip(". ")
    extensions.db.complaints.update_one({"_id": oid}, {
        "$set":  {"assigned_to": authority_id, "assigned_at": now, "assigned_note": note, "status": "in_progress", "updated_at": now},
        "$push": {"status_history": {"status": "in_progress", "message": assign_msg, "updated_at": now}},
    })
    extensions.db.notifications.insert_one({
        "user_id": complaint["user_id"], "type": "STATUS_UPDATE",
        "message": f"Your complaint has been assigned to {auth_user['name']} and is now In Progress.",
        "complaint_id": complaint_id, "read": False, "created_at": now,
    })
    try:
        reporter = extensions.db.users.find_one({"_id": ObjectId(complaint["user_id"])}, {"phone": 1, "name": 1})
        if reporter and reporter.get("phone"):
            send_sms(reporter["phone"],
                f"CleanCity: Hi {reporter.get('name','')}, your complaint has been assigned "
                f"to {auth_user['name']} and is now In Progress.")
    except Exception as e:
        print(f"SMS error: {e}")
    extensions.db.notifications.insert_one({
        "user_id": authority_id, "type": "ASSIGNMENT",
        "message": f"New task assigned: {complaint.get('description','')[:80]} ({complaint.get('address','')[:60]})",
        "complaint_id": complaint_id, "read": False, "created_at": now,
    })
    if auth_user.get("phone"):
        send_sms(auth_user["phone"],
            f"CleanCity: A new complaint has been assigned to you at "
            f"{complaint.get('address','your area')}. Please review and take action.")
    return jsonify({"message": f"Assigned to {auth_user['name']}", "assigned_to": authority_id}), 200


@admin_bp.route("/complaints/<complaint_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_complaint(complaint_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(complaint_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    complaint = extensions.db.complaints.find_one({"_id": oid})
    if not complaint: return jsonify({"error": "Not found"}), 404
    extensions.db.votes.delete_many({"complaint_id": complaint_id})
    extensions.db.comments.delete_many({"complaint_id": complaint_id})
    extensions.db.notifications.delete_many({"complaint_id": complaint_id})
    extensions.db.complaints.delete_one({"_id": oid})
    try:
        extensions.db.users.update_one({"_id": ObjectId(complaint["user_id"])}, {"$inc": {"cleanlinessScore": -10}})
    except Exception: pass
    return jsonify({"message": "Deleted"}), 200


# ═══════════════════════════════════════════════════════════════
#  USERS
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def admin_list_users():
    admin, err = require_admin()
    if err: return err
    search   = request.args.get("search", "").strip()
    role     = request.args.get("role", "")
    page     = max(int(request.args.get("page", 1)), 1)
    per_page = min(int(request.args.get("per_page", 20)), 100)
    query = {}
    if role: query["role"] = role
    if search:
        query["$or"] = [
            {"name":  {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    total = extensions.db.users.count_documents(query)
    users = list(extensions.db.users.find(query, {"password": 0})
        .sort("created_at", -1).skip((page - 1) * per_page).limit(per_page))
    return jsonify({"users": [ser_user(u) for u in users],
                    "total": total, "page": page, "per_page": per_page,
                    "pages": (total + per_page - 1) // per_page}), 200


@admin_bp.route("/users/create-authority", methods=["POST"])
@jwt_required()
def admin_create_authority():
    admin, err = require_admin()
    if err: return err
    data     = request.json or {}
    name     = data.get("name", "").strip()
    phone    = data.get("phone", "").strip()
    email    = data.get("email", "").strip()
    area     = data.get("area", "").strip()
    password = data.get("password", "").strip()

    if not name or not phone or not password:
        return jsonify({"error": "Name, phone, and password are required"}), 400
    if len(phone) < 10:
        return jsonify({"error": "Enter a valid phone number"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if extensions.db.users.find_one({"phone": phone}):
        return jsonify({"error": "A user with this phone number already exists"}), 409

    new_user = {
        "name":       name,
        "phone":      phone,
        "email":      email,
        "area":       area,
        "role":       "authority",
        "password":   hash_password(password),
        "is_active":  True,
        "cleanlinessScore": 0,
        "created_at": datetime.utcnow(),
    }
    result = extensions.db.users.insert_one(new_user)
    return jsonify({"message": "Authority account created", "id": str(result.inserted_id)}), 201


@admin_bp.route("/users/<user_id>/toggle-active", methods=["PATCH"])
@jwt_required()
def admin_toggle_active(user_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    user = extensions.db.users.find_one({"_id": oid}, {"is_active": 1})
    if not user: return jsonify({"error": "Not found"}), 404
    new_state = not user.get("is_active", True)
    extensions.db.users.update_one({"_id": oid}, {"$set": {"is_active": new_state}})
    return jsonify({"is_active": new_state}), 200


@admin_bp.route("/users/<user_id>", methods=["DELETE"])
@jwt_required()
def admin_delete_user(user_id):
    admin, err = require_admin()
    if err: return err
    if user_id == get_jwt_identity():
        return jsonify({"error": "Cannot delete yourself"}), 400
    try:
        oid = ObjectId(user_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    user = extensions.db.users.find_one({"_id": oid})
    if not user: return jsonify({"error": "Not found"}), 404
    for c in extensions.db.complaints.find({"user_id": user_id}, {"_id": 1}):
        cid = str(c["_id"])
        extensions.db.votes.delete_many({"complaint_id": cid})
        extensions.db.comments.delete_many({"complaint_id": cid})
        extensions.db.notifications.delete_many({"complaint_id": cid})
    extensions.db.complaints.delete_many({"user_id": user_id})
    extensions.db.votes.delete_many({"user_id": user_id})
    extensions.db.comments.delete_many({"user_id": user_id})
    extensions.db.notifications.delete_many({"user_id": user_id})
    extensions.db.users.delete_one({"_id": oid})
    return jsonify({"message": "User deleted"}), 200


# ═══════════════════════════════════════════════════════════════
#  CONTACTS
# ═══════════════════════════════════════════════════════════════
@admin_bp.route("/contacts", methods=["GET"])
@jwt_required()
def admin_list_contacts():
    admin, err = require_admin()
    if err: return err
    status   = request.args.get("status", "")
    page     = max(int(request.args.get("page", 1)), 1)
    per_page = min(int(request.args.get("per_page", 20)), 100)
    query = {}
    if status: query["status"] = status
    total = extensions.db.contact_messages.count_documents(query)
    msgs  = list(extensions.db.contact_messages.find(query)
        .sort("created_at", -1).skip((page - 1) * per_page).limit(per_page))
    result = []
    for m in msgs:
        m["_id"] = str(m["_id"]); _fmt(m, "created_at"); result.append(m)
    return jsonify({"messages": result, "total": total, "page": page,
                    "pages": (total + per_page - 1) // per_page}), 200


@admin_bp.route("/contacts/<msg_id>/status", methods=["PATCH"])
@jwt_required()
def admin_update_contact(msg_id):
    admin, err = require_admin()
    if err: return err
    try:
        oid = ObjectId(msg_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400
    status = (request.json or {}).get("status")
    if status not in ("new", "read", "resolved"):
        return jsonify({"error": "Invalid status"}), 400
    res = extensions.db.contact_messages.update_one({"_id": oid}, {"$set": {"status": status}})
    if res.matched_count == 0:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"message": "Updated"}), 200