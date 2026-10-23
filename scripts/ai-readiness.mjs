// AI readiness check. Makes NO network call and costs nothing. It never prints a secret value.
//
//   npm run ai:readiness
//
// Optional, only when you ask for it (neither sends any manufacturer data or generates text, so neither is billed):
//   npm run ai:readiness -- --check-provider   asks the provider whether the key and model are accepted
//   npm run ai:readiness -- --list-models      (Gemini) lists the models this key can use for text generation
//
// It reads only this project's own .env.local (not your shell, so a key meant for another tool is never
// picked up), and reports what is set, what is missing and which safeguards are in force.

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { DEFAULT_MODEL, DEFAULT_GEMINI_MODEL, ENDPOINT, GEMINI_ENDPOINT_BASE, aiStatus, classifyHttp } from "../src/lib/ai/provider.ts";

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
const chosen = ["anthropic", "gemini", "openrouter"].includes(env.AI_PROVIDER) ? env.AI_PROVIDER : null;
const keyVar = chosen === "gemini" ? "GEMINI_API_KEY" : chosen === "openrouter" ? "OPENROUTER_API_KEY" : "ANTHROPIC_API_KEY";
row(chosen !== null, "AI_PROVIDER=anthropic, gemini or openrouter", chosen ? `set to ${chosen}` : "not set: you choose the provider on purpose");
row(Boolean(env[keyVar]), chosen ? keyVar : "ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENROUTER_API_KEY", env[keyVar] ? "present (value not shown)" : "not set: a key created for THIS app, in your own provider account");
row(env.AI_DATA_APPROVED === "1", "AI_DATA_APPROVED=1", env.AI_DATA_APPROVED === "1" ? "set" : "not set: confirm only after the data-handling and hosting-region decision");
row(true, `model: ${status.model ?? env.AI_MODEL ?? (chosen === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_MODEL)}`, env.AI_MODEL ? "from AI_MODEL" : "default; confirm it is available to your account");
const cap = Number(env.AI_MAX_CALLS_PER_HOUR) || 20;
row(true, `per-user cap: ${Math.max(1, Math.min(200, cap))} calls per hour per server process`, "set AI_MAX_CALLS_PER_HOUR (1 to 200) to change it");

const publicLeak = Object.keys(env).filter((k) => /^NEXT_PUBLIC_.*(ANTHROPIC|GEMINI|AI_|API_KEY|SECRET)/.test(k));
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
console.log(`\nEndpoints (fixed, not configurable): ${ENDPOINT} or ${GEMINI_ENDPOINT_BASE}/<model>:generateContent`);
console.log("Safeguards in code: 30 s timeout, 3000 / 900 output-token caps, 40,000-character input cap, per-user hourly cap,");
console.log("per-use consent in the interface, validated output, suggestions are reviewed before saving, nothing is written by AI.");
console.log("Without AI the deterministic import, matching, explanations, calculator, roadmap and documents all still work.\n");
console.log(status.configured ? "AI is READY to be switched on. Nothing has been called. The first real call happens when a user ticks consent.\n" : `AI is OFF. To switch it on, set: ${status.missing.join("; ")}\n`);

const wantCheck = process.argv.includes("--check-provider");
const wantList = process.argv.includes("--list-models");
if ((wantCheck || wantList) && chosen === "gemini" && env.GEMINI_API_KEY) {
  const headers = { "x-goog-api-key": env.GEMINI_API_KEY };
  const model = status.model ?? env.AI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const say = (r, ok) => console.log(ok ? `  ok      ${r}` : `  FAILED  ${r}`);
  const call = async (url) => {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      let body = null;
      try {
        body = await res.json();
      } catch {}
      return { res, body };
    } catch (e) {
      return { res: null, body: null, err: e?.name ?? "error" };
    }
  };
  console.log("Provider check (no manufacturer data sent, nothing generated):");
  if (wantCheck) {
    // The model metadata can look fine for a model that can no longer generate, so the real test is countTokens: it goes through
    // the same model routing as generation, never generates text and is not billed.
    const meta = await call(`${GEMINI_ENDPOINT_BASE}/${model}`);
    if (!meta.res) say(`could not reach Google (${meta.err})`, false);
    else if (!meta.res.ok) {
      const e = classifyHttp(meta.res.status, meta.body);
      say(`${e.code} (http ${e.detail.http}${e.detail.status ? `, ${e.detail.status}` : ""}${e.detail.reason ? `, ${e.detail.reason}` : ""}): ${e.message}`, false);
    } else {
      say(`the key is accepted and model "${model}" is listed${meta.body?.supportedGenerationMethods?.includes("generateContent") ? " as supporting text generation" : " but NOT as supporting text generation"}`, true);
      try {
        const res = await fetch(`${GEMINI_ENDPOINT_BASE}/${model}:countTokens`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hello" }] }] }), signal: AbortSignal.timeout(20000) });
        let body = null;
        try {
          body = await res.json();
        } catch {}
        if (res.ok) say(`model "${model}" is usable (a 1-word test was counted, nothing generated)`, true);
        else {
          const e = classifyHttp(res.status, body);
          say(`model "${model}" is listed but cannot be used: ${e.code} (http ${e.detail.http}${e.detail.status ? `, ${e.detail.status}` : ""}). Google may have retired it for newer keys. Pick another with --list-models and set AI_MODEL.`, false);
        }
      } catch (e) {
        say(`could not reach Google (${e?.name ?? "error"})`, false);
      }
    }
  }
  if (wantList) {
    const { res, body } = await call(`${GEMINI_ENDPOINT_BASE}?pageSize=200`);
    if (res?.ok) {
      const names = (body?.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, "")).filter((n) => /^[A-Za-z0-9._-]+$/.test(n));
      console.log(`  ${names.length} models are listed as able to generate text. A listed model can still be retired for your key: confirm with --check-provider after setting AI_MODEL. Examples:`);
      for (const n of names.filter((x) => /gemini/.test(x)).slice(0, 25)) console.log(`    ${n}`);
    } else if (res) {
      const e = classifyHttp(res.status, body);
      say(`${e.code} (http ${e.detail.http}): ${e.message}`, false);
    } else say("could not reach Google", false);
  }
  console.log("");
} else if (wantCheck || wantList) {
  console.log("Provider check is available for Gemini only, and needs AI_PROVIDER=gemini and GEMINI_API_KEY set.\n");
}
