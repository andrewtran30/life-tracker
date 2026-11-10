from datetime import date

from flask import Blueprint, jsonify, g

from middleware.auth import require_auth
from services.supabase_client import supabase_admin
from services.summary import generate_daily_summary

summary_bp = Blueprint("summary", __name__, url_prefix="/api/summary")


@summary_bp.route("/today", methods=["GET"])
@require_auth
def today():
    today_str = date.today().isoformat()

    try:
        existing = (
            supabase_admin.table("daily_summaries")
            .select("*")
            .eq("user_id", g.user_id)
            .eq("date", today_str)
            .maybe_single()
            .execute()
        )

        if existing.data:
            return jsonify(existing.data)

        summary = generate_daily_summary(g.user_id, today_str)
        return jsonify(summary)
    except Exception as e:
        print(f"Summary error: {e}")
        return jsonify({"error": "Failed to generate summary"}), 500


@summary_bp.route("/regenerate", methods=["POST"])
@require_auth
def regenerate():
    today_str = date.today().isoformat()

    try:
        supabase_admin.table("daily_summaries").delete().eq(
            "user_id", g.user_id
        ).eq("date", today_str).execute()

        summary = generate_daily_summary(g.user_id, today_str)
        return jsonify(summary)
    except Exception as e:
        print(f"Regenerate error: {e}")
        return jsonify({"error": "Failed to regenerate summary"}), 500
