# Post-demo roadmap

Status after **Demo Sprint 3** (the Effortless Export Copilot), building on Sprint 2 (the Export Feasibility Engine) and Sprint 1 (the Manufacturer Intelligence Workspace). This file tracks every original MVP module so nothing is silently dropped. "Built" means working with real saved records. "Preview" means a real page that honestly describes the step without producing results. "Deferred" means nothing exists yet.

Motto: **make exporting effortless for manufacturers.**

Out of scope for the MVP, unchanged: marketplace and buyer matching, payments, customs filing, official certification, government filings, shipment tracking, EPR filings.

## Where each original module stands

| # | Module | Demo Sprint 1 | Still to build (deferred depth) |
|---|---|---|---|
| 1 | Accounts and company | Built: sign-up, sign-in, company registration, owner/member roles, company isolation | Custom email sender and the real email-confirmation journey; invitations and extra members; staff/admin console; password and session policy review |
| 2 | Factory profile | Built: factories, processes, process-specific and factory-wide capacity, machinery with ratings, materials incl. custom entries | Machine utilisation and shifts; certifications of the factory; photos; multiple units per site |
| 3 | Product catalogue | **Built (Sprints 1 and 3):** products with category, intended use, description, specifications, materials, factory association, claimed HS code (unverified); **catalogue import** from CSV, text, Markdown and PDF text, with review, correction and rejection before saving; all read in the browser by rules, nothing uploaded or stored | Product material composition screens (shares of each material); packaging and carton screens; product certifications UI; Excel (.xlsx) and image import; bulk edit |
| 4 | Capability-to-Opportunity Intelligence | Built: transparent rules engine, 17-product starter catalogue, "Your Products" and "What Else Could You Make?", explanation and gaps | Larger and reviewed catalogue; AI-assisted suggestions with evidence; learning from accepted and rejected suggestions; verified trade data in the score |
| 5 | Product exploration | Built: one page per product with provenance on every section | Real UAE demand and competitor views once data is connected; saved shortlists and notes |
| 6 | UAE market intelligence | Preview only. A clearly labelled illustrative demand placeholder exists | Live UAE import data by product code; supplier-country shares; price benchmarks; trend views; data refresh and source citations |
| 7 | Landed cost and commercial viability | **Built (Sprint 2):** working calculator for products, suggested products and standalone use; scenario comparison; sensitivities; break-even and target-margin prices; saved locally in the browser with JSON export and import | Verified UAE tariffs and duty treatment; live or quoted freight rates; a live, dated exchange-rate source; server-side saved assessments shared across devices and team members; more currencies (USD) and Incoterm modelling; import VAT, financing and importer-margin options; PDF report; comparison across several products |
| 8 | Compliance and qualification | **First pass (Sprint 2):** product-aware screening questions for four plastic product families, every item labelled unverified, with progress you can tick off | Verified rule base from official UAE and GCC sources with passage and retrieval date; product requirement screening that gives answers rather than questions; test and certificate gap list from recorded certificates; expert-reviewed items |
| 9 | CEPA and incentives | **First pass (Sprint 2):** rules-of-origin questions and Indian export schemes to investigate, for four product families. No eligibility or amounts | India–UAE agreement and rules-of-origin engine from verified texts; bill-of-materials origin tracking; Indian export incentive library with current rates; eligibility screening; certificate-of-origin workflow |
| 10 | Export documents | **Built (Sprint 3):** editable commercial invoice and packing list drafts prefilled from company, product and landed-cost data, product-specific documentation checklist, browser print / save as PDF, always labelled DRAFT — REVIEW REQUIRED | Server-saved drafts and numbering; buyer address book; certificate of origin and other forms; document requirements from verified sources; e-signature; nothing is ever filed automatically |
| 11 | Product evidence | Not started (originally a planned module) | Specifications, test reports and certificates with validity; reviewer verification workflow; evidence labels end to end |
| 12 | Export readiness roadmap | **Built (Sprint 3):** personalised, product-specific plan in five phases that reacts to completed work and missing information; status, priority, support (data, assumption, unknown) and blockers per task; next best action; manual progress that is never treated as approval | Server-saved progress and due dates; team assignment; readiness report to download and share; learning which steps matter most from real shipments |
| 13 | Expert assistance | **Built, locally (Sprint 3):** expert brief builder for six topics with context filled in, editable, copy and download, and a hand-kept request lifecycle. **No expert is connected** and nothing is sent by the platform | Expert and laboratory directory; real request delivery with consent; quotes and status tracking; expert-review labels on items; case management |
| 14 | Document upload and AI extraction | **Partly built (Sprint 3):** catalogue extraction by deterministic rules in the browser; AI-assisted reading is **not enabled** (no provider or approval) | Private file storage with access control; certificates, test reports and catalogues stored and linked; an approved AI provider for extraction, always reviewed by a person; scanned-PDF text recognition; production-grade extraction quality |
| 15 | AI assistant layer | Deferred. The engine is structured so AI can add suggestions and evidence without changing the rules | AI model integration; evidence-grounded answers with citations; "AI suggested" review workflow; evaluation set and guardrails |
| 16 | Admin, case management and operations | Deferred | Staff console; reference-data maintenance (processes, materials, catalogue); verification of certificates; audit viewer; support tools |
| 17 | Production hardening | Deferred | Hosting-region and privacy review before real confidential documents; backups and recovery; rate limiting; monitoring and alerting; leak-protected passwords (hosted Auth setting); accessibility audit; performance budget; a production Supabase project separate from development; penetration test |
| 19 | Export Workspace (copilot overview) | **Built (Sprint 3):** one page per product with the next best action, what you have told us, opportunities, commercial feasibility, blockers, roadmap progress, documents and expert requests; progress shown as counts, not a score | Server-saved state; multi-product portfolio view; sharing with advisers |
| 18 | Export feasibility workspace | **Built (Sprint 2):** per-product executive summary, the six questions, manufacturing fit, landed-cost snapshot, market view, gaps, compliance and incentive questions, missing information and next steps; print or save as PDF | Server-side saved assessments; shareable read-only links with consent; comparison across products; expert annotations |

