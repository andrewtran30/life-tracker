import os
import secrets
import requests
from uuid import UUID

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2"
WHOOP_API_URL = "https://api.prod.whoop.com/developer/v2"

CLIENT_ID = os.environ.get("WHOOP_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("WHOOP_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("WHOOP_REDIRECT_URI", "")

SCOPES = " ".join([
    "offline",
    "read:recovery",
    "read:sleep",
    "read:workout",
    "read:profile",
    "read:body_measurement",
    "read:cycles",
])


def get_auth_url() -> tuple[str, str]:
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
    }
    qs = "&".join(f"{k}={requests.utils.quote(v)}" for k, v in params.items())
    return f"{WHOOP_AUTH_URL}/auth?{qs}", state


def exchange_code(code: str) -> dict:
    resp = requests.post(
        f"{WHOOP_AUTH_URL}/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
        },
        timeout=30,
    )
    print(f"WHOOP token exchange status: {resp.status_code}")
    resp.raise_for_status()
    return resp.json()


def refresh_token(token: str) -> dict:
    resp = requests.post(
        f"{WHOOP_AUTH_URL}/token",
        data={
            "grant_type": "refresh_token",
            "scope": "offline",
            "refresh_token": token,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _whoop_fetch(path: str, access_token: str, params: dict | None = None) -> dict:
    resp = requests.get(
        f"{WHOOP_API_URL}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_profile(access_token: str) -> dict:
    return _whoop_fetch("/user/profile/basic", access_token)


def fetch_sleep(access_token: str, start_date: str | None) -> dict:
    return _fetch_collection("/activity/sleep", access_token, start_date)


def fetch_recovery(access_token: str, start_date: str | None) -> dict:
    return _fetch_collection("/recovery", access_token, start_date)


def fetch_workouts(access_token: str, start_date: str | None) -> dict:
    return _fetch_collection("/activity/workout", access_token, start_date)


def fetch_workout(access_token: str, workout_id: str) -> dict:
    return _whoop_fetch(f"/activity/workout/{UUID(workout_id)}", access_token)


def fetch_cycles(access_token: str, start_date: str | None) -> dict:
    return _fetch_collection("/cycle", access_token, start_date)


def daily_scores(cycles: list, sleeps: list, recoveries: list) -> list:
    """Join WHOOP scores by cycle; naps must not replace the main sleep."""
    sleep_by_id = {s["id"]: s for s in sleeps if not s.get("nap")}
    sleep_by_cycle = {s["cycle_id"]: s for s in sleeps if not s.get("nap")}
    recovery_by_cycle = {r["cycle_id"]: r for r in recoveries}
    result = []
    for cycle in cycles:
        recovery = recovery_by_cycle.get(cycle["id"], {})
        sleep = sleep_by_id.get(recovery.get("sleep_id")) or sleep_by_cycle.get(cycle["id"], {})
        result.append({
            "cycle_id": cycle["id"],
            "start_time": cycle["start"],
            "end_time": cycle.get("end"),
            "timezone_offset": cycle["timezone_offset"],
            "sleep_end_time": sleep.get("end"),
            "sleep_score": (sleep.get("score") or {}).get("sleep_performance_percentage"),
            "recovery_score": (recovery.get("score") or {}).get("recovery_score"),
            "strain": (cycle.get("score") or {}).get("strain"),
        })
    return sorted(result, key=lambda row: row["start_time"])


def _fetch_collection(path: str, access_token: str, start_date: str | None) -> dict:
    params = {"limit": 25}
    if start_date is not None:
        params["start"] = f"{start_date}T00:00:00.000Z"
    records = []
    while True:
        page = _whoop_fetch(path, access_token, params)
        records.extend(page.get("records", []))
        next_token = page.get("next_token")
        if not next_token:
            return {"records": records}
        params["nextToken"] = next_token
