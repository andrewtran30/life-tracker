BEGIN;
ALTER TABLE public.workouts
    ADD COLUMN IF NOT EXISTS running_pace text CHECK (char_length(running_pace) <= 40),
    ADD COLUMN IF NOT EXISTS running_splits text CHECK (char_length(running_splits) <= 4000),
    ADD COLUMN IF NOT EXISTS running_feeling text CHECK (char_length(running_feeling) <= 4000);
COMMIT;
