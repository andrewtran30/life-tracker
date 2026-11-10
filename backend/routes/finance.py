import uuid

from flask import Blueprint, request, jsonify, g

from middleware.auth import require_auth
from services.supabase_client import supabase_admin
from services.csv_parser import parse_csv

finance_bp = Blueprint("finance", __name__, url_prefix="/api/finance")


@finance_bp.route("/import-csv", methods=["POST"])
@require_auth
def import_csv():
    body = request.json or {}
    csv_content = body.get("csvContent")
    account_id = body.get("accountId")

    if not csv_content or not account_id:
        return jsonify({"error": "Missing csvContent or accountId"}), 400

    account_resp = (
        supabase_admin.table("finance_accounts")
        .select("id")
        .eq("id", account_id)
        .eq("user_id", g.user_id)
        .maybe_single()
        .execute()
    )
    if not account_resp.data:
        return jsonify({"error": "Account not found"}), 404

    try:
        parsed = parse_csv(csv_content)
        batch_id = str(uuid.uuid4())

        transactions = [
            {
                "account_id": account_id,
                "amount": t["amount"],
                "description": t["description"],
                "date": t["date"],
                "type": t["type"],
                "source": "csv_import",
                "import_batch_id": batch_id,
            }
            for t in parsed
        ]

        result = supabase_admin.table("transactions").insert(transactions).execute()

        return jsonify({"imported": len(result.data), "batch_id": batch_id})
    except Exception as e:
        print(f"CSV import error: {e}")
        return jsonify({"error": "Failed to import CSV"}), 500
