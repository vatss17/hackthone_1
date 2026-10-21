# Database security tests (tests/db)

Status: executed against the development project in M1.3B.3 (42 tests, 0 failed after fixing a harness bug). Re-run after any schema change.

These tests exercise the foundation migration through the same interfaces the app will use: Supabase Auth and the REST API, signed in as real (synthetic) users with the publishable key. All authorization assertions use a user's own session.

## What is privileged
`lib/admin.mjs` is the only file that reads `SUPABASE_SECRET_KEY`. It creates confirmed synthetic users, bootstraps staff rows, archives test organizations and deletes test users. `06-service-role-and-exposure.test.mjs` also uses it to assert what `service_role` cannot do. It is never used to make an authorization test pass.

## Safety
- Does nothing unless `DB_TESTS_ENABLED=1`.
- `lib/env.mjs` refuses to run unless `SUPABASE_URL` is the designated dev project host.
- Test users are `m13b2-<run>-<label>@example.com` with random in-memory passwords. Organizations are named `M13B2 TEST <run> ...`. No real data.
- Secrets are never printed. Keep them in `.env.local` (git-ignored), never in chat.
- Cleanup archives test organizations, then deletes the users. Test organizations, factories and audit rows remain in the dev database by design (audit is append-only); remove them by hand if wanted.

## Run (after the migration is applied)
```bash
cp .env.example .env.local     # then fill in values locally (optional: keep SUPABASE_SECRET_KEY in .env.test.local so the app never loads it)
# set DB_TESTS_ENABLED=1 in .env.local
npm run test:db
```

## Not automated here
Privilege probes that need SQL (function EXECUTE, `pg_default_acl`, table privileges for `service_role`, effective default-privilege probe) are section K of `docs/database-verification-checklist.md`; run them in the dashboard SQL editor.
The "unconfirmed email" case cannot be tested with a real session (unconfirmed users cannot sign in); test it by simulating claims in SQL.

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
