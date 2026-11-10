import csv
import io
import re
from typing import TypedDict


class ParsedTransaction(TypedDict):
    date: str
    description: str
    amount: float
    type: str


def parse_csv(csv_content: str) -> list[ParsedTransaction]:
    reader = csv.DictReader(io.StringIO(csv_content))
    reader.fieldnames = [h.strip().lower() for h in (reader.fieldnames or [])]

    transactions: list[ParsedTransaction] = []
    for row in reader:
        raw_amount = (
            row.get("amount")
            or row.get("debit")
            or row.get("credit")
            or "0"
        )
        amount = float(re.sub(r"[$,]", "", raw_amount))

        tx_type = "debit"
        if "type" in row and row["type"]:
            tx_type = "credit" if "credit" in row["type"].lower() else "debit"
        elif amount < 0 or row.get("debit"):
            tx_type = "debit"
        elif row.get("credit"):
            tx_type = "credit"

        date = (
            row.get("date")
            or row.get("transaction_date")
            or row.get("posting date")
            or ""
        )
        description = (
            row.get("description")
            or row.get("memo")
            or row.get("name")
            or row.get("payee")
            or ""
        )

        abs_amount = abs(amount)
        if abs_amount > 0:
            transactions.append({
                "date": date,
                "description": description,
                "amount": abs_amount,
                "type": tx_type,
            })

    return transactions
