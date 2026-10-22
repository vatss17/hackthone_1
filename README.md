# Export Enablement Platform

Working title. An export enablement platform for Indian manufacturers (initial focus: finished plastic products to the UAE).

**Status: Demo Sprint 2, the Export Feasibility Engine (not yet committed). Sprint 1 is committed as `21d42c6`.** Working: sign-in, company and factory registration, a manufacturing profile (processes, capacity, machinery, materials, products with specifications and factory association), **Export Opportunities** with a transparent rules-based Capability-to-Opportunity engine, a product exploration page, and from Sprint 2 a **landed-cost calculator with scenario comparison**, an **export feasibility workspace** and **first-pass compliance and CEPA screening**. Export documents, the wider roadmap and expert assistance are honest **previews**. UAE demand, tariffs, freight, exchange rates and regulations are **not connected**: calculator starting values are samples, and anything illustrative is labelled. See `docs/post-demo-roadmap.md` for what remains.

## Run the demo

The demo is a synthetic manufacturer (DEMO Sample Polymers: injection moulding and extrusion, PP and HDPE, several machines, containers and storage products). It lives in the development Supabase project under its own account and never touches a real company.

```bash
npm run demo:create    # create it (needs .env.local and .env.test.local)
npm run dev            # then open http://localhost:3000 and sign in
npm run demo:reset     # delete and recreate the demo account and data
npm run demo:destroy   # remove it
npm run demo:status
```

Sign in as `demo.manufacturer@example.com`. The password is random and stored in the git-ignored `.env.demo.local`; it is never printed. The app shows a "Demo scenario" banner whenever you are signed in to it.

## Requirements

- Node.js 20.9 or newer (`.nvmrc` pins 22, the current LTS line)
- npm (bundled with Node)

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open <http://localhost:3000>.

## Checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript, no emit
npm run build       # production build
npm run test:opportunities   # offline tests: matching engine, validation, navigation (no network)
npm run test:landed-cost     # offline tests: landed-cost maths, scenarios, saved assessments, screening content
npm run start       # serve the production build
```

## Layout

```
src/app/                 App Router routes, root layout, design tokens (globals.css)
src/config/navigation.ts Navigation config: `available` items are links, `planned` are not
src/components/layout/   App shell, sidebar nav, mobile nav
src/components/          Page header, section, empty state, status (evidence) badge
src/components/ui/       shadcn/ui primitives (button, sheet, input, label, table)
docs/screenshots/        M1.2 desktop and mobile screenshots
```

## Design

Palette, type and spacing are tokens in `src/app/globals.css` (IBM Plex Sans / Mono, 6px radii). Amber is for non-text accents only; amber text uses a darker token for contrast. Add a shadcn component with `npx shadcn@latest add <name>`.

## Security

See [SECURITY.md](SECURITY.md) for the open `braces` advisory (development-only exposure).

## Secrets

`.env*` files are git-ignored (only `.env.example` may be committed). Never commit keys or service-role credentials.

## Authentication (M1.3C.1)

Supabase Auth with `@supabase/ssr`, driven entirely from the server: forms post to Server Actions and the browser never holds a Supabase key or reads the session cookie (it is `HttpOnly`).

- `src/proxy.ts` refreshes the session on each request and redirects signed-out visitors (optimistic only).
- `src/lib/auth.ts` is the data-access layer: `requireUser()` asks the Auth server to validate the user and is called by the layout, every protected page and every protected action.
- `/login`, `/signup`, `/auth/confirm` (email link handler), `/auth/session-expired` (clears a stale session).

Environment, in two git-ignored files (see `.env.example`):
- `.env.local` (the app): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, optional `SITE_URL` (required in production).
- `.env.test.local` (tests only): `SUPABASE_SECRET_KEY`, `DB_TESTS_ENABLED`. Next.js does not load it outside `NODE_ENV=test`, so the running app never has the secret key. The test scripts load both files.

### Supabase dashboard settings (set by you)
1. **Authentication > URL Configuration:** Site URL `http://localhost:3000`; add `http://localhost:3000/auth/confirm` to Redirect URLs.
2. **Authentication > Email Templates > Confirm signup (recommended):** link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` so confirmation also works when the email is opened on another device. The default template works only in the browser that signed up.
3. **Keep "Confirm email" ON.**
4. **Email delivery:** the built-in sender is heavily rate limited and only delivers to team members. Configure custom SMTP before inviting real users.
5. Optional: set the minimum password length to 12 to match the application.

### Auth tests
```bash
npm run dev          # terminal 1
npm run test:auth    # terminal 2: end-to-end flows + static credential checks (synthetic users, dev project only)
```

## Company registration (M1.3C.2)

After signing in, a user without a company is sent to `/onboarding` and registers it with two fields: company/trading name (required) and registered legal name (optional). Nothing else is collected yet.

- The Server Action calls the existing `create_organization` database function, which creates the organization and the owner membership atomically, enforces one company per user and serializes concurrent submissions. The app never inserts into `organizations` or `memberships` itself, and never reads a user id, organization id or role from the form.
- `requireOrganization()` (`src/lib/organization.ts`) guards the dashboard on the server. Owners who open `/onboarding` are redirected to the dashboard.
- Errors shown to users are fixed, safe messages; raw database text is never displayed.

```bash
npm run dev                 # terminal 1
npm run test:onboarding     # terminal 2: unit + end-to-end tests (synthetic users, dev project only)
```

Note: a Next.js 16.4.2 development-mode bug breaks `cookies()` when a page re-renders in the same request as a Server Action. `src/lib/supabase/server.ts` therefore reads the session from the request's Cookie header and uses `cookies()` only to write.

### Known limitations (company registration)

- **No-JavaScript form submission in production builds is incomplete.** With Cache Components enabled, a form POST made without JavaScript to a fully dynamic page (`/onboarding`) returns only the streamed part of the document in production, not a complete HTML page, so a validation error would not be shown to a user who has JavaScript disabled. With JavaScript (the supported case) the Server Action runs over `fetch` and works: verified in a real browser against the development server, and the action, validation and database behaviour are covered by end-to-end tests that pass against the production build. Development mode returns a full document. Fixing this properly means changing how the page is rendered, which is deliberately not done here; revisit if no-JS support is ever a requirement.
- **Production-build behaviour of the JavaScript path was not exercised in a real browser** (only the development server was). The production build is covered by HTTP-level end-to-end tests.
- Company name and legal name cannot be edited in the UI yet (the database already lets owners update them).
- An organization archived by an administrator is not specially handled in the UI yet.

## Factory management (M1.3C.3)

Journey: sign up, sign in, register the company, register the first factory, dashboard. A company with no active factory is sent to `/factories/new`; the factory pages never redirect back to the dashboard, so archiving the last factory cannot loop (the list shows an empty state with "Register a factory").

- `/factories` lists active factories (archived ones are hidden; "Show archived" lists them read-only), `/factories/new` adds one, `/factories/[id]/edit` edits or archives one.
- Fields: factory name, address line 1 (and optional line 2), city, state or union territory (36 options), 6-digit PIN code; country is fixed to India by the database.
- Writes use the existing `factories` table and Row Level Security (owner-only). The company comes from the server-validated membership, never from the request; the insert and updates use only the columns granted to the API role; every update is scoped to the company and to active rows. Factories are never deleted: archiving sets `archived_at`, and the name becomes reusable.
- Duplicate active names within a company are rejected by the database's unique index and shown as a field error.

```bash
npm run dev                 # terminal 1
npm run test:factories      # terminal 2: unit + end-to-end tests (synthetic users, dev project only)
```

Notes:
- The server Supabase client opts its fetches out of Next.js per-request memoization. Without that, a Server Action that reads, writes and redirects renders the target page in the same request and sees the pre-write data (it looped the first-factory step in a real browser).
- Known limitations: only company owners can add or change factories (no other role exists yet); factories cannot be un-archived in the UI; capabilities, machinery and product data are not part of this step.
