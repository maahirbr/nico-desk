-- Hand-written. Row level security on every table in public, with no policies, so the Supabase
-- anon and publishable keys read nothing through the REST API. The app connects as the table owner,
-- which is not subject to RLS, so it is unaffected. Views run with the caller's rights.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
  FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', r.viewname);
  END LOOP;
END $$;
