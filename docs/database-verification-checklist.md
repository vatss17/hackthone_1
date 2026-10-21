# Database verification checklist (run after the migration is applied)

Status: sections B to J were exercised through `tests/db` against the dev project in M1.3B.3 (see "Known test gaps" at the end). Sections A and K were checked with read-only queries in M1.3B.2; K4 is not yet run.

## A. Structure and privileges (as the owner role)
- [ ] Migration applies cleanly on an empty database, and in order from a reset.
- [ ] Six tables exist; `relrowsecurity = true` on all; `relforcerowsecurity = false`.
- [ ] Constraints and indexes exist as designed (`memberships_user_id_key`, `memberships_org_user_key`, `factories_org_id_key`, partial unique `factories_org_name_active_idx`, audit indexes).
- [ ] `anon` has no privilege on any table, sequence or function in `public` and `private` (`information_schema.role_table_grants`, `has_function_privilege`).
- [ ] `authenticated` has only the table/column grants listed in the migration. No INSERT/UPDATE/DELETE on `memberships`, `audit_log`, `platform_staff`; no DELETE anywhere.
- [ ] `service_role` has no INSERT/UPDATE/DELETE/TRUNCATE on `audit_log` (query K2).
- [ ] Every function (query K1): `proowner` is the migration role; SECURITY DEFINER ones have `proconfig` containing `search_path=`; `PUBLIC` and `anon` have no EXECUTE; only `create_organization` and the three `private.is_*` helpers are executable by `authenticated`.
- [ ] `private` schema is absent from the Data API schemas (`config.toml` `api.schemas`) and `/rest/v1/rpc/is_org_member` returns 404 for a signed-in user. GraphQL does not list the tables to `anon`.
- [ ] Default ACLs and effective privileges for future objects: see section K (queries K3 and K4). The migration only changes per-schema defaults in `public`.

## B. Auth user and profile creation
- [ ] Creating an auth user creates exactly one `profiles` row with only `id` set.
- [ ] Duplicate trigger firing does not fail (`on conflict do nothing`).
- [ ] Deleting an auth user with no organization removes the profile.

## C. Organization creation
- [ ] Unauthenticated call to `create_organization` fails (`28000`); `anon` cannot execute it.
- [ ] Unconfirmed email fails (`42501`). Requires `enable_confirmations = true`; local default auto-confirms.
- [ ] Invalid names (empty, 1 char, 201 chars) fail (`22023`).
- [ ] Success creates one organization (`created_by` = caller) and one `owner` membership in one transaction; returns the id.
- [ ] Extra or spoofed arguments (user id, role) are not accepted; the function signature has only the two text parameters.
- [ ] Failure midway (force a failure) leaves no organization row and no audit row.

## D. Concurrency and one-organization-per-user
- [ ] N parallel `create_organization` calls by the **same** user: exactly one succeeds, the others fail with "user already belongs to an organization" (not a raw unique violation), no extra organization rows are left.
- [ ] Parallel calls by **different** users all succeed without blocking each other.
- [ ] A second call after success fails.
- [ ] As the owner role, directly inserting a second membership (any role) for the same user fails on `memberships_user_id_key`.

## E. Cross-tenant isolation (users A and B in different organizations)
- [ ] B cannot SELECT A's organization, memberships or factories (list, by id, by filter, via embedded joins).
- [ ] B cannot insert a factory into A's organization.
- [ ] B cannot update A's organization or factory (0 rows affected).
- [ ] `anon` reads nothing from any table.

## F. RLS SELECT / INSERT / UPDATE by table
- [ ] profiles: read own only; update own `full_name`/`phone`; cannot update `id`; cannot read others'.
- [ ] organizations: owner updates `name`/`legal_name`; cannot update `archived_at`, `created_by`, `id`; cannot insert or delete.
- [ ] memberships: user reads own row; no insert/update/delete.
- [ ] factories: owner inserts and updates allowed columns; `organization_id` update fails; supplied `created_by` fails (no grant) and default equals caller; duplicate active name in same organization fails; same name in another organization succeeds; archive via `archived_at` works; delete fails.
- [ ] audit_log and platform_staff: non-staff read nothing; no writes.

