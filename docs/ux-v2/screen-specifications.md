# UX v2 screen specifications

All screens are wireframes at `/ux-preview/*`. Data is fictional and hard-coded. 'Persisted' describes what the real product would eventually store; the prototype stores only reviewer notes and fictional choices in this browser (localStorage key `ux-preview:v1`). 'Known gaps' lists what the existing codebase lacks.

## Reviewer overview

Route: `/ux-preview`

- **Purpose:** Let a reviewer enter any journey, see the map, collect notes.
- **What the manufacturer sees:** Eight entry cards, a text journey map, collected notes, Clear-all.
- **Inputs:** Notes per screen (typed on each screen).
- **Primary action:** Open a card
- **Secondary actions:** Copy all notes; Clear prototype data
- **What the system shows or calculates:** Nothing calculated.
- **What would eventually be persisted:** Nothing (reviewer tool only).
- **Entry and exit:** Entry: direct. Exit: any card.
- **Known implementation gaps:** Review aid only; not part of the product.

## W1 Public homepage

Route: `/ux-preview/landing`

- **Purpose:** Explain the product in 30 seconds and invite a sample.
- **What the manufacturer sees:** Header (Sample, How it works, Pricing & trust, Sign in, Create account), headline, value statement, product preview placeholder, four steps, two growth journeys, six capabilities, honesty section, final signup call.
- **Inputs:** None.
- **Primary action:** Explore a sample
- **Secondary actions:** How it works; Create account; Sign in; start from products/factory
- **What the system shows or calculates:** Nothing calculated. Preview tiles are static illustrations.
- **What would eventually be persisted:** Nothing. (Possibly a 'seen the sample' cookie, not decided.)
- **Entry and exit:** Entry: public URL. Exit: sample, sign-up, sign-in.
- **Known implementation gaps:** Needs real brand and copy; no testimonials or figures by design. Production needs a public route.

## W2 Guest sample (7 steps)

Route: `/ux-preview/sample`

- **Purpose:** Show the whole value with a fictional factory and no signup.
- **What the manufacturer sees:** Progress bar with seven steps: meet the factory; three possible products; choose one; four lenses (fit, market evidence, commercial assumptions, regulatory unknowns); try the numbers; sample action plan; invitation.
- **Inputs:** Choose one of three products; edit price per unit and freight per container.
- **Primary action:** Next on every step
- **Secondary actions:** Back; Replay; Create my workspace; Back to the homepage
- **What the system shows or calculates:** Landed cost per unit and margin from fixed sample rates (`src/lib/ux-preview/calc.ts`, tested). Shows 'Not connected' for market evidence.
- **What would eventually be persisted:** Nothing. Could persist edited numbers if the visitor signs up (open question).
- **Entry and exit:** Entry: landing. Exit: sign-up or landing.
- **Known implementation gaps:** Needs a guest runtime that runs real engines with a bundled dataset. Prototype maths is a simplified stand-in.

## W3 Account and goal

Route: `/ux-preview/signup`

- **Purpose:** Create the account, then choose where to start.
- **What the manufacturer sees:** Stage 1: company, email, password with inline errors. Stage 2: two cards (A and B) with plain explanations.
- **Inputs:** Company, email, password (not checked); goal A or B.
- **Primary action:** Create account and continue; then Start with my products/factory
- **Secondary actions:** Back; Sign in; Explore the sample
- **What the system shows or calculates:** Email format check only.
- **What would eventually be persisted:** Account, company; goal (A/B) is new and would be stored on the organisation.
- **Entry and exit:** Entry: header/CTAs. Exit: Path A or B.
- **Known implementation gaps:** Goal storage does not exist. Registration today asks for more company detail. Nothing is created in the prototype.

## W4 Path A (6 steps)

Route: `/ux-preview/path-a`

- **Purpose:** Start from a product the manufacturer already makes.
- **What the manufacturer sees:** 1 Add (describe one or upload a catalogue, or no-catalogue variant); 2 review what we read with 'found / our guess / missing' labels; 3 confirm material, use, weight, size, optional HS; 4 first look (four mini answers); 5 add more only if wanted (Add now / Add later); 6 review then save.
- **Inputs:** Name (required), description, material, use, weight, size, HS (all optional after name).
- **Primary action:** Read my product; Next: ...; Save to My exports
- **Secondary actions:** Back; Skip, I'll add these later; I don't know; Add later
- **What the system shows or calculates:** Rule-based reading of the typed text (regex for kg, size, PP/HDPE). Counts open items. A sample catalogue stands in for a file.
- **What would eventually be persisted:** Product (DB), HS claim (DB), open items list (new), progress step (new).
- **Entry and exit:** Entry: sign-up goal A or home. Exit: My exports or assessment.
- **Known implementation gaps:** Real catalogue import exists (`products/import`) but requires an existing product/factory context. AI-unavailable state shows rules-only reading.

