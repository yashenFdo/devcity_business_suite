-- ============================================================
-- Live join requests: notify administrators instantly when someone
-- asks to join with the invite code. Realtime respects Row Level
-- Security, so only the workspace's admins receive these events.
--
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- ============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'join_requests'
     ) then
    alter publication supabase_realtime add table public.join_requests;
  end if;
end;
$$;
