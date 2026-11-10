"""Durable WHOOP snapshots and normalized records. Never delete missing upstream data."""
import hashlib
import json

from services.supabase_client import supabase_admin

PATHS = {'workout': '/activity/workout', 'sleep': '/activity/sleep',
         'recovery': '/recovery', 'cycle': '/cycle'}


def archive_rows(connection_id, kind, records):
    rows = []
    for record in records:
        digest = hashlib.sha256(json.dumps(record, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        rows.append({'connection_id': connection_id, 'resource_type': kind,
                     'whoop_id': str(record['cycle_id'] if kind == 'recovery' else record['id']),
                     'payload_hash': digest, 'payload': record,
                     'activity_start': record.get('start') or record.get('created_at'),
                     'source_updated_at': record.get('updated_at')})
    return rows


def normalized_rows(connection_id, kind, records):
    rows = []
    for record in records:
        score = record.get('score') or {}
        row = {'connection_id': connection_id}
        if kind == 'workout':
            row.update({'whoop_workout_id': record['id'],
                        'sport_name': record.get('sport_name') or (str(record['sport_id']) if record.get('sport_id') is not None else None),
                        'start_time': record.get('start'), 'end_time': record.get('end'),
                        'strain': score.get('strain'), 'avg_hr': score.get('average_heart_rate'),
                        'max_hr': score.get('max_heart_rate'),
                        'calories': float(score['kilojoule']) / 4.184 if score.get('kilojoule') is not None else None,
                        'distance_m': score.get('distance_meter')})
        elif kind == 'sleep':
            stage = score.get('stage_summary') or {}
            row.update({'whoop_sleep_id': record['id'], 'start_time': record.get('start'),
                        'end_time': record.get('end'),
                        'score': round(score['sleep_performance_percentage']) if score.get('sleep_performance_percentage') is not None else None,
                        'rem_duration_ms': stage.get('total_rem_sleep_time_milli'),
                        'deep_duration_ms': stage.get('total_slow_wave_sleep_time_milli'),
                        'light_duration_ms': stage.get('total_light_sleep_time_milli'),
                        'awake_duration_ms': stage.get('total_awake_time_milli'),
                        'respiratory_rate': score.get('respiratory_rate')})
        elif kind == 'recovery':
            row.update({'whoop_cycle_id': record.get('cycle_id'),
                        'date': record['created_at'].split('T')[0],
                        'recovery_score': round(score['recovery_score']) if score.get('recovery_score') is not None else None,
                        'hrv_rmssd': score.get('hrv_rmssd_milli'), 'resting_hr': score.get('resting_heart_rate'),
                        'spo2': score.get('spo2_percentage'), 'skin_temp_celsius': score.get('skin_temp_celsius')})
        else:
            continue
        rows.append(row)
    return rows


def store_records(connection_id, kind, records):
    if not records:
        return
    # A changed payload gets a new snapshot. Re-fetching identical data is idempotent.
    supabase_admin.table('whoop_activity_archive').upsert(
        archive_rows(connection_id, kind, records),
        on_conflict='connection_id,resource_type,whoop_id,payload_hash', ignore_duplicates=True).execute()
    tables = {'workout': ('workouts', 'whoop_workout_id'),
              'sleep': ('sleep_records', 'whoop_sleep_id'),
              'recovery': ('recovery_records', 'whoop_cycle_id')}
    if kind in tables:
        table, key = tables[kind]
        supabase_admin.table(table).upsert(normalized_rows(connection_id, kind, records), on_conflict=key).execute()


def saved_workout(connection_id, whoop_id):
    result = (supabase_admin.table('whoop_activity_archive').select('payload,archived_at')
              .eq('connection_id', connection_id).eq('resource_type', 'workout')
              .eq('whoop_id', str(whoop_id)).order('archived_at', desc=True).limit(1).execute())
    return result.data[0] if result.data else None
