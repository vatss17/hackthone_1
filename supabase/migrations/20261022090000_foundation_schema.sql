-- =============================================================================
-- Foundation schema (M1.3B.1)
--
-- STATUS: written but NOT executed. Static review only. Do not apply until the
-- migration has been independently reviewed and approved.
--
-- Tables: profiles, organizations, memberships, factories, audit_log,
--         platform_staff.
--
-- Two kinds of role, kept apart on purpose:
--   * Organization roles (owner, member): public.memberships.role. Scoped to one
--     organization. Created only by public.create_organization().
--   * Platform roles (admin, reviewer): public.platform_staff.role. Application
--     wide. No API role can write it. Rows are inserted by SQL run by the
--     project owner (postgres role / SQL editor), never by the client.
--
-- Security model in short:
--   * Row Level Security is enabled on every table (not FORCE: the table owner,
--     i.e. the postgres role running migrations and SECURITY DEFINER functions,
--     bypasses RLS by design; API roles never do).
--   * `anon` has no privileges on the six tables or on any function defined
--     here (its default schema-level access is left as Supabase set it).
--     `authenticated` gets the minimum table/column privileges listed below,
--     and RLS narrows them further.
--   * There is no INSERT/UPDATE/DELETE path for memberships, platform_staff or
--     audit_log from the API. organizations are created only via the RPC.
--   * Every function has EXECUTE revoked from PUBLIC, anon and authenticated,
--     then granted back only where listed. Trigger functions get no grants.
--   * Authorization helpers live in schema `private`, which is not exposed by
--     the Supabase Data API (verify `api.schemas` excludes it), so they cannot
--     be called as /rpc endpoints. RLS policies still evaluate them because
--     `authenticated` has USAGE on the schema and EXECUTE on those helpers.
--
-- Data lifecycle (see docs/data-lifecycle.md):
--   * Soft deletion: organizations/factories use archived_at. Hard DELETE is not
--     granted to API roles.
--   * Audit retention: audit_log is append-only and has no foreign keys, so it
--     outlives the rows and accounts it describes. No automatic purge. The
--     append-only protection holds for normal application and database
--     operations; a sufficiently privileged administrator (table owner,
--     superuser) can still disable triggers or alter the schema. It is a
--     tamper-evidence aid, not protection against a malicious DBA.
--   * Account erasure: NOT implemented here. Deleting an auth user cascades to
--     profile and memberships, but is blocked while the user is the last owner
--     of an active organization (see private.enforce_last_owner and the
--     scenario table in docs/data-lifecycle.md).
--
-- Ownership assumption: every function and table below is owned by the role that
-- runs this migration (postgres on Supabase). SECURITY DEFINER functions run
-- with that owner's rights, which includes bypassing RLS because RLS is not
-- FORCEd. This needs a runtime check (pg_proc.proowner, pg_class.relowner,
-- relforcerowsecurity). It also depends on that role having SELECT on
-- auth.users and CREATE TRIGGER on auth.users, which is unverified.
--
-- One-organization-per-user (MVP): enforced by memberships_user_id_key (all
-- roles) and made race-free by the row lock in public.create_organization().
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Schemas and enums
-- -----------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;   -- needed so RLS can call helpers

create type public.org_role as enum ('owner', 'member');
create type public.platform_role as enum ('admin', 'reviewer');


-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- One row per Supabase Auth user. Email stays in auth.users (not duplicated).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) between 1 and 200),
  phone       text check (phone is null or char_length(phone) between 5 and 30),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null
                 check (name = btrim(name) and char_length(name) between 2 and 200),
  legal_name   text
                 check (legal_name is null
                        or (legal_name = btrim(legal_name) and char_length(legal_name) between 2 and 300)),
  created_by   uuid references public.profiles (id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index organizations_created_by_idx on public.organizations (created_by);

-- Organization-scoped roles only. Platform staff roles are NOT stored here.
create table public.memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.org_role not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint memberships_org_user_key unique (organization_id, user_id),
  -- MVP RULE: a user belongs to exactly one organization, whatever the role.
  -- This is the database-level guarantee. The row lock in create_organization()
  -- only serializes concurrent callers so they get a clean error message.
  -- Its unique index also serves lookups by user_id (no separate index needed).
  --
  -- To allow several organizations per user later (a future migration):
  --   1. alter table public.memberships drop constraint memberships_user_id_key;
  --      (memberships_org_user_key still prevents duplicate membership rows.)
  --   2. create index memberships_user_id_idx on public.memberships (user_id);
  --   3. Remove the "already belongs to an organization" check from
  --      public.create_organization(), or replace it with a per-user limit.
  --   4. Decide how the app chooses the "current" organization. RLS policies are
  --      organization-based and need no change.
  constraint memberships_user_id_key unique (user_id)
);

