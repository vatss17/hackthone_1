-- PROPOSED, NOT APPLIED. Needs review and approval before it is run against any project.
--
-- Why: archived products are frozen by design (see 20261022150000): they can be neither edited nor restored through the API, and the
-- security tests assert that. Owners now need a way to undo an archive. Restoring stays an explicit, narrow operation: one owner-only
-- function that clears archived_at on ONE product of the caller's own company, and nothing else. It does not reopen editing of archived rows.
--
-- Behaviour:
--   * not found / already active / another company's product -> error P0002 (the same for all three, so nothing about other companies leaks)
--   * caller is not an owner of the product's company        -> error 42501
--   * an active product already has the same name or code    -> unique violation 23505 (the person renames one of them first)
--   * dependents (specifications, materials, factory links) were never deleted, so they come back with the product
create function public.restore_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select p.organization_id into v_org
  from public.products p
  where p.id = p_product_id and p.archived_at is not null;

  if v_org is null or not (select private.is_org_owner(v_org)) then
    -- one message for "does not exist" and "not yours", so the function cannot be used to probe other companies
    raise exception 'product not found or not restorable' using errcode = 'P0002';
  end if;

  update public.products set archived_at = null where id = p_product_id;
end;
$$;

revoke all on function public.restore_product(uuid) from public, anon;
grant execute on function public.restore_product(uuid) to authenticated;

comment on function public.restore_product(uuid) is
  'Owner-only: clears archived_at on one product of the caller''s own company. Does not allow editing archived rows.';
