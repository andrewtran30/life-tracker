from datetime import datetime, timedelta, timezone
import math

import requests

from flask import Blueprint, request, jsonify, g

from middleware.auth import require_auth
from services.supabase_client import supabase_admin
from services import whoop, whoop_archive
from services.shoes import shoe_activity_type, summarize_shoes

whoop_bp = Blueprint("whoop", __name__, url_prefix="/api/whoop")


def _parse_timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _expires_at(tokens):
    return (datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])).isoformat()


def _whoop_error(error, default, unauthorized, rate_limited, not_found=None):
    """Map a failed WHOOP request to a user-facing 502 response."""
    if not isinstance(error, requests.HTTPError):
        return jsonify({"error": "Unable to reach WHOOP. Please try again."}), 502
    status = error.response.status_code if error.response is not None else None
    print(f"WHOOP upstream HTTP status: {status}")
    message = {401: unauthorized, 403: unauthorized, 429: rate_limited, 404: not_found}.get(status) or default
    return jsonify({"error": message}), 502


@whoop_bp.route("/shoes", methods=["GET"])
@require_auth
def shoe_mileage():
    try:
        workouts = []
        offset = 0
        while True:
            response = (supabase_admin.table("workouts")
                        .select("id,sport_name,running_shoes,running_miles,distance_m,start_time,whoop_connections!inner(user_id)")
                        .eq("whoop_connections.user_id", g.user_id)
                        .order("id").range(offset, offset + 999).execute())
            workouts.extend(response.data)
            if len(response.data) < 1000:
                break
            offset += 1000
        return jsonify(summarize_shoes(workouts))
    except Exception as error:
        print(f"Shoe mileage error type: {type(error).__name__}")
        return jsonify({"error": "Unable to load shoe mileage. Please try again."}), 500


def _owned_workout(workout_id):
    response = (supabase_admin.table("workouts")
                .select("*, whoop_connections!inner(user_id)")
                .eq("id", str(workout_id))
                .eq("whoop_connections.user_id", g.user_id)
                .limit(1).execute())
    if not response.data:
        return None
    row = response.data[0]
    row.pop("whoop_connections", None)
    return row


def _validate_run_details(data):
    if not isinstance(data, dict) or not {"running_shoes", "running_miles"} <= set(data) or set(data) - {"running_shoes", "running_miles", "running_pace", "running_splits", "running_feeling"}:
        raise ValueError("Provide running shoes and mileage.")
    shoes, miles = data["running_shoes"], data["running_miles"]
    if shoes is not None and (not isinstance(shoes, str) or len(shoes) > 200):
        raise ValueError("Running shoes must be text of 200 characters or fewer.")
    if miles is not None and (isinstance(miles, bool) or not isinstance(miles, (int, float))
                              or not math.isfinite(miles) or not 0 <= miles <= 1000):
        raise ValueError("Mileage must be a number between 0 and 1,000, or left blank.")
    updates = {"running_shoes": shoes.strip() or None if shoes is not None else None,
               "running_miles": miles}
    for field, limit in (("running_pace", 40), ("running_splits", 4000), ("running_feeling", 4000)):
        if field in data:
            value = data[field]
            if value is not None and (not isinstance(value, str) or len(value) > limit):
                raise ValueError(f"{field.replace('_', ' ').capitalize()} must be text of {limit} characters or fewer.")
            updates[field] = value.strip() or None if value is not None else None
    return updates


@whoop_bp.route("/workouts/<uuid:workout_id>", methods=["GET"])
@require_auth
def workout_detail(workout_id):
    try:
        workout = _owned_workout(workout_id)
        if workout is None:
            return jsonify({"error": "Workout not found"}), 404
        saved = whoop_archive.saved_workout(workout["connection_id"], workout["whoop_workout_id"])
        if saved:
            return jsonify({"workout": workout, "activity": saved["payload"], "source": "archive", "archived_at": saved["archived_at"]})
        _, access_token = _get_connection_access_token()
        activity = whoop.fetch_workout(access_token, workout["whoop_workout_id"])
        whoop_archive.store_records(workout["connection_id"], "workout", [activity])
        return jsonify({"workout": workout, "activity": activity, "source": "whoop"})
    except requests.RequestException as error:
        return _whoop_error(error, "Unable to load activity details from WHOOP. Please try again.",
                            unauthorized="Please reconnect WHOOP to view activity details.",
                            rate_limited="WHOOP rate limit reached. Please wait before trying again.",
                            not_found="This activity is no longer available in WHOOP.")
    except Exception as error:
        print(f"WHOOP workout details error type: {type(error).__name__}")
        return jsonify({"error": "Unable to load workout details. Please try again."}), 500


