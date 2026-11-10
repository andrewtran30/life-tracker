from functools import wraps
from flask import request, jsonify, g
from services.supabase_client import supabase_admin


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing authorization header"}), 401

        token = auth_header[7:]
        try:
            user = supabase_admin.auth.get_user(token)
            g.user_id = user.user.id
        except Exception:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return decorated
