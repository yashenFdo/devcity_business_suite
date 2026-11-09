-- ============================================================
-- DevCity Business Suite — multi-user workspaces
--
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Every table has Row Level Security. Membership changes go
-- through SECURITY DEFINER functions that check the caller's role.
-- ============================================================

-- ─── Types ───────────────────────────────────────────────────
create type public.member_role as enum ('admin', 'editor', 'viewer');
create type public.employment_status as enum ('active', 'on_leave', 'left');
create type public.join_request_status as enum ('pending', 'approved', 'declined', 'cancelled');

-- ─── Profiles (one per auth user) ─────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Workspaces ──────────────────────────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  company jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,
  join_code text not null unique,
  join_code_enabled boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'viewer',
  -- Employee directory
  job_title text check (char_length(job_title) <= 80),
  department text check (char_length(department) <= 80),
  phone text check (char_length(phone) <= 40),
  start_date date,
  employment_status public.employment_status not null default 'active',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  role public.member_role not null default 'editor',
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index workspace_invitations_ws_idx on public.workspace_invitations (workspace_id);
create index workspace_invitations_email_idx on public.workspace_invitations (email);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 300),
  status public.join_request_status not null default 'pending',
  role public.member_role,
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz
);
create unique index join_requests_one_pending on public.join_requests (workspace_id, user_id) where status = 'pending';

-- ─── Business records (quotations, invoices, bills, receipts, customers) ──
create table public.records (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  collection text not null check (collection in ('quotations', 'invoices', 'bills', 'receipts', 'customers')),
  id text not null check (char_length(id) <= 64),
  number text check (char_length(number) <= 64),
  data jsonb not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, collection, id)
);
create unique index records_number_unique on public.records (workspace_id, collection, number) where number is not null;

create or replace function public.records_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- ─── Audit log (append-only) ─────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users (id) on delete set null,
  actor_name text not null check (char_length(actor_name) <= 120),
  category text not null check (category in ('auth', 'document', 'customer', 'settings', 'team', 'security')),
  action text not null check (char_length(action) <= 300),
  target text check (char_length(target) <= 200),
  at timestamptz not null default now()
);
create index audit_log_ws_at_idx on public.audit_log (workspace_id, at desc);

-- The server stamps who did it and when; clients can't spoof either.
create or replace function public.audit_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_id := auth.uid();
  new.actor_name := coalesce((select nullif(full_name, '') from public.profiles where id = auth.uid()), new.actor_name, 'Unknown');
  new.at := now();
  return new;
end;
$$;
create trigger audit_stamp before insert on public.audit_log
  for each row execute function public.audit_stamp();

-- ─── Access helpers (SECURITY DEFINER avoids RLS recursion) ──
create or replace function public.my_role(ws uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid() and employment_status <> 'left'
$$;

create or replace function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role(ws) is not null
$$;

create or replace function public.has_role(ws uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role(ws) = any (roles), false)
$$;

create or replace function public.shares_workspace(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and a.employment_status <> 'left' and b.user_id = other
  )
$$;

-- Admins may see the profile of someone asking to join their workspace.
create or replace function public.is_pending_requester(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.join_requests r
    where r.user_id = other and r.status = 'pending' and public.has_role(r.workspace_id, '{admin}')
  )
$$;

create or replace function public.active_admin_count(ws uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.workspace_members
  where workspace_id = ws and role = 'admin' and employment_status <> 'left'
$$;

create or replace function public.new_join_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex');
  code text := '';
begin
  for i in 0..9 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return 'DEV-' || substr(code, 1, 5) || '-' || substr(code, 6, 5);
end;
$$;

create or replace function public.require_user()
returns uuid
language plpgsql
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  return auth.uid();
end;
$$;

-- ─── Row Level Security ──────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.join_requests enable row level security;
alter table public.records enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: yourself and colleagues; you may edit your own name/avatar.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id) or public.is_pending_requester(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces: members read; admins update allowed columns (see grants below).
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_role(id, '{admin}')) with check (public.has_role(id, '{admin}'));

-- Members: colleagues can read the directory. All changes go through functions.
create policy members_select on public.workspace_members for select to authenticated
  using (public.is_member(workspace_id) or user_id = auth.uid());

-- Invitations: admins only.
create policy invitations_select on public.workspace_invitations for select to authenticated
  using (public.has_role(workspace_id, '{admin}'));

-- Join requests: admins of the workspace, or the requester.
create policy join_requests_select on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(workspace_id, '{admin}'));

