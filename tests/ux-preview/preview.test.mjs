import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sampleCalc, DEFAULT_CALC } from "../../src/lib/ux-preview/calc.ts";
import { OPPORTUNITIES, SCENARIOS, PROJECTS } from "../../src/lib/ux-preview/data.ts";

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const PREVIEW = [...files("src/app/ux-preview"), ...files("src/components/ux-preview"), ...files("src/lib/ux-preview")];

test("calculator: default sample is deterministic and workable", () => {
  const a = sampleCalc(DEFAULT_CALC);
  const b = sampleCalc(DEFAULT_CALC);
  assert.deepEqual(a, b);
  assert.equal(a.ok, true);
  assert.equal(a.landedAed, 8.4);
  assert.equal(a.verdict, "healthy");
});

test("calculator: raising price lowers the margin; extreme price loses money", () => {
  const base = sampleCalc(DEFAULT_CALC);
  assert.ok(sampleCalc({ ...DEFAULT_CALC, price: 160 }).marginAed < base.marginAed);
  assert.equal(sampleCalc({ ...DEFAULT_CALC, price: 400 }).verdict, "loss");
});

test("calculator: rejects bad input with a plain message and never NaN output", () => {
  for (const bad of [{ price: 0 }, { price: -1 }, { price: NaN }, { freight: -5 }, { reference: 0 }]) {
    const r = sampleCalc({ ...DEFAULT_CALC, ...bad });
    assert.equal(r.ok, false);
    assert.ok(r.problem && r.problem.length > 5);
    assert.equal(r.landedAed, 0);
  }
});

test("every opportunity has a rationale, unknowns and an HS candidate, and a workable-or-not sample", () => {
  assert.ok(OPPORTUNITIES.length >= 5);
  for (const o of OPPORTUNITIES) {
    assert.ok(o.why && o.unknowns.length && o.hsCandidates.length, o.id);
    assert.equal(sampleCalc(o.defaultCalc).ok, true, o.id);
  }
});

test("the twelve required states exist and point at prototype routes", () => {
  assert.equal(SCENARIOS.length, 12);
  for (const s of SCENARIOS) assert.match(s.where, /^\/ux-preview/);
  assert.ok(PROJECTS.length >= 3);
});

test("isolation: no Supabase, AI, network, environment or Comtrade access in the prototype", () => {
  const banned = [/supabase/i, /gemini|openrouter|anthropic/i, /\bfetch\s*\(/, /process\.env/, /comtrade/i, /server-only|"use server"/, /XMLHttpRequest|sendBeacon|WebSocket/];
  for (const f of PREVIEW) {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const re of banned) assert.ok(!re.test(src), `${f} matches ${re}`);
  }
});

test("isolation: only the proxy was touched, and only to expose /ux-preview outside production", () => {
  const proxy = readFileSync("src/lib/supabase/proxy.ts", "utf8");
  assert.match(proxy, /NODE_ENV === "production" \? \[\] : \["\/ux-preview"\]/);
});

test("the wireframe is labelled and unindexed", () => {
  const layout = readFileSync("src/app/ux-preview/layout.tsx", "utf8");
  assert.match(layout, /WIREFRAME, NOT THE PRODUCT/);
  assert.match(layout, /index: false/);
});

test("no invented performance claims, customers or testimonials on the homepage", () => {
  const src = readFileSync("src/components/ux-preview/landing.tsx", "utf8");
  assert.ok(!/testimonial|trusted by|\d+\s*\+?\s*(customers|manufacturers|exporters)|\d+%\s*(faster|cheaper)/i.test(src));
});

test("market evidence is never shown with numbers", () => {
  const src = readFileSync("src/components/ux-preview/assessment.tsx", "utf8");
  assert.match(src, /No evidence connected/);
  assert.match(src, /We never show demand we cannot source/);
});

import { suggestHs, recogniseMachine, aiLandedEstimate, totalWithOverrides, PHOTO_TEXT } from "../../src/lib/ux-preview/ai-sim.ts";

test("simulated HS finder: deterministic, reasoned, never certain, empty input gives nothing", () => {
  assert.deepEqual(suggestHs("   "), []);
  assert.equal(suggestHs("HDPE pipe 32 mm")[0].code, "3917");
  assert.equal(suggestHs(PHOTO_TEXT)[0].code, "3924");
  assert.deepEqual(suggestHs("stackable crate"), suggestHs("stackable crate"));
  for (const s of [...suggestHs("water bottle"), ...suggestHs("zzzz qqq")]) {
    assert.ok(s.why.length > 10 && /^\d{4}$/.test(s.code));
  }
  assert.equal(suggestHs("zzzz qqq")[0].confidence, "Low");
});

test("simulated machine reading: unreadable fields stay blank and are labelled", () => {
  const m = recogniseMachine();
  const blank = m.fields.filter((f) => f.value === "");
  assert.ok(blank.length >= 1);
  for (const f of blank) assert.equal(f.status, "Could not read");
  assert.ok(m.fields.some((f) => f.status === "Our guess, please check"));
});

test("AI landed cost: every line explained, total matches the calculator, override wins", () => {
  const e = aiLandedEstimate(140, "laundry");
  assert.equal(e.ok, true);
  assert.equal(e.lines.length, 5);
  for (const l of e.lines) assert.ok(l.how.length > 10 && ["High", "Medium", "Low"].includes(l.confidence));
  assert.equal(totalWithOverrides(e.lines, {}), sampleCalc({ price: 140, freight: 180000, reference: 10.5 }).landedAed);
  const lowered = totalWithOverrides(e.lines, { "Sea freight share": 0.5 });
  assert.ok(lowered < totalWithOverrides(e.lines, {}));
  assert.ok(e.priceFor20 > totalWithOverrides(e.lines, {}));
});

test("AI landed cost: bad price gives a message, no lines, and freight/duty are not flagged High confidence", () => {
  for (const p of [0, -3, NaN]) {
    const e = aiLandedEstimate(p, "laundry");
    assert.equal(e.ok, false);
    assert.equal(e.lines.length, 0);
  }
  const lines = aiLandedEstimate(140, "laundry").lines;
  for (const l of lines.filter((x) => /freight|duty/i.test(x.label))) assert.equal(l.confidence, "Low");
});

test("the AI features are labelled as simulated and require confirmation", () => {
  for (const f of ["ai-landed-cost", "hs-finder", "machine-photo"]) {
    const src = readFileSync(`src/components/ux-preview/${f}.tsx`, "utf8");
    assert.ok(/[Ss]imulated|Wireframe: any photo/.test(src), f);
  }
  assert.match(readFileSync("src/components/ux-preview/hs-finder.tsx", "utf8"), /You confirm the code/);
});
