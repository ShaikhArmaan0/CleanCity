import random
import extensions
from datetime import datetime, timedelta


def generate_otp(phone: str) -> str:
    otp = str(random.randint(100000, 999999))
    extensions.db.otp_verifications.insert_one({
        "phone":      phone,
        "otp":        otp,
        "verified":   False,
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
        "created_at": datetime.utcnow(),
    })
    print(f"[MOCK OTP] {phone} -> {otp}")
    return otp
