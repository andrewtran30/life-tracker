BEGIN;

ALTER TABLE public.sleep_records
    ALTER COLUMN whoop_sleep_id TYPE text USING whoop_sleep_id::text;

ALTER TABLE public.workouts
    ALTER COLUMN whoop_workout_id TYPE text USING whoop_workout_id::text;

COMMIT;