## W5 Path B (7 steps)

Route: `/ux-preview/path-b`

- **Purpose:** Discover products from capability.
- **What the manufacturer sees:** 1 Processes with one-line plain descriptions; 2 materials; 3 machines (type and optional size, add/remove); 4 current products (optional); 5 three to five matches; 6 chosen product with why and gaps; 7 optional refinement (tooling, capacity, utilisation).
- **Inputs:** At least one process; everything else optional.
- **Primary action:** Next steps; Show me what fits; Open the assessment
- **Secondary actions:** Back; Skip; Refine with tooling and capacity; Change my processes (empty state)
- **What the system shows or calculates:** Deterministic filter: a product shows when its process is selected, ordered by material matches, top five.
- **What would eventually be persisted:** Factory capability records (DB, existing tables), capacity notes (local today).
- **Entry and exit:** Entry: sign-up goal B or home. Exit: assessment.
- **Known implementation gaps:** Engine today needs a saved factory. Matches are simplified in the prototype. Capacity and utilisation do not yet change scores.

## W6 Shared assessment

Route: `/ux-preview/assessment`

- **Purpose:** One decision-first view for both paths.
- **What the manufacturer sees:** Title, four answer cards (can we make it, UAE market evidence, financial sense, what remains), one next best step, five folded sections: manufacturing rationale, HS candidates, market evidence status, landed cost scenarios (editable), compliance and CEPA.
- **Inputs:** Two calculator inputs; choose a different opportunity.
- **Primary action:** The one next step (changes by state)
- **Secondary actions:** Save to My exports; Choose a different opportunity; expand sections
- **What the system shows or calculates:** Landed cost and margin from sample rates; verdict healthy, thin or loss. The next step is chosen by simple rules: missing details first, then loss, then freight quote.
- **What would eventually be persisted:** Assessment state (today local; future server).
- **Entry and exit:** Entry: both paths, opportunities list, project. Exit: My exports.
- **Known implementation gaps:** Four production pages must be merged. No AI or live data is implied. States: incomplete specs, no market evidence, AI unavailable, not attractive.

## W7a Home

Route: `/ux-preview/app/home`

- **Purpose:** Returning manufacturers see what to do next.
- **What the manufacturer sees:** Recommended next action, two active projects, See all. Variants: empty account (goal chooser), factory only (see opportunities), halfway through onboarding (continue card).
- **Inputs:** None.
- **Primary action:** Do this now / Continue where you left off
- **Secondary actions:** See all
- **What the system shows or calculates:** Chooses the top project's next action.
- **What would eventually be persisted:** Active project list, last activity (new).
- **Entry and exit:** Entry: sign-in. Exit: project or exports.
- **Known implementation gaps:** Production `/` is a different overview; needs an activity record.

## W7b My factory

Route: `/ux-preview/app/factory`

- **Purpose:** Review and change declared capabilities.
- **What the manufacturer sees:** Processes and machines, materials, optional capacity, products made today.
- **Inputs:** None in the prototype.
- **Primary action:** See opportunities for my factory
- **Secondary actions:** Add capacity; Add a product
- **What the system shows or calculates:** Nothing.
- **What would eventually be persisted:** Existing factory tables.
- **Entry and exit:** Entry: nav. Exit: opportunities or Path A/B.
- **Known implementation gaps:** Mirrors production `/factories`.

## W7c Opportunities

Route: `/ux-preview/app/opportunities`

- **Purpose:** Browse products by manufacturing fit.
- **What the manufacturer sees:** Five cards with fit label and reason.
- **Inputs:** None.
- **Primary action:** Assess this
- **Secondary actions:** Back via nav
- **What the system shows or calculates:** Fit labels are static in the prototype.
- **What would eventually be persisted:** Nothing.
- **Entry and exit:** Entry: nav or assessment. Exit: assessment.
- **Known implementation gaps:** Production has search, filter and sort; these are not drawn.