create table public.factories (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  name             text not null
                     check (name = btrim(name) and char_length(name) between 2 and 200),
  address_line1    text not null
                     check (char_length(btrim(address_line1)) between 1 and 200),
  address_line2    text
                     check (address_line2 is null or char_length(address_line2) <= 200),
  city             text not null check (char_length(btrim(city)) between 1 and 100),
  state            text not null check (char_length(btrim(state)) between 1 and 100),
  postal_code      text not null check (char_length(btrim(postal_code)) between 3 and 12),
  country          text not null default 'IN' check (country = 'IN'),
  -- Set from the authenticated session. Not in the INSERT column grant, so a
  -- client cannot supply it.
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Target for composite foreign keys from future tenant-owned tables, e.g.
  --   foreign key (organization_id, factory_id) references factories (organization_id, id)
  -- which makes it impossible for a child row to point at another tenant's factory.
  constraint factories_org_id_key unique (organization_id, id)
);

create unique index factories_org_name_active_idx
  on public.factories (organization_id, lower(name))
  where archived_at is null;

-- Append-only. No foreign keys, so history survives deletion of what it describes.
create table public.audit_log (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  actor_id         uuid,
  actor_kind       text not null check (actor_kind in ('user', 'staff', 'system')),
  organization_id  uuid,
  action           text not null check (action ~ '^[a-z_]+\.[a-z]+$'),
  entity_type      text not null,
  entity_id        uuid,
  -- Column names and ids only. Never values of personal, document or credential data.
  details          jsonb not null default '{}'::jsonb
                     check (jsonb_typeof(details) = 'object')
);

create index audit_log_org_time_idx    on public.audit_log (organization_id, occurred_at desc);
create index audit_log_actor_time_idx  on public.audit_log (actor_id, occurred_at desc);
create index audit_log_entity_idx      on public.audit_log (entity_type, entity_id);

-- Platform-wide staff roles. Never written through the API.
create table public.platform_staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.platform_role not null,
  granted_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- Authorization helpers (schema private; called by RLS policies)
--
-- SECURITY DEFINER so they can read memberships / platform_staff without
-- re-entering RLS (which would recurse). Each derives the caller from
-- auth.uid() and returns only a boolean about the CALLER; none accepts a user id.
-- -----------------------------------------------------------------------------

create function private.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
  );
$$;

create function private.is_org_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff s
    where s.user_id = (select auth.uid())
      and s.role = 'admin'
  );
$$;

revoke all on function private.is_org_member(uuid)  from public, anon, authenticated;
revoke all on function private.is_org_owner(uuid)   from public, anon, authenticated;
revoke all on function private.is_platform_admin()  from public, anon, authenticated;
grant execute on function private.is_org_member(uuid)  to authenticated;
grant execute on function private.is_org_owner(uuid)   to authenticated;
grant execute on function private.is_platform_admin()  to authenticated;


-- -----------------------------------------------------------------------------
-- Trigger functions (no grants: they are only ever fired by triggers)
-- -----------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create the profile row for every new auth user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

-- The last owner of an active organization cannot be removed or demoted.
-- Locks the organization row first so two concurrent demotions serialize.
-- Behaviour by scenario (full table in docs/data-lifecycle.md):
--   active org, sole owner removed/demoted/account deleted -> BLOCKED
--   archived org (archived_at set)                         -> allowed
--   user with no membership                                -> trigger never fires
-- SECURITY DEFINER: reads other members' rows and locks the organization row,
-- which the invoking API role may not be allowed to do under RLS and grants.
-- It is a trigger function: no EXECUTE grants, not callable from the API.
create function private.enforce_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archived timestamptz;
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.organization_id <> old.organization_id)
  then
    select o.archived_at into v_archived
    from public.organizations o
    where o.id = old.organization_id
    for update;

    if v_archived is null
       and not exists (
         select 1
         from public.memberships m
         where m.organization_id = old.organization_id
           and m.role = 'owner'
           and m.id <> old.id
       )
    then
      raise exception 'cannot remove or demote the last owner of an organization'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Audit trigger for sensitive tables. Records that a change succeeded, who made
