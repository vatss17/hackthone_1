-- M1.4B.1 corrective migration: account deletion under archived parents.
--
-- DEFECT (found while verifying 20261022150000 on the hosted dev project)
--   Deleting an auth user failed with "Database error deleting user" when any row they
--   created sat under an ARCHIVED factory or product. Cause: every created_by column is
--   `references public.profiles (id) on delete set null`. Deleting the user deletes the
--   profile, which makes PostgreSQL itself UPDATE each child row to set created_by = NULL.
--   Those updates fire private.enforce_active_parents (BEFORE UPDATE), which refuses every
--   change to a dependent of an archived parent (errcode 55000), so the whole deletion
--   rolls back. All seven tables with that trigger are affected, not only factory_products:
--   factory_processes, machines, factory_materials, product_specifications,
--   product_materials, factory_products, certifications.
--
-- FIX
--   One narrow exception in the same function. An UPDATE of a dependent of an archived
--   parent is let through only when ALL of these hold:
--     1. created_by goes from a user id to NULL (never to another user, never from NULL);
--     2. the profile that created_by pointed at no longer exists, i.e. the account really is
--        being deleted (the referential action runs after the profile row is deleted, and
--        this function sees that deletion). Nulling the attribution of a live user is refused;
--     3. every other column is identical, ignoring only updated_at, which the existing
--        set_updated_at trigger refreshes after this function runs. archived_at,
--        organization_id, factory_id, product_id and all business values are compared and so
--        stay protected.
--   Everything else is unchanged: inserts, deletes, and any other update under an archived
--   parent are still refused with 55000.
--
-- SECOND, SMALL HARDENING found while testing abuse paths (same function)
--   The original function looked only at the NEW row's parents. A privileged SQL caller
--   (service_role or the database owner; not an API user, since factory_id, product_id and
--   organization_id are insert-only columns) could therefore UPDATE a dependent of an archived
--   factory so that it points at an ACTIVE factory, moving it out of the frozen set. The function
--   now checks the OLD row's parents on UPDATE too. Ordinary behaviour is unchanged.
--
-- NOT CHANGED: no table, column, grant, policy or other function. Manufacturers still have no
-- privilege on created_by, so they cannot reach this exception through the API at all; the
-- exception exists only for the database's own account-deletion cleanup.
--
-- The earlier migrations are not edited. CREATE OR REPLACE keeps the function's owner and its
-- existing privileges (no EXECUTE for PUBLIC, anon or authenticated), which are re-asserted below.

create or replace function private.enforce_active_parents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       jsonb;
  v_org       uuid;
  v_factory   uuid;
  v_product   uuid;
  v_archived  timestamptz;
  v_rows      jsonb[];
begin
  -- Account-deletion cleanup of the created_by attribution (see header). Evaluated before
  -- any parent lookup; every condition must hold or the normal freeze rules apply.
  if tg_op = 'UPDATE'
     and old.created_by is not null
     and new.created_by is null
     and (to_jsonb(new) - 'created_by' - 'updated_at') = (to_jsonb(old) - 'created_by' - 'updated_at')
     and not exists (select 1 from public.profiles p where p.id = old.created_by)
  then
    return new;
  end if;

  -- The row's parents are checked as they were before the change as well as after it, so a
  -- privileged caller cannot move a dependent out of an archived parent into an active one.
  -- (Not reachable through the API: factory_id, product_id and organization_id are insert-only.)
  if tg_op = 'DELETE' then
    v_rows := array[to_jsonb(old)];
  elsif tg_op = 'INSERT' then
    v_rows := array[to_jsonb(new)];
  else
    v_rows := array[to_jsonb(old), to_jsonb(new)];
  end if;

  foreach v_row in array v_rows loop
    v_org     := (v_row ->> 'organization_id')::uuid;
    v_factory := (v_row ->> 'factory_id')::uuid;
    v_product := (v_row ->> 'product_id')::uuid;

    if v_factory is not null then
      select f.archived_at into v_archived
      from public.factories f
      where f.id = v_factory and f.organization_id = v_org
      for share;
      if found and v_archived is not null then
        raise exception 'the factory is archived; its records cannot be changed' using errcode = '55000';
      end if;
    end if;

    if v_product is not null then
      select p.archived_at into v_archived
      from public.products p
      where p.id = v_product and p.organization_id = v_org
      for share;
      if found and v_archived is not null then
        raise exception 'the product is archived; its records cannot be changed' using errcode = '55000';
      end if;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_active_parents() from public, anon, authenticated;