## W7d My exports

Route: `/ux-preview/app/exports`

- **Purpose:** All export projects with next steps.
- **What the manufacturer sees:** Project cards: status, progress bar, next action, still needed, last activity, Continue. Variants: empty account, unsaved browser-only banner.
- **Inputs:** None.
- **Primary action:** Continue
- **Secondary actions:** Add a product; Discover new products; Download a backup (simulated)
- **What the system shows or calculates:** Progress bars are fixed example values.
- **What would eventually be persisted:** Projects, statuses, activity (new).
- **Entry and exit:** Entry: nav, after saving. Exit: project.
- **Known implementation gaps:** Needs server persistence and timestamps.

## W7e Export project

Route: `/ux-preview/app/exports/[id]`

- **Purpose:** Everything for one product without module names.
- **What the manufacturer sees:** Tabs: Overview (next step, still needed, recent progress), Economics (calculator), Requirements (open questions, unverified), Action plan, Documents (draft invoice with missing-field checks), Expert help (no expert connected; brief preparation).
- **Inputs:** Calculator inputs; fill missing document fields (sample).
- **Primary action:** Do this now
- **Secondary actions:** Open the full assessment; Ask an expert; Print draft (disabled until complete)
- **What the system shows or calculates:** Margin; missing-field count for the document.
- **What would eventually be persisted:** Project state, documents, briefs (local today).
- **Entry and exit:** Entry: My exports. Exit: back to My exports or assessment.
- **Known implementation gaps:** Maps to roadmap, documents and services pages; no brief is sent anywhere.

## States

Route: `/ux-preview/states`

- **Purpose:** Review twelve real-world situations.
- **What the manufacturer sees:** Twelve cards; each opens the right screen with the state on and a strip to leave it.
- **Inputs:** None.
- **Primary action:** Open this state
- **Secondary actions:** Back to normal; All states
- **What the system shows or calculates:** Seeds a few fictional values (e.g. a negative-margin product).
- **What would eventually be persisted:** Nothing.
- **Entry and exit:** Entry: overview. Exit: any screen.
- **Known implementation gaps:** Reviewer-only.

## Interaction rules checked on every screen

- One obvious primary action; a Back action on every multi-step screen.
- Progress shown for sample, sign-up, Path A and Path B.
- Optional fields have 'I don't know', 'Add later' or 'Skip'.
- No sign-up wall during the sample; sign-up is in the header throughout.
- Market evidence never shows a number. Compliance items are labelled unverified. No expert is connected.
- Mobile at 375 px has no horizontal scroll (checked on all 13 routes); the four primary items become a bottom bar.

## Revision 1 additions

- **W1 Public homepage:** hero, four steps with a chip row of abilities, two starting points, one band for honesty and sign-up. About 1.5 screens on desktop.
- **W2 Guest sample, step 5 "AI landed cost":** *Inputs:* the quoted price only. *Shows:* a seven-step working list, a per-unit landed cost, a table of every charge with reason and confidence, editable lines, the price needed for a 20% margin, and a warning that estimates are not quotes. *Primary action:* Let AI work out my landed cost. *Persisted eventually:* the estimate and the person's overrides per product. *Gaps:* real rates need verified tariff, freight and exchange sources and a provider decision (see `docs/ai-activation.md`); the production calculator (`src/lib/landed-cost`) takes typed inputs today and has no AI step.
- **W2 Guest sample, step 7:** a "what you did / what the AI did" summary.
- **W4 Path A, step 3 "Find my HS code":** *Inputs:* a description or a photo. *Shows:* up to three HS candidates with reasons and confidence. *Actions:* Use this code (fills the HS field), Leave it for later. *Persisted eventually:* the confirmed claim (existing `saveHsClaim`) plus who confirmed it. *Gaps:* the production classification module (`src/lib/classification`) is rule-based and has no image input; image understanding would need a provider.
- **W5 Path B, step 3 "Photograph the machine":** *Inputs:* a photo. *Shows:* machine type, clamp force, screw diameter, make and model, year, each labelled read from the nameplate, our guess, or could not read. *Actions:* Add this machine, Discard. *Persisted eventually:* a machine record with the source of each value. *Gaps:* no image pipeline or storage exists; the prototype reads nothing from the file.
