-- ============================================================
-- Stamps (company / personal) and secure document share links.
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- ============================================================

-- ─── Stamps ──────────────────────────────────────────────────
create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('company', 'personal')),
  -- Company stamps belong to the workspace; personal stamps to one member.
  owner_id uuid references public.profiles (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'company' and owner_id is null) or (kind = 'personal' and owner_id is not null))
);
create index stamps_ws_idx on public.stamps (workspace_id);

alter table public.stamps enable row level security;

-- Everyone in the workspace can see (and therefore apply) stamps.
create policy stamps_select on public.stamps for select to authenticated
  using (public.is_member(workspace_id));
-- Company stamps: administrators only. Personal stamps: only their owner (editors and admins).
create policy stamps_insert on public.stamps for insert to authenticated
  with check (
    (kind = 'company' and owner_id is null and public.has_role(workspace_id, '{admin}'))
    or (kind = 'personal' and owner_id = auth.uid() and public.has_role(workspace_id, '{admin,editor}'))
  );
create policy stamps_update on public.stamps for update to authenticated
  using (
    (kind = 'company' and public.has_role(workspace_id, '{admin}'))
    or (kind = 'personal' and owner_id = auth.uid() and public.is_member(workspace_id))
  )
  with check (
    (kind = 'company' and owner_id is null and public.has_role(workspace_id, '{admin}'))
    or (kind = 'personal' and owner_id = auth.uid() and public.has_role(workspace_id, '{admin,editor}'))
  );
create policy stamps_delete on public.stamps for delete to authenticated
  using (
    (kind = 'company' and public.has_role(workspace_id, '{admin}'))
    or (kind = 'personal' and (owner_id = auth.uid() or public.has_role(workspace_id, '{admin}')))
  );

create or replace function public.stamps_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;
    new.kind := old.kind;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger stamps_touch before insert or update on public.stamps
  for each row execute function public.stamps_touch();

revoke all on public.stamps from anon;
grant select, insert, update, delete on public.stamps to authenticated;

-- ─── Shared documents (public read-only links) ───────────────
create table public.shared_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  collection text not null check (collection in ('quotations', 'invoices', 'bills', 'receipts')),
  record_id text not null,
  document_number text not null check (char_length(document_number) <= 64),
  token_hash text not null unique,
  -- Rendered snapshot of the document at the time of sharing (what the recipient sees).
  snapshot jsonb not null check (octet_length(snapshot::text) <= 3000000),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz
);
create index shared_documents_record_idx on public.shared_documents (workspace_id, collection, record_id);

alter table public.shared_documents enable row level security;

-- Members can see which links exist for their workspace (not the token, which is only hashed).
create policy shared_select on public.shared_documents for select to authenticated
  using (public.is_member(workspace_id));
-- Supabase grants every column by default: remove that, then expose only safe columns.
revoke all on public.shared_documents from anon, authenticated;
grant select (id, workspace_id, collection, record_id, document_number, created_by, created_at, expires_at, revoked_at, view_count, last_viewed_at)
  on public.shared_documents to authenticated;

create or replace function public.create_share_link(
  p_workspace uuid,
  p_collection text,
  p_record_id text,
  p_number text,
  p_snapshot jsonb,
  p_days integer default 30
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_member(p_workspace) then
    raise exception 'You are not a member of this workspace' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.records
    where workspace_id = p_workspace and collection = p_collection and id = p_record_id
  ) then
    raise exception 'Document not found' using errcode = '22023';
  end if;
  insert into public.shared_documents (workspace_id, collection, record_id, document_number, token_hash, snapshot, expires_at)
  values (
    p_workspace, p_collection, p_record_id, left(p_number, 64),
    encode(sha256(convert_to(token, 'UTF8')), 'hex'), p_snapshot,
    case when p_days is null or p_days <= 0 then null else now() + make_interval(days => least(p_days, 365)) end
  );
  return token;
end;
$$;

create or replace function public.revoke_share_link(p_link uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.shared_documents;
begin
  select * into link from public.shared_documents where id = p_link;
  if link.id is null
     or not (link.created_by = auth.uid() and public.is_member(link.workspace_id))
        and not public.has_role(link.workspace_id, '{admin}') then
    raise exception 'Link not found' using errcode = '42501';
  end if;
  update public.shared_documents set revoked_at = now() where id = p_link;
end;
$$;

-- Public: open a shared document by its token (works without signing in).
create or replace function public.get_shared_document(p_token text)
returns table (snapshot jsonb, document_number text, workspace_name text, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.shared_documents;
  ws_name text;
begin
  select * into link from public.shared_documents
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if link.id is null then
    return;
  end if;
  select name into ws_name from public.workspaces where id = link.workspace_id;
  if link.revoked_at is not null then
    return query select null::jsonb, link.document_number, ws_name, 'revoked'::text, link.expires_at;
    return;
  end if;
  if link.expires_at is not null and link.expires_at < now() then
    return query select null::jsonb, link.document_number, ws_name, 'expired'::text, link.expires_at;
    return;
  end if;
  update public.shared_documents set view_count = view_count + 1, last_viewed_at = now() where id = link.id;
  return query select link.snapshot, link.document_number, ws_name, 'active'::text, link.expires_at;
end;
$$;

revoke execute on function public.create_share_link(uuid, text, text, text, jsonb, integer),
  public.revoke_share_link(uuid), public.get_shared_document(text), public.stamps_touch()
  from public, anon, authenticated;
grant execute on function public.create_share_link(uuid, text, text, text, jsonb, integer), public.revoke_share_link(uuid)
  to authenticated;
grant execute on function public.get_shared_document(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stamps'
     ) then
    alter publication supabase_realtime add table public.stamps;
  end if;
end;
$$;