-- Records: members read; admins & editors write; only admins delete.
create policy records_select on public.records for select to authenticated
  using (public.is_member(workspace_id));
create policy records_insert on public.records for insert to authenticated
  with check (public.has_role(workspace_id, '{admin,editor}'));
create policy records_update on public.records for update to authenticated
  using (public.has_role(workspace_id, '{admin,editor}'))
  with check (public.has_role(workspace_id, '{admin,editor}'));
create policy records_delete on public.records for delete to authenticated
  using (public.has_role(workspace_id, '{admin}'));

-- Audit: any member appends as themselves; only admins read; nobody edits.
create policy audit_insert on public.audit_log for insert to authenticated
  with check (public.is_member(workspace_id) and actor_id = auth.uid());
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_role(workspace_id, '{admin}'));

-- ─── Grants ──────────────────────────────────────────────────
revoke all on all tables in schema public from anon;

grant select, update on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

grant select on public.workspaces to authenticated;
revoke update on public.workspaces from authenticated;
grant update (name, company, policy, join_code_enabled) on public.workspaces to authenticated;

grant select on public.workspace_members, public.workspace_invitations, public.join_requests to authenticated;
revoke insert, update, delete on public.workspace_members, public.workspace_invitations, public.join_requests from authenticated;

grant select, insert, update, delete on public.records to authenticated;
grant select, insert on public.audit_log to authenticated;
revoke update, delete on public.audit_log from authenticated;

-- ─── Workspace functions ─────────────────────────────────────
create or replace function public.create_workspace(p_name text, p_company jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_user();
  ws uuid;
  code text;
begin
  loop
    code := public.new_join_code();
    exit when not exists (select 1 from public.workspaces where join_code = code);
  end loop;
  insert into public.workspaces (name, company, join_code, created_by)
  values (trim(p_name), coalesce(p_company, '{}'::jsonb), code, uid)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role, start_date)
  values (ws, uid, 'admin', current_date);
  return ws;
end;
$$;

create or replace function public.regenerate_join_code(p_workspace uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
begin
  if not public.has_role(p_workspace, '{admin}') then
    raise exception 'Only administrators can change the invite code' using errcode = '42501';
  end if;
  loop
    code := public.new_join_code();
    exit when not exists (select 1 from public.workspaces where join_code = code);
  end loop;
  update public.workspaces set join_code = code where id = p_workspace;
  return code;
end;
$$;

-- ─── Email invitations ───────────────────────────────────────
create or replace function public.invite_member(p_workspace uuid, p_email text, p_role public.member_role)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text := lower(trim(p_email));
  token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.has_role(p_workspace, '{admin}') then
    raise exception 'Only administrators can invite people' using errcode = '42501';
  end if;
  if email_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workspace_members m join public.profiles p on p.id = m.user_id
    where m.workspace_id = p_workspace and p.email = email_norm and m.employment_status <> 'left'
  ) then
    raise exception '% is already a member of this workspace', email_norm using errcode = '23505';
  end if;
  update public.workspace_invitations set revoked_at = now()
  where workspace_id = p_workspace and email = email_norm and accepted_at is null and revoked_at is null;
  insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by)
  values (p_workspace, email_norm, p_role, encode(sha256(convert_to(token, 'UTF8')), 'hex'), auth.uid());
  return token;
end;
$$;

