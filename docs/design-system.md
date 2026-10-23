# Design system: Portlane, "a modern trade desk"

Brand: **portlane**, descriptor "Export preparation for manufacturers". Working product name only: no domain has been bought and no trademark clearance is claimed.

One foundation: Tailwind v4 tokens in `src/app/globals.css`, shadcn-style primitives in `src/components/ui`, and a few shared components. No dependency was added. IBM Plex Sans (400, 500, 600) is self-hosted by `next/font` at build time.

## Direction
Neutral surfaces do the work. Cobalt is an accent for actions, selection and focus, never a large background. Green exists only for real success states. Nothing is translucent or blurred, shadows exist only on overlays (and the paper sheet of a document preview), and quality comes from type, alignment and hierarchy. The previous teal look (a green brand, a dark rail, tinted cards) was removed everywhere.

## Tokens
| Role | Token | Value |
|---|---|---|
| Application background | `--background` | #F6F7F9 |
| Surfaces | `--card` | #FFFFFF |
| Primary text | `--foreground` | #182230 |
| Secondary text | `--muted-foreground` | #586474 |
| Borders and dividers | `--border` | #DFE4EA |
| Primary action, selection, focus | `--primary`, `--ring` | #3157D5 |
| Primary hover | `--primary-hover` | #2445B3 |
| Subtle selected background | `--selected` (also `--accent`, `--mint`) | #EDF1FC |
| Success | `--success` | #287052 |
| Warning text | `--warning` | #875B1C |
| Error and negative values | `--error`, `--destructive` | #B33D3D |
| Form control border | `--input` | #8590A0 (3.23:1 on white; the divider colour is too light for a control) |
Supporting tints (status label backgrounds): success #E8F3EC, warning #FBF3E2, error #FBECEC, info/inferred #EDF1FC, neutral #EEF1F5.

Measured contrast: text on canvas 14.95:1, secondary on canvas 5.61:1 and on white 6.02:1, cobalt on white 6.08:1, white on cobalt 6.08:1 (8.15:1 on hover), cobalt on selection 5.38:1, success on its tint 5.23:1, warning 5.37:1, error 5.01:1. `tests/ui/design-system.test.mjs` recomputes every pair.

## Type, space, shape
- Body 15px at 1.5. Dense tables 14px. Metadata 12 to 13px. Page heading 28px at 600. Section headings 18 to 20px. Landing headline 52px on desktop and 34px on phones. Sentence case; no uppercase eyebrows (the printed document labels are the one exception).
- Tabular numerals (`.tnum`) for every compared figure: money, quantities, margins, counts.
- Spacing steps 4, 8, 12, 16, 24, 32, 48, 64. Controls 44px on phones and 40px from md. Control radius 6px; panels and dialogs 8px (`rounded-lg`). 1px borders.
- One icon family (lucide) at 18 to 20px in navigation and 12 to 16px inline.

## Brand assets
`public/brand/portlane-logo.svg` (cobalt P, ink wordmark), `portlane-logo-mono.svg`, `portlane-logo-white.svg`, `portlane-symbol.svg`, `portlane-symbol-mono.svg`, and the favicon `src/app/icon.svg`. The symbol is a stem and a squared bowl with a 2px radius on a 24px grid. The wordmark is outlined from IBM Plex Sans Medium (SIL OFL), so it does not depend on a font loading. The React version is `components/layout/brand.tsx` (paths in `components/brand-paths.ts`).

## Components
Button (44/40px; default, outline, secondary, ghost, destructive, link), Input, Label, Table (labelled scroll region, tabular numerals), Sheet (mobile menu), Skeleton and LoadingBlock, Status badge (icon plus text), Notice (icon plus colour), Page header with breadcrumbs, Section, Empty state, Application shell (224px white sidebar in three work stages, 64px top bar), Journey bar (product context, six sections, all twelve steps), Auth shell, Public header, and the landing previews. Dialogs and drawers use the existing Radix Sheet.

## Interaction and motion
Colour changes of 150ms or none. Focus is a 2px opaque cobalt outline with an offset on every control; `scroll-padding` keeps a focused field clear of the sticky header and the phone result bar. Disabled controls change fill and text. Nothing animates on load, no figure counts up, and a global reduced-motion rule shortens every transition.

## Tools and resources actually used
- **Rendered inspection of razorpay.com, shiprocket.in and delhivery.com** (headers, hero composition, one primary CTA, product UI beside the headline). cashfree.com rendered only its header in this browser, so only that was observed. Nothing was copied; no private dashboards were seen.
- **Impeccable**: read for principles and anti-patterns and applied by hand. Its plugin and hooks were not installed (that needs `/plugin` approval and runs third-party hooks).
- **shadcn/ui and Radix**: already the base; Button, Input, Table and Sheet adapted in place.
- **designsystemchecklist.com**: returned no usable content here; the checklist items (tokens, states, accessibility, documentation) were covered from the brief.
- **Not used**: coss, ReUI, Magic UI, Aceternity, motion libraries, AI Elements, Claude Design, and hkokonutui-skills.com (could not be verified as a real source). No second component library was added.
