# Export Enablement Platform

Working title. An export enablement platform for Indian manufacturers (initial focus: finished plastic products to the UAE).

**Status: M1.3C.1 (authentication; not yet reviewed or committed).** Earlier: M1.2 design foundation, M1.3B database foundation. The app has a responsive shell, real email/password authentication on Supabase Auth, and a static Overview page behind sign-in. There is no onboarding, no business features and no AI integration yet. Only Overview is navigable; the other modules are listed as planned and are not links.

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
