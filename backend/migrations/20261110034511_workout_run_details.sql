BEGIN;

ALTER TABLE public.workouts
    ADD COLUMN running_shoes text CHECK (char_length(running_shoes) <= 200),
    ADD COLUMN running_miles numeric CHECK (running_miles >= 0 AND running_miles <= 1000);

COMMENT ON COLUMN public.workouts.running_shoes IS 'User-entered running shoes; never overwritten by WHOOP sync.';
COMMENT ON COLUMN public.workouts.running_miles IS 'User-entered distance in miles; WHOOP distance remains in distance_m.';

COMMIT;
