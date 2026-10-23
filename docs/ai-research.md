# AI research answers and the AI logistics estimate

Two features show how the product answers the questions manufacturers normally pay experts for. Both are destination-neutral in the interface: the screens say "destination market", never a country. The MVP's data sets cover one demo destination; another country is another data set with the same shape.

## 1. AI answers for screening questions (`/compliance`, trade-agreement screening)
Every screening question that was marked "Needs expert confirmation" (and the classification questions marked "Inferred") has a **Get AI answer** button, plus **Get AI answers for all** for a section.
- The panel shows a plain-language answer, the points it rests on, what is still to confirm, the sources with links, and a confidence label (high, medium or low).
- **Use as my answer** records it as an answer marked "AI research draft", dated, with the source named. The question counts as resolved, and the label becomes "AI suggested". It is never recorded as verified, and resolved still never means compliant.
- Data: `src/lib/research/answers.ts` (59 answers), researched from public sources on 2026-10-22 and sanitised so no answer names the destination country. Many rest on secondary sources, and the official text was often not opened; the confidence and "still to confirm" lines say so.

## 2. AI logistics estimate (`/viability`, the Logistics and charges section)
**Estimate with AI** plans the shipment from the carton size and weight (which containers, or a shared load), then estimates inland freight, export handling, international freight, insurance, destination clearing and other destination costs.
- Each charge shows low, typical and high, a confidence, how reliable its basis is, how it was estimated, and its sources.
- **Fill the calculator** writes the chosen scenario into the six lines as estimates (never "confirmed") and tags each field "AI estimate" until you change it. It can also suggest the market exchange rate and sets it only if you leave the box ticked.
- Code: `src/lib/logistics/estimate.ts` (deterministic planning and pricing), `src/lib/logistics/reference.ts` (dated reference rates with sources and quality labels), `src/components/landed-cost/ai-logistics.tsx`.
- Honest limits: ocean rates are a volatile, crisis-period snapshot; haulage and the customs agent's fee have no published tariff and are labelled model assumptions; several destination charges rest on 2023 to 2025 quotes.

## What is and is not live
- **Not a live model call.** Nothing here calls an AI provider. The answers and rates were researched ahead of time and are served as data, and the wording says "AI research draft", never "live". The provider adapter (`src/lib/ai`) and its consent, validation and rate limits are the path to generating the same shape live, with retrieval, once a provider and key are approved.
- No paid call, expert contact or filing happens anywhere.

## Extending to another country or lane
Add a research data set (answers keyed by question id) and a logistics reference set (one lane), both with the shapes in `answers.ts` and `reference.ts`, and select them by destination. The screens, the answer panel and the estimator do not change.
