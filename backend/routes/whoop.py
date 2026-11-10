from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, g

from middleware.auth import require_auth
from services.supabase_client import supabase_admin
from services import whoop

whoop_bp = Blueprint("whoop", __name__, url_prefix="/api/whoop")


@whoop_bp.route("/auth-url", methods=["GET"])
@require_auth
def auth_url():
    url, state = whoop.get_auth_url()
    return jsonify({"url": url, "state": state})


@whoop_bp.route("/callback", methods=["POST"])
@require_auth
def callback():
    code = request.json.get("code") if request.json else None
    if not code:
        return jsonify({"error": "Missing authorization code"}), 400

    try:
        tokens = whoop.exchange_code(code)
        profile = whoop.fetch_profile(tokens["access_token"])

        supabase_admin.table("whoop_connections").upsert(
            {
                "user_id": g.user_id,
                "access_token_encrypted": tokens["access_token"],
                "refresh_token_encrypted": tokens["refresh_token"],
                "token_expires_at": (
                    datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
                ).isoformat(),
                "whoop_user_id": str(profile["user_id"]),
            },
            on_conflict="user_id",
        ).execute()

        return jsonify({"success": True, "whoop_user_id": profile["user_id"]})
    except Exception as e:
        print(f"WHOOP callback error: {e}")
        return jsonify({"error": "Failed to connect WHOOP account"}), 500


@whoop_bp.route("/sync", methods=["POST"])
@require_auth
def sync():
    try:
        conn_resp = (
            supabase_admin.table("whoop_connections")
            .select("*")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        connection = conn_resp.data[0] if conn_resp.data else None
        if not connection:
            return jsonify({"error": "No WHOOP connection found"}), 404

        access_token = connection["access_token_encrypted"]

        if datetime.fromisoformat(connection["token_expires_at"].replace("Z", "+00:00")) <= datetime.utcnow().astimezone():
            new_tokens = whoop.refresh_token(connection["refresh_token_encrypted"])
            access_token = new_tokens["access_token"]
            supabase_admin.table("whoop_connections").update(
                {
                    "access_token_encrypted": new_tokens["access_token"],
                    "refresh_token_encrypted": new_tokens["refresh_token"],
                    "token_expires_at": (
                        datetime.utcnow() + timedelta(seconds=new_tokens["expires_in"])
                    ).isoformat(),
                }
            ).eq("id", connection["id"]).execute()

        start_date = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

        sleep_data = whoop.fetch_sleep(access_token, start_date)
        recovery_data = whoop.fetch_recovery(access_token, start_date)
        workout_data = whoop.fetch_workouts(access_token, start_date)

        cid = connection["id"]

        sleep_upserts = []
        for s in sleep_data.get("records", []):
            score = s.get("score", {})
            stage = score.get("stage_summary", {})
            sleep_upserts.append({
                "connection_id": cid,
                "whoop_sleep_id": s["id"],
                "start_time": s.get("start"),
                "end_time": s.get("end"),
                "score": score.get("sleep_performance_percentage"),
                "rem_duration_ms": stage.get("total_rem_sleep_time_milli"),
                "deep_duration_ms": stage.get("total_slow_wave_sleep_time_milli"),
                "light_duration_ms": stage.get("total_light_sleep_time_milli"),
                "awake_duration_ms": stage.get("total_awake_time_milli"),
                "respiratory_rate": score.get("respiratory_rate"),
            })

        recovery_upserts = []
        for r in recovery_data.get("records", []):
            score = r.get("score", {})
            created = r.get("created_at", "")
            recovery_upserts.append({
                "connection_id": cid,
                "whoop_cycle_id": r.get("cycle_id"),
                "date": created.split("T")[0] if created else None,
                "recovery_score": score.get("recovery_score"),
                "hrv_rmssd": score.get("hrv_rmssd_milli"),
                "resting_hr": score.get("resting_heart_rate"),
                "spo2": score.get("spo2_percentage"),
                "skin_temp_celsius": score.get("skin_temp_celsius"),
            })

        workout_upserts = []
        for w in workout_data.get("records", []):
            score = w.get("score", {})
            kilojoule = score.get("kilojoule")
            workout_upserts.append({
                "connection_id": cid,
                "whoop_workout_id": w["id"],
                "sport_name": str(w.get("sport_id")) if w.get("sport_id") is not None else None,
                "start_time": w.get("start"),
                "end_time": w.get("end"),
                "strain": score.get("strain"),
                "avg_hr": score.get("average_heart_rate"),
                "max_hr": score.get("max_heart_rate"),
                "calories": float(kilojoule) / 4.184 if kilojoule else None,
                "distance_m": score.get("distance_meter"),
            })

        if sleep_upserts:
            supabase_admin.table("sleep_records").upsert(sleep_upserts, on_conflict="whoop_sleep_id").execute()
        if recovery_upserts:
            supabase_admin.table("recovery_records").upsert(recovery_upserts, on_conflict="whoop_cycle_id").execute()
        if workout_upserts:
            supabase_admin.table("workouts").upsert(workout_upserts, on_conflict="whoop_workout_id").execute()

        supabase_admin.table("whoop_connections").update(
            {"last_synced_at": datetime.utcnow().isoformat()}
        ).eq("id", cid).execute()

        return jsonify({
            "synced": {
                "sleep": len(sleep_upserts),
                "recovery": len(recovery_upserts),
                "workouts": len(workout_upserts),
            }
        })
    except Exception as e:
        print(f"WHOOP sync error: {e}")
        return jsonify({"error": "Sync failed"}), 500


@whoop_bp.route("/status", methods=["GET"])
@require_auth
def status():
    try:
        resp = (
            supabase_admin.table("whoop_connections")
            .select("whoop_user_id, last_synced_at")
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        )
        data = resp.data[0] if resp.data else None
        if data:
            return jsonify({"connected": True, **data})
        return jsonify({"connected": False})
    except Exception as e:
        print(f"WHOOP status error: {e}")
        return jsonify({"connected": False})
