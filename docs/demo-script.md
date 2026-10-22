# Five-minute demo script

Setup (once, before the audience arrives): `npm run demo:reset`, `npm run dev`, sign in as `demo.manufacturer@example.com` (password in `.env.demo.local`, never shown). Open the app at the Overview.

**Say first (20 s).** "Exporting is hard for a manufacturer because nobody starts from what the factory can actually make. We do. Everything you will see is labelled: what you told us, what a rule worked out, what is reported data, what is an assumption, and what nobody has verified."

| Time | Do | Say |
|---|---|---|
| 0:20 | **Products & Catalogue → Import catalogue → Load the demo catalogue.** Reject one product, edit one intended use, press **Save**. | "A manufacturer uploads a catalogue, CSV or PDF. It is read in the browser and never uploaded. Every suggestion is shown for review: they accept, correct or reject. AI reading is built but switched off until an approved provider is configured, so this is rules, and it says so." |
| 1:00 | **Export Opportunities.** Open the "What Else Could You Make?" section and a card. | "From the machines, processes and materials they declared, the platform finds products the factory could also make. Note the four boxes: manufacturing fit, UAE demand evidence, commercial feasibility, regulatory readiness. We never merge them into one score." |
| 1:40 | On the card, point at **UAE demand evidence**, then click **Explore export potential** on an own product and scroll to **UAE market evidence**. | "This is where reported UN Comtrade data for the product's HS heading appears: what the UAE reported importing, and India's reported exports to the UAE. It is a dated snapshot, not live, and evidence that trade exists, not demand. (On a public deployment this panel shows an honest empty state, because redistribution of the data is not yet authorised.)" |
| 2:20 | In the same page read **Why the platform is showing you this**. | "Why it is recommended, whether the factory could plausibly make it, and what is still uncertain. All from their own data. The optional AI explanation is off here, and when on it can only repeat facts it was given." |
| 2:50 | **Calculate landed cost.** Change the selling price, tick that freight is quoted, open **Compare scenarios**. | "Sample numbers are flagged until the manufacturer replaces them. Margin, not markup. Scenarios show which variable makes this viable." |
| 3:40 | **Export Workspace.** | "One page: the next best action, with the reason, plus what blocks them. No readiness percentage. Counts and named blockers." |
| 4:10 | **Roadmap** then **Export Documents.** Fill the buyer, print the invoice. | "A plan that changes as they complete work. A draft invoice and packing list prefilled from their data. Buyer details and identifiers are never invented. It says DRAFT on every page." |
| 4:40 | **Expert Assistance.** Pick HS classification, save as ready. | "The brief is written for them with context filled in. No expert is connected yet, and the page says so. They copy it and share it themselves." |

**Close (10 s).** "Real data where it exists, rules where it does not, and a clear label on everything else. AI and the trade data licence are the two things we need a decision on."

**If asked:** "Is the AI live?" Not yet: it needs a provider, a key and a data-approval switch. "Is the trade data live?" No, a dated UN Comtrade snapshot, and the data file is kept out of the public repository until UN permission is confirmed. "Does it say we comply?" Never.
