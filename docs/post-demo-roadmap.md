# Post-demo roadmap

Status after **Demo Sprint 1** (the Manufacturer Intelligence Workspace). This file tracks every original MVP module so nothing is silently dropped. "Built" means working with real saved records. "Preview" means a real page that honestly describes the step without producing results. "Deferred" means nothing exists yet.

Motto: **make exporting effortless for manufacturers.**

Out of scope for the MVP, unchanged: marketplace and buyer matching, payments, customs filing, official certification, government filings, shipment tracking, EPR filings.

## Where each original module stands

| # | Module | Demo Sprint 1 | Still to build (deferred depth) |
|---|---|---|---|
| 1 | Accounts and company | Built: sign-up, sign-in, company registration, owner/member roles, company isolation | Custom email sender and the real email-confirmation journey; invitations and extra members; staff/admin console; password and session policy review |
| 2 | Factory profile | Built: factories, processes, process-specific and factory-wide capacity, machinery with ratings, materials incl. custom entries | Machine utilisation and shifts; certifications of the factory; photos; multiple units per site |
| 3 | Product catalogue | Built: products with category, intended use, description, specifications, factory association, claimed HS code (unverified) | Product material composition screens (the table exists); packaging and carton screens (columns exist); product certifications UI (table exists); bulk import |
| 4 | Capability-to-Opportunity Intelligence | Built: transparent rules engine, 17-product starter catalogue, "Your Products" and "What Else Could You Make?", explanation and gaps | Larger and reviewed catalogue; AI-assisted suggestions with evidence; learning from accepted and rejected suggestions; verified trade data in the score |
| 5 | Product exploration | Built: one page per product with provenance on every section | Real UAE demand and competitor views once data is connected; saved shortlists and notes |
| 6 | UAE market intelligence | Preview only. A clearly labelled illustrative demand placeholder exists | Live UAE import data by product code; supplier-country shares; price benchmarks; trend views; data refresh and source citations |
| 7 | Landed cost and commercial viability | Preview: shows the cost structure and what is missing | Calculator with your inputs; verified UAE tariffs and duty treatment; live or quoted freight rates; insurance and port charges; pricing and margin scenarios; saved assumptions |
| 8 | Compliance and qualification | Preview: lists topics to check, marked not assessed | Verified rule base from official UAE and GCC sources with passage and retrieval date; product requirement screening; test and certificate gap list; expert-reviewed items |
| 9 | CEPA and incentives | Preview | India–UAE agreement and rules-of-origin engine from verified texts; bill-of-materials origin tracking; Indian export incentive library; eligibility screening |
| 10 | Export documents | Preview | Document checklist by product and route; commercial invoice and packing list drafts; missing-document tracking; expiry reminders |
| 11 | Product evidence | Not started (originally a planned module) | Specifications, test reports and certificates with validity; reviewer verification workflow; evidence labels end to end |
| 12 | Export readiness roadmap | Preview with real profile progress | Prioritised action plan driven by results from every other step; readiness reports to download and share |
| 13 | Expert assistance | Preview | Expert and laboratory directory; request flow with consent and context attached; quotes and status tracking; expert-review labels on items |
| 14 | Document upload and AI extraction | Deferred | Private file storage with access control; upload of catalogues, test reports and certificates; AI extraction drafts that a person accepts or rejects; production-grade extraction quality |
| 15 | AI assistant layer | Deferred. The engine is structured so AI can add suggestions and evidence without changing the rules | AI model integration; evidence-grounded answers with citations; "AI suggested" review workflow; evaluation set and guardrails |
| 16 | Admin and operations | Deferred | Staff console; reference-data maintenance (processes, materials, catalogue); verification of certificates; audit viewer; support tools |
| 17 | Production hardening | Deferred | Hosting-region and privacy review before real confidential documents; backups and recovery; rate limiting; monitoring and alerting; leak-protected passwords (hosted Auth setting); accessibility audit; performance budget; a production Supabase project separate from development; penetration test |

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

## Known limitations of the Sprint 1 intelligence

- The catalogue is hand-written general knowledge, not checked against official sources and not a market study.
- A suggestion's score covers capability fit only. It does not measure demand, price, tariff or compliance.
- The "illustrative demand signal" is a placeholder, always shown with a Demo label.
- A recognised "your product" match uses keywords in names, categories and descriptions, so unusual names fall back to general guidance.
- Machinery and press sizes are compared only qualitatively (the page asks you to confirm with a toolmaker), because no mould-size data exists.

## Suggested order for the fastest path to a full journey

1. **Landed cost calculator** with the user's own inputs and clearly labelled assumptions (no live data needed to be useful).
2. **UAE import data connection** (one trade-data source) so the demand placeholder becomes evidence.
3. **Compliance rule base** for the three or four product families most likely to be demonstrated, with official sources and expert review.
4. **Document checklist and drafts** from product and cost data.
5. **Product certifications and evidence screens** on the existing tables.
6. **Private storage and the privacy review**, then AI extraction on uploaded documents.
7. **Expert assistance requests**, then the admin console.
