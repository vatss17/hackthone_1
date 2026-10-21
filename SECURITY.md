# Security

## Known advisory: `braces` stack exhaustion (open, no upstream patch)

| | |
|---|---|
| Advisory | GHSA-vfj7-8cjw-p6xm (CVE-2026-93687 as recorded by the project owner; `npm audit` reports the GHSA id) |
| Package | `braces` ≤ 3.0.3 (installed: 3.0.3, which is also the latest release on npm) |
| Issue | Stack-exhaustion denial of service on deeply nested brace patterns (CWE-674), CVSS 7.5 |
| Status | **Open.** No patched release exists. Last checked 22 Oct 2026. |

### Dependency chains

`braces` is only reached through `micromatch` → `fast-glob`, which two **development tools** use:

- `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`
- `shadcn` (component CLI) → `fast-glob` (also via `@shadcn/registry` and `ts-morph`) → `micromatch` → `braces`

`npm audit` lists 9 high entries. They are this one advisory repeated for each package in those chains.

### Exposure assessment

- **Production:** not exposed. `npm ls braces --omit=dev` returns an empty tree and `npm audit --omit=dev` reports 0 vulnerabilities. Both tools are in `devDependencies` and none of this code ships in the application.
- **Development / CI:** the vulnerable code runs when ESLint or the shadcn CLI expands file globs. Those patterns come from our own configuration and repository, not from network or user input, so an attacker has no route to supply a hostile pattern. The worst realistic outcome is a crashed local lint or CLI process.
- **Build hosts:** the build installs dev dependencies, so the same code is present there, with the same limited input.

### Remediation status

- `npm audit fix --force` is **not** used. It proposes downgrades (`eslint-config-next@14.2.35`, `shadcn@1.0.0`), which are breaking and unjustified for a dev-only issue.
- The advisory is **not** suppressed or ignored in automated checks. `npm audit` continues to report it.
- No unofficial patch is applied.
- `shadcn` was moved from `dependencies` to `devDependencies` (M1.2) so that it is out of the production tree.

### Revisit when

- a patched `braces` is published (then `npm update` should resolve it), or
- `fast-glob` / `micromatch` move to a different glob dependency, or
- a dependency starts passing externally supplied patterns to these libraries. Reassess immediately if that happens.

## Reporting a vulnerability

This project is pre-release and has no public disclosure process yet. Report concerns to the project owner directly.

## Secrets

Never commit secrets. `.env*` files are git-ignored (only `.env.example` may be committed). Service-role credentials must never reach the browser.

## Supabase advisor: `public.create_organization` is a SECURITY DEFINER function executable by `authenticated` (accepted, intentional)

Supabase's security advisor flags SECURITY DEFINER functions in an exposed schema that signed-in users can execute. `public.create_organization(text, text)` is one on purpose: it is the **only** way to create an organization, because API roles have no INSERT privilege on `organizations` or `memberships`.

Why this is acceptable, and what limits it:

- Identity comes only from `auth.uid()` (the verified session). The function takes no user id, organization id or role; `owner` is hard-coded.
- It requires a confirmed email, validates its inputs, and locks the caller's profile row so concurrent calls serialize; `memberships_user_id_key` (unique on `user_id`) is the database-level guarantee of one organization per user.
- `search_path = ''`, every reference schema-qualified; EXECUTE is revoked from PUBLIC and `anon`.
- Observed on the dev project (M1.3B.2): `service_role` also has EXECUTE (Supabase's default ACL for new functions in `public`), but a call without a user session is rejected ("not authenticated") and creates nothing. Revoking it is an open, optional hardening step.
- Verified by the `tests/db` suite on the dev project (41/41 passed, M1.3B.3): anonymous calls are rejected, invalid input is rejected, a second organization is rejected, 8 concurrent calls by one user produce exactly one organization.

The `private` helper functions are executable by `authenticated` only so RLS policies can call them; the Data API exposes only `public` and `graphql_public` (confirmed: requests for schema `private` return PGRST106).
