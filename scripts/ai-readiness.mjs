// AI readiness check. Makes NO network call and costs nothing. It never prints a secret value.
//
//   npm run ai:readiness
//
// It reads only this project's own .env.local (not your shell, so a key meant for another tool is never
// picked up), and reports what is set, what is missing and which safeguards are in force.

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DEFAULT_MODEL, ENDPOINT, aiStatus } from "../src/lib/ai/provider.ts";

const file = resolve(process.cwd(), ".env.local");
const env = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const rows = [];
const row = (ok, label, detail = "") => rows.push({ ok, label, detail });

const status = aiStatus(env);
row(env.AI_PROVIDER === "anthropic", "AI_PROVIDER=anthropic", env.AI_PROVIDER ? "set" : "not set: you choose the provider on purpose");
row(Boolean(env.ANTHROPIC_API_KEY), "ANTHROPIC_API_KEY", env.ANTHROPIC_API_KEY ? "present (value not shown)" : "not set: a key created for THIS app, in your own provider account");
row(env.AI_DATA_APPROVED === "1", "AI_DATA_APPROVED=1", env.AI_DATA_APPROVED === "1" ? "set" : "not set: confirm only after the data-handling and hosting-region decision");
row(true, `model: ${status.model ?? env.AI_MODEL ?? DEFAULT_MODEL}`, env.AI_MODEL ? "from AI_MODEL" : "default; confirm it is available to your account");
const cap = Number(env.AI_MAX_CALLS_PER_HOUR) || 20;
row(true, `per-user cap: ${Math.max(1, Math.min(200, cap))} calls per hour per server process`, "set AI_MAX_CALLS_PER_HOUR (1 to 200) to change it");

const publicLeak = Object.keys(env).filter((k) => /^NEXT_PUBLIC_.*(ANTHROPIC|AI_|API_KEY|SECRET)/.test(k));
row(publicLeak.length === 0, "no AI or secret variable is exposed to the browser", publicLeak.length ? `REMOVE: ${publicLeak.join(", ")}` : "none prefixed NEXT_PUBLIC_");

let tracked = "";
try {
  tracked = execFileSync("git", ["ls-files", ".env", ".env.local", ".env.test.local", ".env.demo.local"], { encoding: "utf8" }).trim();
} catch {
  /* not a git checkout */
}
row(tracked === "", "no env file is tracked by git", tracked ? `TRACKED: ${tracked}` : "ignored");

console.log("\nAI readiness (no network call was made)\n");
for (const r of rows) console.log(`${r.ok ? "  ok     " : "  NEEDED "} ${r.label}${r.detail ? `  - ${r.detail}` : ""}`);
console.log(`\nEndpoint (fixed, not configurable): ${ENDPOINT}`);
console.log("Safeguards in code: 30 s timeout, 3000 / 900 output-token caps, 40,000-character input cap, per-user hourly cap,");
console.log("per-use consent in the interface, validated output, suggestions are reviewed before saving, nothing is written by AI.");
console.log("Without AI the deterministic import, matching, explanations, calculator, roadmap and documents all still work.\n");
console.log(status.configured ? "AI is READY to be switched on. Nothing has been called. The first real call happens when a user ticks consent.\n" : `AI is OFF. To switch it on, set: ${status.missing.join("; ")}\n`);
