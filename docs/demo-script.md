# Five-minute demo script

Setup (once, before the audience arrives): `npm run demo:preflight`, `npm run dev`, sign in as `demo.manufacturer@example.com` (password in `.env.demo.local`, never shown). Start on the Overview, which has a Demo guide with these steps linked.

**Be explicit up front (20 s).** "Exporting is hard because nobody starts from what the factory can actually make. We do. Two honest notes before we start: AI is built but **not switched on yet**, so everything you see today is rules and the manufacturer's own data, and says so. And our UAE trade figures are **not cleared for public display**, so that panel shows its source and an empty state. Everything is labelled: what you told us, what a rule worked out, what is an assumption, and what nobody has verified."

| Time | Do | Say |
|---|---|---|
| 0:20 | **Overview**, then **Import catalogue → Load the demo catalogue.** | "Manufacturer understanding starts from a catalogue, CSV or PDF, read in the browser and never uploaded. Today it is read by rules; AI-assisted reading is built and waits for an approved provider. Each suggestion is reviewed: items already in the catalogue are not duplicated, new ones can be edited and saved." |
| 1:00 | **Export Opportunities.** | "From the declared machines, processes and materials: what else this factory could make. Four boxes per product (manufacturing fit, UAE evidence, commercial feasibility, regulatory readiness), never merged into one score." |
| 1:40 | Open an own product (**Plastic containers**). Read **Why the platform is showing you this**. | "Why it is recommended, whether the factory could plausibly make it, and what remains uncertain. UAE evidence says 'Not loaded in this deployment' rather than inventing a number. When AI is on, an optional explanation can sit underneath, validated against these facts." |
| 2:20 | **Evidence** (journey bar step 5). | "Where reported UN Comtrade data will appear, with source, date and limits. It is market evidence, never demand. Not cleared for public display, so empty here." |
| 2:50 | **Landed cost.** Change the selling price, open **Compare scenarios**. | "Sample values are flagged until replaced. Margin, not markup. Scenarios show what moves viability." Edit one input so Feasibility shows an estimate rather than 'not estimated yet'. |
| 3:30 | **Compliance** and **CEPA.** | "First-pass screening questions only. Nothing is verified, nothing is a compliance opinion." |
| 3:50 | **Roadmap.** | "The next best action, with the reason, and what blocks them. No readiness percentage." |
| 4:15 | **Documents.** | "Draft invoice and packing list prefilled from their data. Buyer details and identifiers are never invented. DRAFT on every page." |
| 4:40 | **Expert Assistance.** Pick HS classification. | "The brief arrives with context filled in. No expert is connected yet. They copy it and share it themselves." |

**Close (10 s).** "Rules and the manufacturer's data today; AI and the trade-data licence are the two decisions we need."

**If asked:** "Is the AI live?" Not yet: it needs a provider key, a spending limit and a data-approval switch (see `docs/ai-activation.md`). "Is the trade data live?" No, a dated UN Comtrade snapshot, kept out of the public repository until UN permission is confirmed. "Does it say we comply?" Never.
