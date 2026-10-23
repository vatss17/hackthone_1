# The approved journey on the real app

The wireframe journey (`/ux-preview`, see `docs/ux-v2/`) now runs on the real app, with the real engines and database. Styling is deliberately plain; the visual design comes next.

## What a person does

| Step | Route | What it is |
|---|---|---|
| Public homepage | `/` (signed out) | The proxy shows `/welcome` at `/`. No sign-in wall. Header always offers Sign in and Create account. |
| Guest sample | `/sample` | Seven-step fictional walkthrough, no account, nothing saved. The AI landed-cost step is **simulated** and labelled so. |
| Sign up, company | `/signup`, `/onboarding` | Unchanged. |
| Choose a start | `/start` | A (products I make) or B (what else could my factory make). Stored as a device cookie `export-goal`, not in the database. |
| Path A | `/start/a` | Describe a product, review what was read, confirm, HS candidates from the platform's rule-based classifier, first look, save. Needs **no factory**. Saves a product (material and size as specifications, optional unverified HS claim) and opens its workspace. |
| Path B | `/start/b` | Processes, materials, machines, current products, then up to five matches from the real opportunity engine on the unsaved answers. Saving asks for the factory's location (a database requirement) and writes the factory, processes, materials and machines, then opens the chosen opportunity. |
| Home | `/` (signed in) | Recommended next step and active export projects. A company with no factory, no product and no goal is sent to `/start` once. |
| My exports | `/workspace`, `/workspace/[ref]` | Project page: next best action, four questions (can we make it, UAE evidence, financial sense, what remains), and tabs Overview, Economics, Requirements, Action plan, Documents, Expert help that open the existing modules for that product. |
| Navigation | sidebar | Four items: Home, My factory, Opportunities, My exports. Other modules are reached in context (project tabs and the journey bar). |

## Real, simulated, not built

- **Real:** accounts, company, factory, products, specifications, HS claim, opportunity matching, the HS candidate rules, the whole workspace behind the tabs.
- **Simulated (guest sample only):** the AI landed-cost estimate with its working steps. No model is called.
- **Not available in the real app:** photo-based HS finding and machine photo recognition (the controls say "not available yet"), AI landed cost, market evidence (no licensed source), cross-device saving, restoring archived products.
- **Device-local:** the chosen goal, calculator inputs, checklist progress, document drafts, expert briefs.

## Known gaps and decisions

- Path B cannot save without the factory's name, address, city, state and PIN (existing database rules). Path A does not need a factory.
- Path A's "what comes next" step lists what the workspace will ask (price, carton, machines); those answers are entered in the workspace, not in the start flow.
- Returning halfway through onboarding is not remembered across sessions (no stored progress yet).
- The wireframes at `/ux-preview` remain, outside production only.