## G. Role escalation attempts (as a manufacturer)
- [ ] Insert/update `memberships` (set own role to owner, join A's organization): denied.
- [ ] Insert/update `platform_staff`: denied.
- [ ] Update `user_metadata`/`app_metadata` claims has no effect on any access.
- [ ] Calling `private.*` helpers or trigger functions through the API: not reachable.
- [ ] A platform admin (inserted via SQL) can read all organizations, factories, memberships and audit_log but cannot write them; a reviewer sees nothing in M1.

## H. SECURITY DEFINER behaviour
- [ ] `is_org_member`/`is_org_owner` return true only for the caller's own memberships; a changed JWT subject changes the result.
- [ ] Policies still work after a user is removed from an organization (no stale access).
- [ ] No policy recursion errors on `memberships`.
- [ ] `create_organization` and helpers resolve correctly with the empty `search_path` (no "relation does not exist").

## I. Audit triggers
- [ ] Organization creation writes `organizations.insert` and `memberships.insert` (actor = caller, kind `user`) and nothing else.
- [ ] Update of an organization name writes one row with `changed_columns: ["name"]` and no values; a no-op update writes nothing.
- [ ] No audit row contains names, addresses, phones, emails or documents (inspect `details` for every action).
- [ ] Staff actor yields `actor_kind` `staff`; SQL editor / service key yields `system`.
- [ ] `UPDATE`, `DELETE`, `TRUNCATE` on `audit_log` fail even as the owner role and as `service_role`.
- [ ] A failed (rolled back) change leaves no audit row.
- [ ] Audit rows survive deletion of the user and organization they reference.

## J. Active and archived organization lifecycle
- [ ] Active org, sole owner: delete membership, demote, and Auth user deletion are all rejected; the user and organization remain intact.
- [ ] Archive the organization (as owner role), then delete the owner's account: succeeds; profile and membership gone; `created_by` NULL; organization and factories remain; audit rows for the cascade exist with `system`.
- [ ] User with no organization deletes their account: succeeds.
- [ ] Two parallel demotions of two owners (SQL-level test) leave at least one owner.

## K. Effective-privilege and trigger probes (run as the owner role unless stated)

These queries read what PostgreSQL will actually enforce. Record the results; do not assume them.

**K1. Function EXECUTE for PUBLIC, anon, authenticated.** Expected: only `create_organization` and the three `private.is_*` helpers show `authenticated_execute = true`; every row has `public_execute = false` and `anon_execute = false`. Any other row, or any `true` under public/anon, is a failure.
```sql
select n.nspname as schema, p.proname as function, p.prosecdef as security_definer,
       pg_get_userbyid(p.proowner) as owner,
       exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prokind = 'f'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- skip extension functions
order by 1, 2;
```
Also check that every `security_definer = true` row has `search_path=` in `config`.

**K2. Table privileges for service_role (and anon/authenticated).** Expected: `audit_log` shows service_role SELECT only; `anon` all false on all six tables; `authenticated` matches the grants in the migration.
```sql
select c.relname as table,
       has_table_privilege('service_role',  c.oid, 'SELECT')   as sr_select,
       has_table_privilege('service_role',  c.oid, 'INSERT')   as sr_insert,
       has_table_privilege('service_role',  c.oid, 'UPDATE')   as sr_update,
       has_table_privilege('service_role',  c.oid, 'DELETE')   as sr_delete,
       has_table_privilege('service_role',  c.oid, 'TRUNCATE') as sr_truncate,
       has_table_privilege('anon',          c.oid, 'SELECT')   as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT')   as auth_select,
       has_table_privilege('authenticated', c.oid, 'INSERT')   as auth_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE')   as auth_update,
       has_table_privilege('authenticated', c.oid, 'DELETE')   as auth_delete
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

select table_name, column_name, privilege_type
from information_schema.column_privileges
where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE')
order by 1, 3, 2;
```
Confirm the service_role privilege is direct and not inherited: `select rolname, rolinherit from pg_roles where rolname = 'service_role';` and `select * from pg_auth_members where member = (select oid from pg_roles where rolname = 'service_role');`

**K3. Default ACLs.** Expected: per-schema `public` entries for the migration role do not grant tables, sequences or functions to anon/authenticated. Note any GLOBAL entry (`schema` is null) that grants to anon/authenticated: it stays effective (the migration does not touch global defaults) and must be a conscious decision.
```sql
select pg_get_userbyid(d.defaclrole) as role, n.nspname as schema,
       d.defaclobjtype as objtype, d.defaclacl as acl
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
order by 1, 2 nulls first, 3;
```

**K4. Effective default privileges probe (throwaway objects, rolled back).** Expected: anon/authenticated have no privilege on the new table or sequence; the function result shows what future functions get (PUBLIC execute is expected to remain TRUE because the migration does not remove it, so every future function needs its own REVOKE).
```sql
begin;
create table public._probe (id serial primary key);
create function public._probe_fn() returns int language sql as 'select 1';
select has_table_privilege('anon', 'public._probe', 'SELECT')          as anon_table,
       has_table_privilege('authenticated', 'public._probe', 'SELECT') as auth_table,
       has_sequence_privilege('authenticated', 'public._probe_id_seq', 'USAGE') as auth_seq,
       has_function_privilege('anon', 'public._probe_fn()', 'EXECUTE')          as anon_fn,
       has_function_privilege('authenticated', 'public._probe_fn()', 'EXECUTE') as auth_fn;
rollback;
```

**K5. Private schema is not reachable through the API.** With the local stack and a signed-in user's JWT:
- [ ] `config.toml` `[api] schemas` does not list `private`.
- [ ] `POST /rest/v1/rpc/is_org_member` (and `is_org_owner`, `is_platform_admin`) returns 404 (`PGRST202`).
- [ ] A request with header `Accept-Profile: private` (or `Content-Profile: private`) is rejected as an unknown schema (`PGRST106`).
- [ ] `GET /rest/v1/` (OpenAPI root) and a GraphQL introspection query, as `anon` and as `authenticated`, do not list `private` objects, and `anon` sees none of the six tables.
- [ ] `POST /rest/v1/rpc/create_organization` works for `authenticated` and is rejected for `anon`.

**K6. Trigger behaviour under authenticated and Auth-managed operations.**
- [ ] Auth-managed insert: sign-up through the Auth API succeeds and creates the profile row (the `on_auth_user_created` trigger runs under the Auth service role). A "Database error saving new user" means the trigger path needs a privilege fix. Contingency, to be applied only if the test fails: `grant usage on schema private to supabase_auth_admin;`.
- [ ] Authenticated update of own profile succeeds and `updated_at` changes (the non-definer `set_updated_at` trigger runs without a permission error).
- [ ] Authenticated factory insert/update succeeds and writes an audit row (`audit_row_change` runs as definer).
- [ ] `service_role` insert/update on a non-audit table fires `set_updated_at` and writes an audit row with `actor_kind = 'system'`.
- [ ] `UPDATE`/`DELETE`/`TRUNCATE` on `audit_log`: `authenticated` and `service_role` get "permission denied"; the owner role gets the "append-only" exception from the trigger.
- [ ] Auth admin API delete of a user with no organization succeeds; of an active sole owner fails and leaves user, profile and organization intact; of an owner of an archived organization succeeds (cascade runs as table owners, not as the Auth role).

## Known test gaps (recorded after M1.3B.3: 42 tests, 0 failed)

Not covered by `tests/db` yet. None of these is a known failure; each is simply unproven.

| Gap | Why it is not covered | Planned way to cover it |
|---|---|---|
| **Unconfirmed-email behaviour** of `create_organization` | An unconfirmed user cannot sign in, so there is no real session to call the function with. | Simulate claims in SQL as the owner role (`set local role authenticated; set local request.jwt.claims = ...`) for a user whose `email_confirmed_at` is null, in a rolled-back transaction. |
| **K4 default privileges probe** | Creates throwaway objects (DDL) in a transaction; the linked query path may not hold a transaction open. | Run the rolled-back probe from checklist section K4 in the dashboard SQL editor. |
| **Public sign-up path** (`/auth/v1/signup`) | The suite creates users through the Auth admin API, which also fires the `auth.users` trigger but is not the public path. | Covered end to end by the M1.3C authentication tests once email delivery allows it; otherwise a signed-link test (`generate_link`). |
| **Concurrent owner demotion** (`enforce_last_owner` race) | No API path can change memberships, so it needs a SQL-level two-session test. | Two parallel owner-role sessions demoting two owners of one organization; at least one owner must remain. |
| **Direct second-membership insert** (the unique constraint itself) | API roles cannot insert memberships; only the owner role can. | Owner-role insert of a second membership for one user must fail on `memberships_user_id_key`. |
| **Reachability of `private` via GraphQL / OpenAPI** | `pg_graphql` is not enabled and the REST root document is refused to publishable keys, so neither can be enumerated. | Asserted as the observed responses; the test fails if either behaviour changes. |
