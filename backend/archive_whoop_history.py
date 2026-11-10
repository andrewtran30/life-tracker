"""Import all available WHOOP history. Re-running safely keeps existing snapshots."""
import argparse
import json
import time

import requests
from flask import g

from app import app
from routes.whoop import _get_connection_access_token
from services import whoop, whoop_archive
from services.supabase_client import supabase_admin


def import_history(connection_id, get_access_token, report=print, pause=0.75):
    totals = {}
    for kind, path in whoop_archive.PATHS.items():
        params = {'limit': 25}
        count, pages = 0, 0
        seen_tokens = set()
        while True:
            for attempt in range(4):
                try:
                    page = whoop._whoop_fetch(path, get_access_token(), params)
                    break
                except requests.RequestException as error:
                    status = error.response.status_code if error.response is not None else None
                    if attempt == 3 or (status is not None and status not in (429, 500, 502, 503, 504)):
                        raise
                    delay = min(60, 2 ** attempt)
                    if status == 429:
                        delay = int(error.response.headers.get('X-RateLimit-Reset', '59')) + 1
                        if delay > 60:
                            raise RuntimeError('WHOOP rate limit requires waiting; saved pages are retained. Re-run later.') from None
                    report(json.dumps({'resource': kind, 'retry_in_seconds': delay}))
                    time.sleep(delay)
            records = page.get('records', [])
            whoop_archive.store_records(connection_id, kind, records)
            count += len(records)
            pages += 1
            report(json.dumps({'resource': kind, 'pages_saved': pages, 'records_saved': count}))
            next_token = page.get('next_token')
            if not next_token:
                break
            if next_token in seen_tokens:
                raise RuntimeError('WHOOP repeated a pagination token; saved pages are retained.')
            seen_tokens.add(next_token)
            params['nextToken'] = next_token
            time.sleep(pause)
        totals[kind] = count
    return totals


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user-id', help='Required if more than one WHOOP account is connected.')
    args = parser.parse_args()
    query = supabase_admin.table('whoop_connections').select('id,user_id')
    if args.user_id:
        query = query.eq('user_id', args.user_id)
    connections = query.execute().data
    if len(connections) != 1:
        raise SystemExit('Select exactly one connected WHOOP account using --user-id.')
    connection = connections[0]
    with app.test_request_context():
        g.user_id = connection['user_id']
        totals = import_history(connection['id'], lambda: _get_connection_access_token()[1])
    print(json.dumps({'complete': True, 'imported': totals}), flush=True)


if __name__ == '__main__':
    main()
