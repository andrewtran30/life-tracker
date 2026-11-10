import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from app import app
from archive_whoop_history import import_history
from services.shoes import summarize_shoes, shoe_activity_type
from services.whoop_archive import archive_rows, normalized_rows, store_records
from test_workout_details import WORKOUT, WORKOUT_ID


class ShoeMileageTests(unittest.TestCase):
    def test_mileage_by_activity_and_manual_distance_priority(self):
        rows = [
            {'sport_name': 'running', 'running_shoes': '  Pegasus  ', 'running_miles': 5, 'distance_m': 9999},
            {'sport_name': 'walking', 'running_shoes': 'pegasus', 'distance_m': 1609.344},
            {'sport_name': 'hiking-rucking', 'running_shoes': 'Pegasus', 'distance_m': 3218.688},
            {'sport_name': 'running', 'running_shoes': 'Pegasus', 'running_miles': 0, 'distance_m': 9999},
            {'sport_name': 'running', 'running_shoes': 'Pegasus', 'distance_m': None},
            {'sport_name': 'cycling', 'running_shoes': 'Pegasus', 'running_miles': 100},
            {'sport_name': 'walking', 'running_shoes': None, 'distance_m': 1609},
        ]
        result = summarize_shoes(rows)
        self.assertEqual(result['unassigned_activities'], 1)
        shoe = result['shoes'][0]
        self.assertEqual(shoe['total_miles'], 8)
        self.assertEqual(shoe['running_miles'], 5)
        self.assertEqual(shoe['walking_miles'], 1)
        self.assertEqual(shoe['hiking_miles'], 2)
        self.assertEqual(shoe['activities'], 5)
        self.assertEqual(shoe['missing_distance'], 1)

    def test_legacy_and_hiking_names(self):
        for name in ['Hiking/Rucking', 'hiking-rucking', '52']:
            self.assertEqual(shoe_activity_type(name), 'hiking')
        self.assertEqual(shoe_activity_type('63'), 'walking')
        self.assertEqual(shoe_activity_type('0'), 'running')
        self.assertIsNone(shoe_activity_type('cycling'))

    def test_walking_and_hiking_can_save_shoes(self):
        with patch('middleware.auth.supabase_admin.auth.get_user', return_value=SimpleNamespace(user=SimpleNamespace(id='owner'))):
            for sport in ['walking', 'hiking-rucking']:
                with self.subTest(sport=sport), patch('routes.whoop._owned_workout', return_value={**WORKOUT, 'sport_name': sport}), patch('routes.whoop.supabase_admin') as admin:
                    admin.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [WORKOUT]
                    response = app.test_client().patch(f'/api/whoop/workouts/{WORKOUT_ID}/run-details', headers={'Authorization': 'Bearer test'}, json={'running_shoes': 'Shoes', 'running_miles': 2})
                    self.assertEqual(response.status_code, 200)

    def test_totals_paginate_and_scope_to_owner(self):
        builder = MagicMock()
        builder.eq.return_value = builder
        builder.order.return_value = builder
        builder.range.return_value.execute.side_effect = [SimpleNamespace(data=[{'sport_name': 'walking', 'running_shoes': 'Shoes', 'running_miles': 1}] * 1000), SimpleNamespace(data=[{'sport_name': 'hiking', 'running_shoes': 'Shoes', 'running_miles': 2}])]
        with patch('middleware.auth.supabase_admin.auth.get_user', return_value=SimpleNamespace(user=SimpleNamespace(id='owner'))), patch('routes.whoop.supabase_admin') as admin:
            admin.table.return_value.select.return_value = builder
            response = app.test_client().get('/api/whoop/shoes', headers={'Authorization': 'Bearer test'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()['shoes'][0]['total_miles'], 1002)
            self.assertEqual(builder.eq.call_count, 2)
            builder.eq.assert_called_with('whoop_connections.user_id', 'owner')
            builder.range.assert_any_call(1000, 1999)


class ArchiveTests(unittest.TestCase):
    def test_identical_payloads_are_idempotent_changed_payloads_retained(self):
        first = archive_rows('connection', 'workout', [{'id': WORKOUT_ID, 'score': {'strain': 1}}])[0]
        again = archive_rows('connection', 'workout', [{'score': {'strain': 1}, 'id': WORKOUT_ID}])[0]
        changed = archive_rows('connection', 'workout', [{'id': WORKOUT_ID, 'score': {'strain': 2}}])[0]
        self.assertEqual(first['payload_hash'], again['payload_hash'])
        self.assertNotEqual(first['payload_hash'], changed['payload_hash'])
        self.assertEqual(first['payload']['score']['strain'], 1)

    def test_normalization_does_not_overwrite_shoes(self):
        row = normalized_rows('connection', 'workout', [{'id': WORKOUT_ID, 'sport_name': 'running'}])[0]
        self.assertNotIn('running_shoes', row)
        self.assertNotIn('running_miles', row)

    def test_snapshots_are_append_only_on_conflict(self):
        with patch('services.whoop_archive.supabase_admin') as admin:
            store_records('connection', 'cycle', [{'id': 1}])
            kwargs = admin.table.return_value.upsert.call_args.kwargs
            self.assertTrue(kwargs['ignore_duplicates'])
            self.assertIn('payload_hash', kwargs['on_conflict'])
            admin.table.return_value.delete.assert_not_called()

    def test_archived_workout_does_not_require_whoop(self):
        with patch('middleware.auth.supabase_admin.auth.get_user', return_value=SimpleNamespace(user=SimpleNamespace(id='owner'))), patch('routes.whoop._owned_workout', return_value=WORKOUT), patch('routes.whoop.whoop_archive.saved_workout', return_value={'payload': {'id': WORKOUT_ID}, 'archived_at': '2026-11-09'}), patch('routes.whoop.whoop.fetch_workout') as fetch, patch('routes.whoop._get_connection_access_token') as token:
            response = app.test_client().get(f'/api/whoop/workouts/{WORKOUT_ID}', headers={'Authorization': 'Bearer test'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()['source'], 'archive')
            fetch.assert_not_called()
            token.assert_not_called()

    def test_history_import_follows_every_page_without_start_filter(self):
        calls = []
        def fetch(path, token, params):
            calls.append((path, dict(params)))
            return {'records': [{'id': len(calls)}], 'next_token': 'page-two' if 'nextToken' not in params else None}
        with patch('archive_whoop_history.whoop._whoop_fetch', side_effect=fetch), patch('archive_whoop_history.whoop_archive.store_records') as save:
            totals = import_history('connection', lambda: 'access', report=lambda _: None, pause=0)
            self.assertEqual(totals, {'workout': 2, 'sleep': 2, 'recovery': 2, 'cycle': 2})
            self.assertEqual(save.call_count, 8)
            self.assertTrue(all('start' not in params for _, params in calls))
            self.assertEqual(calls[1][1]['nextToken'], 'page-two')


if __name__ == '__main__':
    unittest.main()
