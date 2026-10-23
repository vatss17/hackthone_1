# UX v2 decisions

## Locked for version 1 (from the brief)

1. Public premium homepage, not a sign-in screen. Visitors explore a fictional sample without registering.
2. Signup is requested for personalised results and is always reachable from the header. It is never required to finish the sample.
3. After signup, one choice: **Path A** export products I already make, or **Path B** discover new products from processes, machinery and materials. Both lead to **one shared assessment**. The choice sets the start, not a limit.
4. Returning manufacturers land on their active export projects and the recommended next action, not first-time onboarding.
5. Authenticated navigation has four items: Home, My factory, Opportunities, My exports. Advanced tools appear in context.

## Decisions made while building the wireframes (please confirm or change)

| # | Decision | Why |
|---|---|---|
| D1 | The sample's calculator uses two inputs (price, freight) and labels every other rate a sample placeholder. | Brief asks for two adjustable inputs and no fabricated figures. |
| D2 | Market evidence reads "No evidence connected" everywhere. Never a number. | No licensed source exists (Comtrade licence restricts use). |
| D3 | The assessment answers four questions, shows one next action, and folds five detail sections. | Decision first; detail on request. |
| D4 | Path A needs only a product name to continue. "I don't know" and "Add later" are on every optional field. | No unexpected mandatory input. |
| D5 | Path B shows matches after processes alone. Materials, machines, current products and refinement are skippable. | Value before every field is complete. |
| D6 | "Save to My exports" is a review-then-save step in both paths. | Option to review before saving. |
| D7 | Wireframe states are switched by a reviewer-only list at `/ux-preview/states`, with a strip on each screen to leave the state. | Reviewing twelve situations without twelve builds. |
| D8 | The prototype is reachable only outside production. | Fictional data must never be mistaken for the product. |
| D9 | Six project tabs: Overview, Economics, Requirements, Action plan, Documents, Expert help. | Hides module names; maps to existing modules (see route-mapping). |
| D10 | "No expert connected" and "nothing is filed for you" are stated wherever they apply. | Existing honesty rules carried forward. |

## Open questions for you

1. Sign-up: collect only email and company name first, or also the factory location (needed today for factory records)?
2. Should Path A allow saving a product with no factory at all, creating the factory later? (Needs a data-model change.)
3. Should the guest sample let visitors keep their edited numbers if they then sign up?
4. Is "My exports" the right name for what holds both Path A and Path B projects?
5. Should a returning user ever see the goal choice again, or only a small "start another" menu?
6. How much glossary help should appear inline (current: a one-line plain description per term)?
7. Does the public page need a pricing or "who is behind this" section before launch?

## Future features (documented, NOT built)

All future input methods should end in the same review-and-confirm screen the wireframes use, so nothing a machine reads is saved without a person checking it.

1. **Voice-assisted factory onboarding**, including Indian languages: speak the factory description; produce the same editable review list.
2. **Machine photo / nameplate analysis** to suggest equipment type and size, shown as "our guess, please check".
3. **Multilingual experience**: English first, then Hindi and Gujarati; plain-language glossary translated by people.
4. **AI-assisted HS classification with human confirmation**: candidates with reasons; the person confirms. Never presented as an official ruling.
5. **Server-side saving across devices** (proposed `workspace_documents` table in `docs/persistence.md`); until then every screen says "saved on this device".
6. **Real, licensed trade-data intelligence** replacing the empty market-evidence state.
7. **Expert connectivity and export case management**: real delivery with consent, quotes and status.

## Revision 1 (feedback on the first review)

| # | Change | Notes |
|---|---|---|
| R1 | Homepage shortened from six sections to four, now about 1.5 screens tall on a 1280x800 viewport (reviewer box excluded; 2,636 px on a 375 px phone). The six capability cards became one row of chips, the two journey cards lost their buttons, and trust and the final call to action share one band. | Everything required is still there; nothing was removed except repetition. |
| R2 | Sample step 5 is now "AI works out the landed cost". The manufacturer types only the price they would quote. The AI shows its working (seven steps), then every charge on top (freight, insurance, duty, clearance) with a one-line reason and a confidence label. Any line can be changed, and an override always beats the AI number. | **Simulated.** No AI is called. Freight and duty are labelled low confidence and "must be verified". The sample no longer compares against a made-up UAE selling price; it shows the price needed for a 20% margin and tells the person to check real UAE prices. |
| R3 | The sample's last step lists what the person did (chose a product, typed one price) against what the AI did, so the ease is visible. | |
| R4 | Path A step 3 gains **Find my HS code**: describe the product or give a photo, get up to three codes with reasons and confidence, confirm one (it fills the HS field) or leave it for later. | Simulated rules. Always "you confirm"; never official. |
| R5 | Machine photo recognition is added where machinery is entered, which is **Path B step 3** (machinery is a Path B input, not Path A): photo of the machine or nameplate, review each line, blank where unreadable, then "Add this machine". | Simulated: any photo returns the same fictional machine. |

Open question added: should photo-based HS and machine reading be available in both paths and in My factory, or only where they appear now?