-- it, and WHICH columns changed, never the values. Role changes record the
-- role (not personal data); membership entries record the member's user id.
-- Fail-closed: if this insert fails, the audited change fails with it. Because
-- it is an AFTER ROW trigger inside the same transaction, a rolled-back change
-- leaves no audit row (only successful changes are recorded). Cascaded and
-- ON DELETE SET NULL changes also fire it, with actor_kind 'system' when there
-- is no JWT (e.g. Auth admin API, SQL editor).
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_row      jsonb;
  v_old      jsonb;
  v_changed  text[];
  v_details  jsonb;
  v_kind     text;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_details := jsonb_build_object('operation', lower(tg_op));

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    select coalesce(array_agg(n.key order by n.key), '{}'::text[])
      into v_changed
    from jsonb_each(v_row) n
    join jsonb_each(v_old) o on o.key = n.key
    where n.value is distinct from o.value
      and n.key <> 'updated_at';

    if cardinality(v_changed) = 0 then
      return null;  -- no meaningful change; AFTER trigger result is ignored
    end if;
    v_details := v_details || jsonb_build_object('changed_columns', to_jsonb(v_changed));
  end if;

  if tg_table_name in ('memberships', 'platform_staff') then
    v_details := v_details || jsonb_build_object('role', v_row ->> 'role');
    if tg_op = 'UPDATE' then
      v_details := v_details || jsonb_build_object('previous_role', v_old ->> 'role');
    end if;
  end if;
  if tg_table_name = 'memberships' then
    v_details := v_details || jsonb_build_object('user_id', v_row ->> 'user_id');
  end if;

  v_kind := case
    when v_uid is null then 'system'
    when exists (select 1 from public.platform_staff s where s.user_id = v_uid) then 'staff'
    else 'user'
  end;

  insert into public.audit_log
    (actor_id, actor_kind, organization_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    v_kind,
    case tg_table_name
      when 'organizations'   then (v_row ->> 'id')::uuid
      when 'platform_staff'  then null
      else (v_row ->> 'organization_id')::uuid
    end,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id')::uuid,
    v_details
  );

  return null;
end;
$$;

create function private.prevent_audit_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

revoke all on function private.set_updated_at()              from public, anon, authenticated;
revoke all on function private.handle_new_user()             from public, anon, authenticated;
revoke all on function private.enforce_last_owner()          from public, anon, authenticated;
revoke all on function private.audit_row_change()            from public, anon, authenticated;
revoke all on function private.prevent_audit_modification()  from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.factories
  for each row execute function private.set_updated_at();

create trigger enforce_last_owner
  before update or delete on public.memberships
  for each row execute function private.enforce_last_owner();

create trigger audit_organizations
  after insert or update or delete on public.organizations
  for each row execute function private.audit_row_change();
create trigger audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function private.audit_row_change();
create trigger audit_factories
  after insert or update or delete on public.factories
  for each row execute function private.audit_row_change();
create trigger audit_platform_staff
  after insert or update or delete on public.platform_staff
  for each row execute function private.audit_row_change();

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function private.prevent_audit_modification();
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.prevent_audit_modification();


-- -----------------------------------------------------------------------------
-- Privileges (least privilege) and Row Level Security
-- -----------------------------------------------------------------------------

-- Start from nothing for the API roles. Supabase's default privileges may have
-- granted ALL on new tables to anon/authenticated.
revoke all on table
  public.profiles, public.organizations, public.memberships,
  public.factories, public.audit_log, public.platform_staff
from anon, authenticated;

-- Defense in depth for FUTURE objects in schema public created by THIS role
-- (the role running the migration; postgres on Supabase). Deliberately scoped to
-- schema public: no global (all-schema) default privileges are changed, so
-- Supabase-managed schemas and extension objects are left alone.
--
-- Limits, so nobody over-trusts these three statements:
--   * PostgreSQL adds per-schema default privileges to the global ones. A
--     per-schema REVOKE can only cancel a per-schema GRANT, never a global one.
--     Whether Supabase's defaults for this role are per-schema (expected) or
--     global has NOT been verified; check pg_default_acl after applying.
--   * They never remove PUBLIC's built-in EXECUTE on new functions (only a
--     global statement could). Every future function must therefore carry its
--     own explicit REVOKE, as the functions below do.
--   * They affect only objects created later; they do not replace the explicit
--     per-object REVOKEs and GRANTs above and below, which are the real control.
-- The verification checklist (section K) probes the effective privileges.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

alter table public.profiles        enable row level security;
alter table public.organizations   enable row level security;
alter table public.memberships     enable row level security;
alter table public.factories       enable row level security;
alter table public.audit_log       enable row level security;
alter table public.platform_staff  enable row level security;

