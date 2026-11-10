import os
import secrets
import requests

WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2"
WHOOP_API_URL = "https://api.prod.whoop.com/developer/v1"

CLIENT_ID = os.environ.get("WHOOP_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("WHOOP_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("WHOOP_REDIRECT_URI", "")

SCOPES = " ".join([
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
    )
    resp.raise_for_status()
    return resp.json()


def refresh_token(token: str) -> dict:
    resp = requests.post(
        f"{WHOOP_AUTH_URL}/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": token,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    resp.raise_for_status()
    return resp.json()


def _whoop_fetch(path: str, access_token: str) -> dict:
    resp = requests.get(
        f"{WHOOP_API_URL}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    resp.raise_for_status()
    return resp.json()


def fetch_profile(access_token: str) -> dict:
    return _whoop_fetch("/user/profile/basic", access_token)


def fetch_sleep(access_token: str, start_date: str) -> dict:
    return _whoop_fetch(f"/activity/sleep?start={start_date}T00:00:00.000Z&limit=25", access_token)


def fetch_recovery(access_token: str, start_date: str) -> dict:
    return _whoop_fetch(f"/recovery?start={start_date}T00:00:00.000Z&limit=25", access_token)


def fetch_workouts(access_token: str, start_date: str) -> dict:
    return _whoop_fetch(f"/activity/workout?start={start_date}T00:00:00.000Z&limit=25", access_token)
