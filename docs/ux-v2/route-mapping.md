# UX v2 wireframes: mapping to the existing implementation

Prototype: `/ux-preview` (development only, fictional data, no backend). Production routes below are as found in `src/app` on 22 Oct 2026, **including uncommitted audit fixes** in the working tree, which this work preserves and does not touch (the only existing file edited is `src/lib/supabase/proxy.ts`, see "Changes outside the prototype").

Legend: **DB** = saved in Supabase today. **Local** = saved in the browser (localStorage) only. **None** = computed, nothing stored.

## Wireframe → existing implementation

| Wireframe | Proposed screen | Existing route / module | Reuse | Rearrangement or new work |
|---|---|---|---|---|
| W1 | Public homepage | None. `/` is `(app)/page.tsx` (the signed-in overview); signed-out visitors are redirected to `/login` by `src/lib/supabase/proxy.ts`. | Brand tokens, copy from `docs/sprint5-ux.md` | **New** public route plus proxy change to make it public. Needs real marketing copy and review. |
| W2 | Guest sample demo | Closest: the demo company (`scripts/demo-scenario.mjs`, needs login) and `src/lib/opportunities/engine.ts`, `src/lib/landed-cost/calc.ts` | Rules engine and calculator are pure TS and could run with no login | **New** guest runtime with a bundled fictional dataset. The calculator in the prototype is a simplified stand-in (`src/lib/ux-preview/calc.ts`), not the production `calc.ts`. |
| W3 | Account creation, goal choice | `(auth)/signup`, `(onboarding)/onboarding` (company registration), `lib/actions/auth.ts`, `lib/actions/organization.ts` | Auth, company creation | Goal choice (A/B) is **new** and not stored anywhere. Registration today is a separate step that asks for company details first; the wireframe asks for company name only. |
| W4 | Path A: existing products | `(app)/products/new`, `(app)/products/import`, `components/catalogue/import-workspace.tsx`, `lib/catalogue/parse.ts`, `lib/actions/catalogue-import.ts`, `lib/actions/capabilities.ts` (`saveHsClaim`) | Rules-based catalogue reading with review/correct/reject, product records (DB), HS claim | Today a product needs a factory-linked company; the wireframe allows an assessment before factory registration. Needs a "draft product" that is not yet linked to a factory. |
| W5 | Path B: capability discovery | `(app)/factories/new`, `factories/[id]/setup`, `components/factories/*`, `lib/opportunities/engine.ts`, `lib/capacity/*` | Processes, machines, materials, capacity, the matching engine | Today factory registration (name, address, PIN, state) is required before capabilities. The wireframe shows matches after processes/materials only. Needs an engine entry point that works from an unsaved capability set. Plain-language glossary is **new**. |
| W6 | Shared assessment | `(app)/opportunities/[ref]`, `(app)/feasibility/[ref]`, `(app)/viability`, `(app)/compliance`, `(app)/schemes`, `(app)/evidence` | All modules exist and are product-aware | Four separate pages become one overview with expandable sections. `components/feasibility/decision-blockers.tsx` is the closest existing "decision first" panel. |
| W7 | My exports / project | `(app)/workspace`, `workspace/[ref]`, `(app)/roadmap`, `(app)/documentation/[ref]`, `(app)/services`; `components/workspace/*` | Next-best-action engine (`lib/roadmap/engine.ts`), roadmap board, documents, expert briefs | Seven top-level modules fold into six project tabs. Project list and "recent progress" need stored timestamps that do not exist (browser-local state has no activity log). |
| Nav | Home, My factory, Opportunities, My exports | `components/layout/nav-list.tsx`, `config/journey.ts` (12-step journey), `components/journey-bar.tsx` | Journey definition | Replace the long module list with four items; keep the journey as a contextual "where am I" aid. |
| States | Twelve states | See "State coverage" | | |

## Existing routes (inventory)

