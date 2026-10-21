# Export Enablement Platform

Working title. An export enablement platform for Indian manufacturers (initial focus: finished plastic products to the UAE).

**Status: M1.2 (design foundation).** The app has a responsive shell (sidebar, header, mobile navigation) and a static Overview page. There is no authentication, database, Supabase or AI integration yet, and no business features. Only Overview is navigable; the other modules are listed as planned and are not links.

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