@whoop_bp.route("/workouts/<uuid:workout_id>/run-details", methods=["PATCH"])
@require_auth
def save_run_details(workout_id):
    try:
        updates = _validate_run_details(request.get_json(silent=True))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    try:
        workout = _owned_workout(workout_id)
        if workout is None:
            return jsonify({"error": "Workout not found"}), 404
        if shoe_activity_type(workout.get("sport_name")) is None:
            return jsonify({"error": "Shoes and mileage can only be saved for running, walking, and hiking activities."}), 400
        response = (supabase_admin.table("workouts").update(updates)
                    .eq("id", workout["id"]).eq("connection_id", workout["connection_id"]).execute())
        if not response.data:
            return jsonify({"error": "Workout not found"}), 404
        return jsonify({"workout": response.data[0]})
    except Exception as error:
        print(f"WHOOP run details save error type: {type(error).__name__}")
        return jsonify({"error": "Unable to save run details. Please try again."}), 500


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
        if not tokens.get("refresh_token"):
            return jsonify({
                "error": "WHOOP did not provide a refresh token. Please connect again and grant offline access."
            }), 502
        profile = whoop.fetch_profile(tokens["access_token"])

        row = {
            "user_id": g.user_id,
            "access_token_encrypted": tokens["access_token"],
            "refresh_token_encrypted": tokens["refresh_token"],
            "token_expires_at": _expires_at(tokens),
            "whoop_user_id": str(profile["user_id"]),
        }
        supabase_admin.table("whoop_connections").upsert(
            row,
            on_conflict="user_id",
        ).execute()

        return jsonify({"success": True, "whoop_user_id": profile["user_id"]})
    except Exception as e:
        print(f"WHOOP callback error type: {type(e).__name__}")
        return jsonify({"error": "Failed to connect WHOOP account. Please try connecting again."}), 500


def _get_connection_access_token():
    conn_resp = (
        supabase_admin.table("whoop_connections")
        .select("*")
        .eq("user_id", g.user_id)
        .limit(1)
        .execute()
    )
    connection = conn_resp.data[0] if conn_resp.data else None
    if not connection:
        return None, None

    access_token = connection["access_token_encrypted"]

    if _parse_timestamp(connection["token_expires_at"]) <= datetime.now(timezone.utc):
        new_tokens = whoop.refresh_token(connection["refresh_token_encrypted"])
        access_token = new_tokens["access_token"]
        supabase_admin.table("whoop_connections").update(
            {
                "access_token_encrypted": new_tokens["access_token"],
                "refresh_token_encrypted": new_tokens["refresh_token"],
                "token_expires_at": _expires_at(new_tokens),
            }
        ).eq("id", connection["id"]).execute()

    return connection, access_token


@whoop_bp.route("/daily-scores", methods=["GET"])
@require_auth
def daily_scores():
    try:
        connection, access_token = _get_connection_access_token()
        if connection is None:
            return jsonify({"error": "No WHOOP connection found"}), 404
        start_date = (datetime.now(timezone.utc) - timedelta(days=8)).strftime("%Y-%m-%d")
        cycles = whoop.fetch_cycles(access_token, start_date)["records"]
        sleeps = whoop.fetch_sleep(access_token, start_date)["records"]
        recoveries = whoop.fetch_recovery(access_token, start_date)["records"]
        return jsonify({"days": whoop.daily_scores(cycles, sleeps, recoveries)})
    except requests.RequestException as error:
        return _whoop_error(error, "Unable to load daily scores from WHOOP. Please try again.",
                            unauthorized="Please reconnect WHOOP to grant access to daily scores and cycles.",
                            rate_limited="WHOOP rate limit reached. Please wait before refreshing daily scores.")
    except Exception as error:
        print(f"WHOOP daily scores error type: {type(error).__name__}")
        return jsonify({"error": "Unable to load daily WHOOP scores. Please try again."}), 500


@whoop_bp.route("/sync", methods=["POST"])
@require_auth
def sync():
    try:
        connection, access_token = _get_connection_access_token()
        if connection is None:
            return jsonify({"error": "No WHOOP connection found"}), 404

        start_date = None
        if connection.get("last_synced_at"):
            last_sync = _parse_timestamp(connection["last_synced_at"])
            start_date = min(datetime.now(timezone.utc) - timedelta(days=7), last_sync - timedelta(days=1)).strftime("%Y-%m-%d")

        fetchers = {"sleep": whoop.fetch_sleep, "recovery": whoop.fetch_recovery,
                    "workout": whoop.fetch_workouts, "cycle": whoop.fetch_cycles}
        records = {kind: fetch(access_token, start_date)["records"] for kind, fetch in fetchers.items()}
        for kind, items in records.items():
            whoop_archive.store_records(connection["id"], kind, items)

        supabase_admin.table("whoop_connections").update(
            {"last_synced_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", connection["id"]).execute()

        return jsonify({"synced": {"sleep": len(records["sleep"]), "recovery": len(records["recovery"]),
                                   "workouts": len(records["workout"])}})
    except requests.RequestException as error:
        return _whoop_error(error, "WHOOP rejected the data request. Please try syncing again.",
                            unauthorized="WHOOP authorization expired or lacks permission. Please reconnect your WHOOP account.",
                            rate_limited="WHOOP rate limit reached. Please wait before syncing again.")
    except Exception as error:
        error_code = getattr(error, "code", None)
        print(f"WHOOP sync error type: {type(error).__name__}, code: {error_code}")
        if error_code == "22P02":
            return jsonify({"error": "WHOOP v2 uses UUID activity IDs. Apply the WHOOP v2 database migration, then sync again."}), 500
        return jsonify({"error": "Unable to save WHOOP data. Please try syncing again."}), 500


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
        print(f"WHOOP status error type: {type(e).__name__}")
        return jsonify({"error": "Unable to check WHOOP connection. Please try again."}), 500
