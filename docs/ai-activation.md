# Activating AI (safe procedure)

AI is **off** until you do every step. Nothing is sent anywhere before step 5. The deterministic features never use AI.

1. **Decide:** provider (Anthropic is the one built), a small monthly spending limit, and that sending the data below to that provider is acceptable (hosting region and data-processing terms). Use **synthetic demo data only** for the first evaluations.
2. **Create a dedicated key** in your own Anthropic console, for this app only, with a low spend limit. Do not reuse a key from another tool.
3. **Add to `.env.local`** (git-ignored; never commit, never prefix with `NEXT_PUBLIC_`):
   ```
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=<your key>
   AI_DATA_APPROVED=1
   # optional: AI_MODEL=claude-sonnet-5-5   AI_MAX_CALLS_PER_HOUR=20
   ```
4. **Check without a network call:** `npm run ai:readiness`, then restart `npm run dev`.
5. **First live test (a few cents):** sign in as the demo user, open Import, load the demo catalogue, tick the consent box and use AI reading once; then open a product and request one AI explanation. Review the output; nothing is saved without you.
6. **If anything looks wrong:** remove `AI_DATA_APPROVED` (or the key) and restart. AI is off again.

Safeguards in code: fixed endpoint, 30 s timeout, small output caps, 40,000-character input cap, per-user hourly cap, consent on every use, validated output, no database writes by AI, no content or keys in logs. The hourly cap is per server process.