| Route | Purpose | Storage |
|---|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/confirm` | Account access and recovery | DB (Supabase Auth) |
| `/onboarding` | Create company | DB |
| `/` | Overview (signed in) | DB reads |
| `/factories`, `/factories/new`, `/factories/[id]`, `/factories/[id]/edit`, `/factories/[id]/setup` | Factory, processes, machines, materials, capacity | DB (capacity notes: Local) |
| `/products`, `/products/new`, `/products/import`, `/products/[id]` | Catalogue | DB (import review in browser until saved) |
| `/opportunities`, `/opportunities/[ref]` | Matching, exploration | None (derived) |
| `/viability` | Landed cost | Local |
| `/compliance`, `/schemes` | Screening answers | Local |
| `/evidence` | Market-evidence framework (withheld data) | None |
| `/feasibility`, `/feasibility/[ref]` | Summary | None (derived from Local) |
| `/roadmap`, `/workspace`, `/workspace/[ref]` | Plan and progress | Local |
| `/documentation`, `/documentation/[ref]` | Draft invoice/packing list | Local |
| `/services` | Expert briefs and requests | Local |

## Browser-only versus database-backed

Database-backed: accounts, company, factories, processes, machines, materials, products, claimed HS code, archive state. Browser-only: everything after that (calculator inputs, screening answers, roadmap status and notes, document drafts, expert briefs and requests, capacity notes). See `docs/persistence.md`. The wireframes therefore show a "saved on this device only" warning (state 11) and never claim cross-device saving.

## Where users re-enter the same information today

- Company and factory both ask for names/addresses at different steps.
- Product specs are typed in the catalogue, then again as calculator inputs (price, weight, carton size), then again on invoice/packing drafts (partly prefilled).
- Screening family is chosen by hand when no product is selected (links now carry it when a product is chosen).
- Expert briefs restate product context that already exists.
The wireframes address this with one project record that every tab reads.

## Mandatory information today

Company name; factory name, address line 1, city, state, six-digit PIN (`lib/factory-validation.ts`); at least a process to get matches. The wireframes require only: company name and email at sign-up, a product name (Path A) or one process (Path B).

## State coverage (what exists versus what the prototype only draws)

| State | Production today | Gap |
|---|---|---|
| First-time visitor | Redirected to login | No public page |
| Returning visitor (signed out) | Same | No recognition without an account |
| Empty account | `/` redirects to `/factories/new` | No goal chooser |
| Existing manufacturer with factory data | Overview shows factory | No "recommended next step" tied to a goal |
| Incomplete specifications | Roadmap lists gaps | Not shown as one decision-first message |
| No catalogue | Manual product form exists | Not offered as a first-class path |
| No market evidence | Honest empty state exists in `/evidence` | Needs to appear inside the assessment |
| AI unavailable | `AI not switched on` label (`config/status.ts`) | Present, copy reusable |
| Not commercially attractive | Roadmap ranks "fix the loss" first | Present |
| Incomplete document | `documentStatus` with invalid/inconsistent/review | Present |
| Unsaved browser-only changes | `Saved on this device only` label and backup panel | No unsaved/saved distinction per edit |
| Halfway through onboarding | None (no progress record) | **New**: needs a stored onboarding step |

## Changes outside the prototype

Only one existing file changed: `src/lib/supabase/proxy.ts` adds `/ux-preview` to the public prefixes **only when `NODE_ENV !== "production"`**. In a production build the proxy still redirects `/ux-preview` to `/login`. The route cannot be reached in production. Route group files live entirely under `src/app/ux-preview`, `src/components/ux-preview` and `src/lib/ux-preview`.

## Gaps discovered in the codebase (needed before the final UI)

1. No public marketing route, and the proxy treats every non-auth path as private.
2. No stored "goal" (Path A or B), no stored onboarding progress.
3. Assessment requires a saved product or catalogue id; there is no draft/unsaved subject.
4. Factory registration precedes capability entry; cannot match from unsaved capabilities.
5. Browser-only work has no activity timestamps, so "recent progress" would be invented. A server table (see `docs/persistence.md`) is the clean fix.
6. A guest runtime needs the engines to run with a bundled dataset and no Supabase client.
7. Market evidence has no licensed source; the UI must keep saying so.

## Revision 1 notes

- **AI landed cost (W2 step 5):** the production calculator has no AI step. The AI adapter (`src/lib/ai/*`) is built, validated and off by default; a landed-cost task would need its own prompt, number validation and a source for every rate. Until verified rates exist, the product must label each line as an estimate.
- **HS finder with image (W4):** `src/lib/classification` and `lib/actions/capabilities.ts` (`saveHsClaim`) exist for text; image input is new.
- **Machine photo (W5):** `components/factories/*` and the capability tables take typed machine type and rating only; photo capture, storage and recognition are new.
