import os
import json
from datetime import datetime, timedelta

import requests

from services.supabase_client import supabase_admin

TEMPLATE_SUMMARY = """Good morning! Here's your daily snapshot:

{sleep_section}
{recovery_section}
{finance_section}
{mood_section}

**Recommendations:**
{recommendations}"""


def _build_template_summary(data: dict) -> tuple[str, list[str]]:
    sections: list[str] = []
    recommendations: list[str] = []

    sleep = data.get("sleep")
    if sleep:
        sections.append(f"**Sleep:** Score {sleep['score']}/100 ({sleep['duration_hours']:.1f}h)")
        if sleep["score"] < 70:
            recommendations.append("Your sleep score was below average. Consider an earlier bedtime tonight.")
        if sleep["duration_hours"] < 7:
            recommendations.append("You slept under 7 hours. Aim for 7-9 hours for optimal recovery.")
    else:
        sections.append("**Sleep:** No data available")

    recovery = data.get("recovery")
    if recovery:
        sections.append(
            f"**Recovery:** {recovery['score']}% | HRV: {recovery['hrv']:.0f}ms | Resting HR: {recovery['resting_hr']:.0f}bpm"
        )
        if recovery["score"] < 34:
            recommendations.append("Recovery is in the red zone. Consider a rest day or light activity only.")
        elif recovery["score"] < 67:
            recommendations.append("Recovery is moderate. A medium-intensity workout would be appropriate.")
        else:
            recommendations.append("Recovery is green. You're primed for a high-intensity session if you want one.")
    else:
        sections.append("**Recovery:** No data available")

    spending = data.get("spending_yesterday")
    if spending is not None:
        sections.append(f"**Yesterday's spending:** ${spending:.2f}")
        if spending > 100:
            recommendations.append("Spending was above $100 yesterday. Review your transactions to stay on budget.")
    else:
        sections.append("**Spending:** No transactions logged yet")

    mood = data.get("mood")
    energy = data.get("energy")
    if mood:
        sections.append(f"**Mood:** {mood}/10 | **Energy:** {energy or '—'}/10")
        if mood <= 4:
            recommendations.append("Your mood was low. Consider journaling about what's weighing on you.")
    else:
        sections.append("**Mood:** Not logged yet")

    if not recommendations:
        recommendations.append("Keep up the great work! You're on track with your routine.")

    summary = TEMPLATE_SUMMARY.format(
        sleep_section=sections[0],
        recovery_section=sections[1],
        finance_section=sections[2],
        mood_section=sections[3],
        recommendations="\n".join(f"- {r}" for r in recommendations),
    )
    return summary, recommendations


def _generate_ai_summary(data: dict, goals: list[dict]) -> tuple[str, list[str]]:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        template_summary, template_recs = _build_template_summary(data)
        return (
            f"⚠️ AI summary unavailable: Missing Anthropic API key. Using template summary instead.\n\n{template_summary}",
            template_recs,
        )

    goals_text = "\n".join(f"- [{g['domain']}] {g['title']}" for g in goals) if goals else "No goals set yet."

    prompt = f"""You are a personal health and life coach. Based on the user's data from today, provide a brief, encouraging morning summary with actionable recommendations to help them reach their goals.

User's data:
{json.dumps(data, indent=2)}

User's active goals:
{goals_text}

Keep it concise (3-4 sentences for summary, 2-3 bullet recommendations). Be specific to their numbers, not generic."""

    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 512,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"]
        return text, []
    except Exception:
        template_summary, template_recs = _build_template_summary(data)
        return (
            f"⚠️ AI summary generation failed. Using template summary.\n\n{template_summary}",
            template_recs,
        )


def generate_daily_summary(user_id: str, date: str) -> dict:
    yesterday = (datetime.fromisoformat(date) - timedelta(days=1)).strftime("%Y-%m-%d")

    conn_resp = supabase_admin.table("whoop_connections").select("id").eq("user_id", user_id).limit(1).execute()
    connection_id = conn_resp.data[0]["id"] if conn_resp.data else None

    sleep_data = None
    recovery_data = None
    if connection_id:
        sleep_resp = (
            supabase_admin.table("sleep_records")
            .select("score, start_time, end_time")
            .eq("connection_id", connection_id)
            .gte("end_time", f"{yesterday}T00:00:00")
            .lt("end_time", f"{date}T00:00:00")
            .order("end_time", desc=True)
            .limit(1)
            .execute()
        )
        if sleep_resp.data:
            s = sleep_resp.data[0]
            start = datetime.fromisoformat(s["start_time"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(s["end_time"].replace("Z", "+00:00"))
            sleep_data = {
                "score": s["score"],
                "duration_hours": (end - start).total_seconds() / 3600,
            }

        recovery_resp = (
            supabase_admin.table("recovery_records")
            .select("recovery_score, hrv_rmssd, resting_hr")
            .eq("connection_id", connection_id)
            .eq("date", yesterday)
            .limit(1)
            .execute()
        )
        if recovery_resp.data:
            r = recovery_resp.data[0]
            recovery_data = {
                "score": r["recovery_score"],
                "hrv": r["hrv_rmssd"],
                "resting_hr": r["resting_hr"],
            }

    tx_resp = (
        supabase_admin.table("transactions")
        .select("amount, type, account_id, finance_accounts!inner(user_id)")
        .eq("finance_accounts.user_id", user_id)
        .eq("date", yesterday)
        .execute()
    )
    spending = sum(float(t["amount"]) for t in (tx_resp.data or []) if t["type"] == "debit")

    journal_resp = (
        supabase_admin.table("journal_entries")
        .select("mood_score, energy_score")
        .eq("user_id", user_id)
        .eq("date", yesterday)
        .limit(1)
        .execute()
    )
    journal = journal_resp.data[0] if journal_resp.data else None

    goals_resp = (
        supabase_admin.table("user_goals")
        .select("title, domain")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    goals = goals_resp.data or []

    summary_data = {
        "sleep": sleep_data,
        "recovery": recovery_data,
        "spending_yesterday": spending,
        "mood": journal["mood_score"] if journal else None,
        "energy": journal["energy_score"] if journal else None,
    }

    summary_text, recommendations = _generate_ai_summary(summary_data, goals)

    result = supabase_admin.table("daily_summaries").upsert(
        {
            "user_id": user_id,
            "date": date,
            "summary_text": summary_text,
            "recommendations": recommendations,
            "health_snapshot": {"sleep": sleep_data, "recovery": recovery_data},
            "finance_snapshot": {"spending_yesterday": spending},
            "mood_snapshot": {"mood": summary_data["mood"], "energy": summary_data["energy"]},
            "generated_at": datetime.utcnow().isoformat(),
        },
        on_conflict="user_id,date",
    ).execute()

    return result.data[0]
