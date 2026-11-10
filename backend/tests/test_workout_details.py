import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID

from app import app
from flask import g
from routes.whoop import _owned_workout, _validate_run_details

WORKOUT_ID = '00000000-0000-4000-8000-000000000001'
WORKOUT = {'id': WORKOUT_ID, 'connection_id': 'connection', 'whoop_workout_id': WORKOUT_ID,
           'sport_name': 'running', 'running_shoes': 'My shoes', 'running_miles': 5.25}


class WorkoutDetailsTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.auth = patch('middleware.auth.supabase_admin.auth.get_user',
                          return_value=SimpleNamespace(user=SimpleNamespace(id='owner')))
        self.auth.start()
        self.addCleanup(self.auth.stop)
        self.headers = {'Authorization': 'Bearer test-token'}

    def test_authentication_required(self):
        self.assertEqual(self.client.get(f'/api/whoop/workouts/{WORKOUT_ID}').status_code, 401)
        self.assertEqual(self.client.patch(f'/api/whoop/workouts/{WORKOUT_ID}/run-details').status_code, 401)

    def test_ownership_query_scopes_to_signed_in_user(self):
        with patch('routes.whoop.supabase_admin') as admin, app.test_request_context():
            g.user_id = 'owner'
            builder = admin.table.return_value.select.return_value
            builder.eq.return_value = builder
            builder.limit.return_value.execute.return_value.data = [{**WORKOUT, 'whoop_connections': {'user_id': 'owner'}}]
            self.assertEqual(_owned_workout(UUID(WORKOUT_ID)), WORKOUT)
            builder.eq.assert_any_call('whoop_connections.user_id', 'owner')
            builder.eq.assert_any_call('id', WORKOUT_ID)

    def test_detail_uses_stored_whoop_id(self):
        with patch('routes.whoop._owned_workout', return_value=WORKOUT), \
             patch('routes.whoop.whoop_archive.saved_workout', return_value=None), \
             patch('routes.whoop.whoop_archive.store_records'), \
             patch('routes.whoop._get_connection_access_token', return_value=({}, 'access')), \
             patch('routes.whoop.whoop.fetch_workout', return_value={'id': WORKOUT_ID}) as fetch:
            response = self.client.get(f'/api/whoop/workouts/{WORKOUT_ID}', headers=self.headers)
            self.assertEqual(response.status_code, 200)
            fetch.assert_called_once_with('access', WORKOUT_ID)

    def test_other_users_cannot_fetch_or_edit_workout(self):
        with patch('routes.whoop._owned_workout', return_value=None), \
             patch('routes.whoop.whoop.fetch_workout') as fetch, \
             patch('routes.whoop.supabase_admin') as admin:
            self.assertEqual(self.client.get(f'/api/whoop/workouts/{WORKOUT_ID}', headers=self.headers).status_code, 404)
            response = self.client.patch(f'/api/whoop/workouts/{WORKOUT_ID}/run-details', headers=self.headers,
                                         json={'running_shoes': 'Shoes', 'running_miles': 5})
            self.assertEqual(response.status_code, 404)
            fetch.assert_not_called()
            admin.table.assert_not_called()

    def test_run_validation(self):
        self.assertEqual(_validate_run_details({'running_shoes': '  Shoes  ', 'running_miles': 0}),
                         {'running_shoes': 'Shoes', 'running_miles': 0})
        self.assertEqual(_validate_run_details({'running_shoes': '', 'running_miles': None}),
                         {'running_shoes': None, 'running_miles': None})
        for miles in [-1, 1001, float('nan'), float('inf'), True, '5']:
            with self.subTest(miles=miles), self.assertRaises(ValueError):
                _validate_run_details({'running_shoes': 'Shoes', 'running_miles': miles})
        for invalid in [None, [], {}, {'running_shoes': 'x' * 201, 'running_miles': 1},
                        {'running_shoes': [], 'running_miles': 1},
                        {'running_shoes': 'Shoes', 'running_miles': 1, 'connection_id': 'other'}]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                _validate_run_details(invalid)

    def test_save_only_changes_local_fields(self):
        with patch('routes.whoop._owned_workout', return_value=WORKOUT), \
             patch('routes.whoop.supabase_admin') as admin:
            builder = admin.table.return_value.update.return_value
            builder.eq.return_value = builder
            builder.execute.return_value.data = [{**WORKOUT, 'running_shoes': 'New shoes', 'running_miles': 6.2}]
            response = self.client.patch(f'/api/whoop/workouts/{WORKOUT_ID}/run-details', headers=self.headers,
                                         json={'running_shoes': 'New shoes', 'running_miles': 6.2})
            self.assertEqual(response.status_code, 200)
            admin.table.return_value.update.assert_called_once_with({'running_shoes': 'New shoes', 'running_miles': 6.2})
            builder.eq.assert_any_call('connection_id', 'connection')

    def test_non_running_activity_cannot_be_annotated(self):
        with patch('routes.whoop._owned_workout', return_value={**WORKOUT, 'sport_name': 'cycling'}):
            response = self.client.patch(f'/api/whoop/workouts/{WORKOUT_ID}/run-details', headers=self.headers,
                                         json={'running_shoes': 'Shoes', 'running_miles': 5})
            self.assertEqual(response.status_code, 400)

    def test_sync_omits_user_annotations(self):
        admin = MagicMock()
        with patch('routes.whoop._get_connection_access_token', return_value=({'id': 'connection'}, 'access')), \
             patch('routes.whoop.whoop.fetch_sleep', return_value={'records': []}), \
             patch('routes.whoop.whoop.fetch_recovery', return_value={'records': []}), \
             patch('routes.whoop.whoop.fetch_cycles', return_value={'records': []}), \
             patch('routes.whoop.whoop.fetch_workouts', return_value={'records': [{'id': WORKOUT_ID, 'sport_name': 'running'}]}), \
             patch('routes.whoop.supabase_admin', admin), \
             patch('services.whoop_archive.supabase_admin', admin):
            response = self.client.post('/api/whoop/sync', headers=self.headers)
            self.assertEqual(response.status_code, 200)
            rows = admin.table.return_value.upsert.call_args.args[0]
            self.assertNotIn('running_shoes', rows[0])
            self.assertNotIn('running_miles', rows[0])


if __name__ == '__main__':
    unittest.main()