create or replace function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.workspace_invitations where id = p_invitation;
  if ws is null or not public.has_role(ws, '{admin}') then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
  update public.workspace_invitations set revoked_at = now() where id = p_invitation and accepted_at is null;
end;
$$;

-- Preview an invitation from its link (works before signing in).
create or replace function public.get_invitation(p_token text)
returns table (workspace_name text, email text, role public.member_role, inviter_name text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select w.name, i.email, i.role, coalesce(p.full_name, 'An administrator'),
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

create or replace function public.accept_invitation_row(inv public.workspace_invitations)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_user();
  my_email text;
begin
  select lower(email) into my_email from auth.users where id = uid;
  if inv.id is null or inv.revoked_at is not null then
    raise exception 'This invitation is no longer valid' using errcode = '22023';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invitation has already been used' using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask for a new one.' using errcode = '22023';
  end if;
  if inv.email <> my_email then
    raise exception 'This invitation was sent to %. Sign in with that email to accept it.', inv.email using errcode = '42501';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role, start_date)
  values (inv.workspace_id, uid, inv.role, current_date)
  on conflict (workspace_id, user_id) do update set role = excluded.role, employment_status = 'active';
  update public.workspace_invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.join_requests set status = 'approved', role = inv.role, decided_at = now()
  where workspace_id = inv.workspace_id and user_id = uid and status = 'pending';
  return inv.workspace_id;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invitations;
begin
  select * into inv from public.workspace_invitations
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  return public.accept_invitation_row(inv);
end;
$$;

-- Invitations addressed to the signed-in user's email (shown on the onboarding screen).
create or replace function public.my_invitations()
returns table (id uuid, workspace_name text, role public.member_role, inviter_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, w.name, i.role, coalesce(p.full_name, 'An administrator'), i.created_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.profiles p on p.id = i.invited_by
  where i.email = (select lower(email) from auth.users where id = auth.uid())
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = i.workspace_id and m.user_id = auth.uid() and m.employment_status <> 'left'
    )
  order by i.created_at desc
$$;

