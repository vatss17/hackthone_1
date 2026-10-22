# Sprint 5: premium UX transformation

Not committed until reviewed. Screenshots are in `docs/screenshots/sprint5-*.jpg` (desktop and mobile).

## Design system
- **Palette** (tokens in `src/app/globals.css`): warm off-white `#F7F6F2`, charcoal `#252D2C`, muted teal `#426F67`, pale mint `#DCE7E2` (the one calm highlight: current step and the one next action), border `#E7E5DF`. Contrast checked for body, muted and primary text.
- **Type**: IBM Plex Sans/Mono. Scale: `.t-display` for the one page headline, large medium-weight page titles, quiet small-caps labels, `.t-lead` for supporting text. Headings use tight tracking.
- **Motion**: one gentle fade-up (`.rise`) on the overview, and a width transition on progress bars. Both disabled under reduced-motion.
- **Principles**: one idea per screen, answer first with detail one click away, rows and whitespace instead of nested boxes, provenance shown once per section instead of on every card.

## What changed
| Screen | Before | After |
|---|---|---|
| Overview | Company table, journey list, label glossary, factory list | One headline, one CTA (Explore export potential), links to My factory / products / workspace, one personalised next step, a resume list and top opportunities only when data exists; how-it-works only for new users; label glossary behind a disclosure |
| Navigation | 13 items in two groups | 5 primary items; the rest under "All export tools" (opens automatically when you are inside one) |
| Factory setup | Long profile page with all forms | `/factories/[id]/setup`: five short steps (products, processes and machinery, materials, capacity, review). Existing records are reused; the full profile page and every field remain |
| Capacity | Per-process capacity plus a repeated factory-wide total | Capacity per process, % already committed, optional shifts and hours, derived available capacity with provenance; factory-wide total moved to an Advanced disclosure |
| Opportunities | Large four-box cards for every product | Answer-first rows: name, fit, one reason, one gap, four one-line assessments, one CTA; full assessments and score breakdown one click away |
| Explore | One long page of eight panels | Six steps: product, details, classification (own HSN or "Help me find it"), market evidence as five plain questions, economics, unknowns and next steps |
| Compliance and CEPA | All questions at once | Four priority questions first, a four-part "where you stand", full list under "View all requirements" |
| Roadmap | Four count tiles and every task expanded | Next best action, one progress line, blockers, five collapsible phases with the current one open; status and notes behind "Update" |

## Available capacity
`available process capacity = reported capacity x (1 - utilisation)` (`src/lib/capacity/available.ts`, 12 tests).
- Inputs come only from the manufacturer. Nothing is invented: no cycle times or machine speeds. Shifts and hours are context and are not in the sum.
- Units and periods are never converted. Figures are compared or combined only when unit and period are identical.
- Sequential stages are never added. A factory-wide figure appears only when the manufacturer says the processes are one line (the confirmed bottleneck governs) or separate lines (identical units are added). "Not sure" derives nothing and process-level figures are shown.
- Each number is labelled: reported by you, calculated estimate, or not available.
- **Limitations:** utilisation, layout and the confirmation are saved in this browser only (no database column exists, and no migration was added). The estimate does not yet feed the opportunity score, and the page says so.

## Classification
`src/lib/classification/candidates.ts` suggests up to three 4-digit headings by keyword rules, each with rationale, ambiguity and a confirmation requirement. It is not AI and not a classification. Photographs are shown as unavailable: no vision provider or consent flow exists.