## Data and integrations that are NOT connected today

- Live UAE trade statistics (volumes, values, supplier countries, prices)
- Verified tariff and duty data
- Live freight rates and quotes
- Official UAE and GCC regulation and conformity sources
- India–UAE agreement texts and rules-of-origin tables
- Indian export incentive notifications
- Government portals of any kind (no filings are made)
- Expert, laboratory and freight-partner systems
- Real email delivery (the development email sender is rate limited)
- Private document storage
- A live, dated exchange-rate source (the calculator uses a rate the user types)
- Server-side storage of assessments, task progress, document drafts and expert requests (all live in the user's browser for now)
- Any expert, laboratory or freight partner (briefs are copied or downloaded and shared by the user)
- An AI provider (extraction is rule-based)

## Known limitations of the Sprint 3 copilot

- Everything saved in Sprint 3 (task progress, document details, expert briefs) lives in **this browser only**: not shared across devices, not backed up, cleared if site data is cleared.
- Catalogue extraction is rules-based. It works best on CSV and on text with one product per block and `Key: value` lines. A PDF loses its layout, so results are marked lower confidence. Scanned (image-only) PDFs cannot be read.
- AI-assisted reading is not enabled. It needs an approved provider, a data-processing and hosting decision, and a cost limit.
- Expert requests are briefs saved locally. The platform cannot see whether you sent one or what came back.
- The roadmap marks a task completed from data where data can show it and otherwise from the person's word, and says which. It is never an approval.
- Printing relies on the browser's print dialog and its Save as PDF option.
- The draft documents cover an invoice and a packing list for one product line. Multi-line shipments and other forms are not built.

## Known limitations of the Sprint 2 feasibility engine

- Calculator inputs start from **sample values** that are clearly labelled until edited. None is a market rate or a quote.
- The customs-duty rate is an unverified assumption and the preferential-duty scenario is hypothetical. Eligibility is never determined.
- Import VAT is excluded on the stated assumption that a VAT-registered importer recovers it. This must be confirmed with an adviser.
- Assessments are stored in the browser only: not shared across devices, not backed up, cleared if site data is cleared (JSON export and import mitigate this).
- Screening content is question-based. The official primary sources could not be opened, so the few concrete facts are marked as secondary-source and need primary confirmation.
- Sensitivity analysis moves one variable at a time and does not model correlated changes.

## Known limitations of the Sprint 1 intelligence

- The catalogue is hand-written general knowledge, not checked against official sources and not a market study.
- A suggestion's score covers capability fit only. It does not measure demand, price, tariff or compliance.
- The "illustrative demand signal" is a placeholder, always shown with a Demo label.
- A recognised "your product" match uses keywords in names, categories and descriptions, so unusual names fall back to general guidance.
- Machinery and press sizes are compared only qualitatively (the page asks you to confirm with a toolmaker), because no mould-size data exists.

## Demo Sprint 4 candidates (carried from earlier plans)

1. Server-side saved state for assessments, tasks, document drafts and expert requests.
2. Open the official sources and promote the first screening items to verified.
3. Connect one UAE trade-data source so demand and price levels become evidence.
4. Private storage and the privacy review, then an approved AI provider for catalogue and certificate reading.
5. A real expert or laboratory channel with consent, quotes and status.
6. Multi-line shipments and more document forms.

## Earlier Sprint 3 candidates (now partly delivered)

1. Connect one UAE trade-data source so demand and price levels become evidence, not placeholders.
2. Server-side saved assessments, so work survives a cleared browser and can be shared with advisers.
3. Open the official sources (UAE customs, MoIAT or equivalent, DGFT, the CEPA text) and promote the first screening items to verified.
4. Document checklist and draft commercial invoice and packing list from the assessment data.
5. Certificates and test reports on the existing tables, feeding the screening progress.
6. A live, dated exchange-rate source with the date shown beside every conversion.

## Suggested order for the fastest path to a full journey

1. **Landed cost calculator** with the user's own inputs and clearly labelled assumptions (no live data needed to be useful).
2. **UAE import data connection** (one trade-data source) so the demand placeholder becomes evidence.
3. **Compliance rule base** for the three or four product families most likely to be demonstrated, with official sources and expert review.
4. **Document checklist and drafts** from product and cost data.
5. **Product certifications and evidence screens** on the existing tables.
6. **Private storage and the privacy review**, then AI extraction on uploaded documents.
7. **Expert assistance requests**, then the admin console.