create or replace function public.accept_invitation_by_id(p_invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invitations;
begin
  select * into inv from public.workspace_invitations where id = p_invitation;
  return public.accept_invitation_row(inv);
end;
$$;

-- ─── Invite code + admin approval ────────────────────────────
create or replace function public.request_to_join(p_code text, p_message text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := public.require_user();
  ws public.workspaces;
begin
  select * into ws from public.workspaces
  where join_code = upper(trim(p_code)) and join_code_enabled;
  if ws.id is null then
    raise exception 'That invite code is not valid' using errcode = '22023';
  end if;
  if exists (select 1 from public.workspace_members where workspace_id = ws.id and user_id = uid and employment_status <> 'left') then
    raise exception 'You are already a member of %', ws.name using errcode = '23505';
  end if;
  insert into public.join_requests (workspace_id, user_id, message)
  values (ws.id, uid, nullif(trim(p_message), ''))
  on conflict (workspace_id, user_id) where status = 'pending' do nothing;
  return ws.name;
end;
$$;

create or replace function public.my_join_requests()
returns table (id uuid, workspace_name text, status public.join_request_status, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, w.name, r.status, r.created_at
  from public.join_requests r join public.workspaces w on w.id = r.workspace_id
  where r.user_id = auth.uid() and r.status in ('pending', 'declined')
  order by r.created_at desc
  limit 20
$$;

create or replace function public.cancel_join_request(p_request uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.join_requests set status = 'cancelled', decided_at = now()
  where id = p_request and user_id = auth.uid() and status = 'pending'
$$;

create or replace function public.decide_join_request(p_request uuid, p_approve boolean, p_role public.member_role default 'viewer')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.join_requests;
begin
  select * into req from public.join_requests where id = p_request;
  if req.id is null or not public.has_role(req.workspace_id, '{admin}') then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if req.status <> 'pending' then
    raise exception 'This request has already been handled' using errcode = '22023';
  end if;
  update public.join_requests
  set status = case when p_approve then 'approved'::public.join_request_status else 'declined'::public.join_request_status end,
      role = case when p_approve then p_role end,
      decided_by = auth.uid(), decided_at = now()
  where id = p_request;
  if p_approve then
    insert into public.workspace_members (workspace_id, user_id, role, start_date)
    values (req.workspace_id, req.user_id, p_role, current_date)
    on conflict (workspace_id, user_id) do update set role = excluded.role, employment_status = 'active';
  end if;
end;
$$;

-- ─── Members & employee directory ────────────────────────────
create or replace function public.update_member(
  p_workspace uuid,
  p_user uuid,
  p_role public.member_role default null,
  p_job_title text default null,
  p_department text default null,
  p_phone text default null,
  p_start_date date default null,
  p_status public.employment_status default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := public.has_role(p_workspace, '{admin}');
  current_row public.workspace_members;
begin
  select * into current_row from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if current_row.user_id is null then
    raise exception 'Member not found' using errcode = '42501';
  end if;
  if not is_admin then
    -- Members may only update their own phone number.
    if p_user <> auth.uid() or not public.is_member(p_workspace)
       or p_role is not null or p_job_title is not null or p_department is not null
       or p_start_date is not null or p_status is not null then
      raise exception 'Only administrators can change this' using errcode = '42501';
    end if;
  end if;
  if current_row.role = 'admin' and current_row.employment_status <> 'left'
     and ((p_role is not null and p_role <> 'admin') or p_status = 'left')
     and public.active_admin_count(p_workspace) <= 1 then
    raise exception 'The workspace needs at least one administrator' using errcode = '22023';
  end if;
  update public.workspace_members set
    role = coalesce(p_role, role),
    job_title = coalesce(nullif(trim(p_job_title), ''), case when p_job_title = '' then null else job_title end),
    department = coalesce(nullif(trim(p_department), ''), case when p_department = '' then null else department end),
    phone = coalesce(nullif(trim(p_phone), ''), case when p_phone = '' then null else phone end),
    start_date = coalesce(p_start_date, start_date),
    employment_status = coalesce(p_status, employment_status)
  where workspace_id = p_workspace and user_id = p_user;
end;
$$;

create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.workspace_members;
begin
  select * into target from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if target.user_id is null then
    raise exception 'Member not found' using errcode = '42501';
  end if;
  if p_user <> auth.uid() and not public.has_role(p_workspace, '{admin}') then
    raise exception 'Only administrators can remove members' using errcode = '42501';
  end if;
  if target.role = 'admin' and target.employment_status <> 'left' and public.active_admin_count(p_workspace) <= 1 then
    raise exception 'The workspace needs at least one administrator' using errcode = '22023';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
end;
$$;

create or replace function public.touch_last_seen(p_workspace uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.workspace_members set last_seen_at = now()
  where workspace_id = p_workspace and user_id = auth.uid()
$$;

-- Functions are executable by PUBLIC by default: lock everything down, then allow only what's needed.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.my_role(uuid), public.is_member(uuid), public.has_role(uuid, public.member_role[]),
  public.shares_workspace(uuid), public.is_pending_requester(uuid), public.active_admin_count(uuid),
  public.create_workspace(text, jsonb), public.regenerate_join_code(uuid),
  public.invite_member(uuid, text, public.member_role), public.revoke_invitation(uuid),
  public.accept_invitation(text), public.my_invitations(), public.accept_invitation_by_id(uuid),
  public.request_to_join(text, text), public.my_join_requests(), public.cancel_join_request(uuid),
  public.decide_join_request(uuid, boolean, public.member_role),
  public.update_member(uuid, uuid, public.member_role, text, text, text, date, public.employment_status),
  public.remove_member(uuid, uuid), public.touch_last_seen(uuid)
to authenticated;
-- The invitation preview is the only function callable before signing in.
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ─── Realtime (live updates between colleagues) ──────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.records, public.workspace_members, public.workspaces;
  end if;
end;
$$;
