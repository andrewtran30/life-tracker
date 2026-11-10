BEGIN;

CREATE TABLE public.whoop_activity_archive (
    connection_id uuid NOT NULL REFERENCES public.whoop_connections(id) ON DELETE RESTRICT,
    resource_type text NOT NULL CHECK (resource_type IN ('workout', 'sleep', 'recovery', 'cycle')),
    whoop_id text NOT NULL,
    payload_hash text NOT NULL,
    payload jsonb NOT NULL,
    activity_start timestamptz,
    source_updated_at timestamptz,
    archived_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (connection_id, resource_type, whoop_id, payload_hash)
);

CREATE INDEX whoop_archive_lookup ON public.whoop_activity_archive
    (connection_id, resource_type, whoop_id, archived_at DESC);

ALTER TABLE public.whoop_activity_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whoop_activity_archive FROM anon, authenticated;
GRANT SELECT ON public.whoop_activity_archive TO authenticated;
GRANT ALL ON public.whoop_activity_archive TO service_role;

CREATE POLICY "Users can read their own WHOOP archive"
ON public.whoop_activity_archive FOR SELECT TO authenticated
USING (connection_id IN (
    SELECT id FROM public.whoop_connections WHERE user_id = (SELECT auth.uid())
));

COMMENT ON TABLE public.whoop_activity_archive IS
    'Retained full WHOOP API payloads. Each distinct payload is a separate snapshot; sync never deletes history.';

COMMIT;