-- profiles: read own (or admin); edit own name/phone. No insert/delete.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: members read; owners edit name/legal_name. No insert/delete
-- (creation is via public.create_organization; archiving via a future admin function).
grant select on public.organizations to authenticated;
grant update (name, legal_name) on public.organizations to authenticated;

create policy organizations_select on public.organizations
  for select to authenticated
  using ((select private.is_org_member(id)) or (select private.is_platform_admin()));

create policy organizations_update_owner on public.organizations
  for update to authenticated
  using ((select private.is_org_owner(id)))
  with check ((select private.is_org_owner(id)));

-- memberships: read-only from the API.
grant select on public.memberships to authenticated;

create policy memberships_select on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_org_owner(organization_id))
    or (select private.is_platform_admin())
  );

-- factories: members read; owners create and edit (no hard delete: set archived_at).
-- organization_id is insertable but NOT updatable, so a factory cannot be moved
-- between organizations; created_by is not client-writable at all.
grant select on public.factories to authenticated;
grant insert (organization_id, name, address_line1, address_line2, city, state, postal_code)
  on public.factories to authenticated;
grant update (name, address_line1, address_line2, city, state, postal_code, archived_at)
  on public.factories to authenticated;

create policy factories_select on public.factories
  for select to authenticated
  using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));

create policy factories_insert_owner on public.factories
  for insert to authenticated
  with check ((select private.is_org_owner(organization_id)));

create policy factories_update_owner on public.factories
  for update to authenticated
  using ((select private.is_org_owner(organization_id)))
  with check ((select private.is_org_owner(organization_id)));

-- audit_log: platform admins read. Nobody writes through the API.
grant select on public.audit_log to authenticated;

-- service_role (server-side code only) keeps SELECT but loses every write
-- privilege, so server code holding that key cannot forge or alter audit rows.
-- Rows are written only by the SECURITY DEFINER trigger function, which runs as
-- the table owner. (service_role exists on Supabase; this statement is
-- Supabase-specific.)
revoke insert, update, delete, truncate on public.audit_log from service_role;

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select private.is_platform_admin()));

-- platform_staff: a user can see their own row; admins see all. No API writes.
grant select on public.platform_staff to authenticated;

create policy platform_staff_select on public.platform_staff
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));


-- -----------------------------------------------------------------------------
-- Controlled organization creation (the only way to create an organization)
--
-- Called as /rpc/create_organization. Identity comes from auth.uid() (the
-- verified JWT of the database session); the function accepts no user id,
-- organization id or role. Role 'owner' is hard-coded.
--
-- Concurrency: the user's own profiles row is locked FOR UPDATE before the
-- "already has an organization" check. A second concurrent call by the same user
-- blocks on that lock until the first transaction commits, then re-runs its check
-- with a fresh READ COMMITTED snapshot, sees the new membership and is rejected.
-- Calls by different users lock different rows and do not block each other.
-- Guarantee: memberships_user_id_key (unique on user_id, all roles) rejects any
-- second membership row for the user even if this function's logic were bypassed
-- or wrong; the lock only makes the failure clean and ordered.
-- -----------------------------------------------------------------------------

create function public.create_organization(p_name text, p_legal_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := btrim(p_name);
  v_legal  text := nullif(btrim(coalesce(p_legal_name, '')), '');
  v_org    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = v_uid and u.email_confirmed_at is not null
  ) then
    raise exception 'email address not confirmed' using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) not between 2 and 200 then
    raise exception 'organization name must be 2 to 200 characters' using errcode = '22023';
  end if;
  if v_legal is not null and char_length(v_legal) not between 2 and 300 then
    raise exception 'legal name must be 2 to 300 characters' using errcode = '22023';
  end if;

  -- Serialize concurrent calls for this user.
  perform 1 from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = v_uid) then
    raise exception 'user already belongs to an organization' using errcode = '23505';
  end if;

  insert into public.organizations (name, legal_name, created_by)
  values (v_name, v_legal, v_uid)
  returning id into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org, v_uid, 'owner');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon, authenticated;
grant execute on function public.create_organization(text, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Bootstrap note (NOT executed by this migration)
--
-- The first platform admin is created by the project owner running SQL as the
-- postgres role (Supabase SQL editor or CLI), never through the API:
--
--   insert into public.platform_staff (user_id, role)
--   values ('<auth user uuid>', 'admin');
--
-- The change is recorded in audit_log with actor_kind 'system' (no JWT).
-- -----------------------------------------------------------------------------
