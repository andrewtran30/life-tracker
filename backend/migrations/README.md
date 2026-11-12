# WHOOP v2 migration

Run `001_whoop_v2_activity_ids.sql` against the same Supabase project configured
in `backend/.env`, using the Supabase SQL Editor or a PostgreSQL connection with
schema alteration privileges. The service-role REST API key cannot apply SQL
migrations.

This transaction changes sleep and workout activity IDs from integers to text
so WHOOP v2 UUIDs can be stored. Existing values and unique constraints are
preserved. Cycle IDs remain numeric. The migration can be run again safely.

The current database had no sleep or workout rows when migration preparation
started. If importing historical v1 rows from another database, map their IDs
to v2 UUIDs before syncing overlapping dates to avoid duplicate activities.

After applying the migration, restart the Flask backend if it is not running
with automatic reload, then open Health and click Sync. The first sync also
runs automatically for a connection that has never synced successfully.

The integration uses WHOOP's `/developer/v2` endpoints for profile, sleep,
recovery, and workouts. OAuth continues to use `/oauth/oauth2/auth` and
`/oauth/oauth2/token`; those URLs are separate from the data API version.
Authorization and refresh requests include the `offline` scope. Collection
requests follow `next_token` using the `nextToken` query parameter.

References:
- https://developer.whoop.com/api/
- https://developer.whoop.com/docs/developing/v1-v2-migration/
- https://developer.whoop.com/docs/developing/oauth/

## Workout run log

`20261110034511_workout_run_details.sql` adds optional `running_shoes` and
`running_miles` fields to workouts. Apply it after the v2 activity ID migration.
Miles must be between 0 and 1,000; shoe names are limited to 200 characters.
Existing workout RLS remains enabled. The authenticated backend checks workout
ownership before loading WHOOP details or saving run fields.

Health loads saved workout history with pagination and filters it by sport.
Selecting an activity loads its archived WHOOP details, including heart rate
zones and elevation when available. Unarchived activities are fetched and saved
on first open. Running, walking, and hiking activities offer shoe and mileage fields.
These local fields are excluded from sync upserts, so syncing preserves them.
Blank mileage falls back to WHOOP distance in the list; it does not replace
WHOOP's original distance measurement.

The Shoes tab sums all saved eligible activities, with entered miles taking
priority over WHOOP distance. Shoe names are grouped without regard to case or
extra spaces. Activities without a shoe are counted separately; missing mileage
is flagged instead of being treated as a measured zero.

## Permanent history archive

`20261110035534_whoop_activity_archive.sql` creates the RLS-protected
`whoop_activity_archive` table. Full JSON payloads for workouts, sleeps,
recoveries, and cycles are retained. Distinct payload hashes preserve changed
versions; fetching the same payload again does not create a duplicate snapshot.
Sync never deletes records that disappear from WHOOP.

To import every page of currently available history, run from `backend/`:

```sh
./venv/bin/python -u archive_whoop_history.py
```

With multiple connected accounts, pass `--user-id <Supabase user UUID>`.
The importer saves each page before continuing and can be rerun safely after
an interruption. It refreshes expired credentials and paces requests to WHOOP.
First-time sync requests all available history. Subsequent syncs cover at least
seven days, extending back to the previous successful sync to avoid gaps.
Workout details can be read from the archive without WHOOP API access.

## Running tracker notes

Apply `backend/supabase/migrations/20261110225557_running_tracker_notes.sql` after the existing workout run log migration. It adds optional manually entered pace, splits, and feeling fields to workouts. These fields are preserved during WHOOP sync and use the existing workout ownership protections.
