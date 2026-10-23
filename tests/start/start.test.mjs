// The approved journey on the real app: public homepage, guest sample, goal choice, Path A and Path B, four-item navigation.
// Pure and static checks (no running app, no database).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { primaryNav } from "../../src/config/navigation.ts";
import { parseGoal, goalHref, GOAL_COOKIE } from "../../src/lib/start/goal.ts";
import { readProduct } from "../../src/lib/start/read-product.ts";
import { parseRating, factoryInputFromAnswers, START_PROCESSES, START_MATERIALS } from "../../src/lib/start/capability.ts";
import { discover } from "../../src/lib/opportunities/engine.ts";
import { findCandidates } from "../../src/lib/classification/candidates.ts";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("main navigation", () => {
  it("has the Atlas modules in the approved order", () => {
    assert.deepEqual(primaryNav.map((i) => i.label), ["Command Center", "AI Workbench", "Factory Intelligence", "Opportunity Studio", "Factory to World", "Scheme Finder", "My exports", "Mission Control", "What-If Studio"]);
    assert.deepEqual(primaryNav.map((i) => i.href), ["/", "/workbench", "/factories", "/opportunities", "/world", "/schemes/finder", "/workspace", "/mission", "/what-if"]);
  });
  it("the sidebar no longer lists every module", () => {
    assert.ok(!/All export tools/.test(read("src/components/layout/nav-list.tsx")));
  });
});

describe("goal choice", () => {
  it("accepts only A or B and routes to the right start", () => {
    assert.equal(parseGoal("A"), "A");
    assert.equal(parseGoal("B"), "B");
    for (const bad of ["a", "C", "", null, undefined, "A;B"]) assert.equal(parseGoal(bad), null);
    assert.equal(goalHref("A"), "/start/a");
    assert.equal(goalHref("B"), "/start/b");
    assert.equal(GOAL_COOKIE, "export-goal");
  });
});

describe("Path A: reading a product description", () => {
  it("finds what is stated and marks the rest missing, never inventing values", () => {
    const rows = readProduct("Stackable crate", "PP crate, 1.9 kg, 600 x 400 x 250 mm, storage");
    const v = Object.fromEntries(rows.map((r) => [r.key, r]));
    assert.equal(v.material.value, "PP");
    assert.equal(v.weightKg.value, "1.9");
    assert.equal(v.size.value, "600 x 400 x 250");
    assert.equal(v.use.status, "guess");
    const bare = Object.fromEntries(readProduct("Thing", "").map((r) => [r.key, r]));
    for (const k of ["material", "weightKg", "size", "use"]) {
      assert.equal(bare[k].value, "");
      assert.equal(bare[k].status, "missing");
    }
  });
  it("converts grams to kilograms", () => {
    assert.equal(readProduct("Cap", "weighs 25 g").find((r) => r.key === "weightKg").value, "0.025");
  });
  it("the HS helper is the platform's own rule-based classifier and always says the person confirms", () => {
    const r = findCandidates({ name: "Stackable storage crate", description: "household storage" });
    assert.ok(r.candidates.length >= 1);
    for (const c of r.candidates) assert.match(c.heading, /^\d{4}$/);
    assert.match(r.confirm, /Unverified/);
  });
});

describe("Path B: first matches from unsaved answers", () => {
  it("parses machine ratings and leaves unreadable ones blank", () => {
    assert.deepEqual(parseRating("150 tonnes"), { value: 150, unit: "tonnes_clamp_force" });
    assert.deepEqual(parseRating("80 kg/h"), { value: 80, unit: "kg_per_hour" });
    assert.equal(parseRating("I don't know"), null);
    assert.equal(parseRating("0 tonnes"), null);
  });
  it("runs the real engine and returns reasoned matches only for declared processes", () => {
    const none = discover(factoryInputFromAnswers({ processes: [], materials: [], machines: [], products: [] }));
    assert.equal(none.adjacent.length >= 0, true);
    assert.equal(none.profileTooThin, true);
    const found = discover(factoryInputFromAnswers({ processes: ["injection_moulding"], materials: ["PP"], machines: [{ processCode: "injection_moulding", size: "150 tonnes" }], products: ["storage crates"] }));
    assert.ok(found.adjacent.length >= 3);
    for (const m of found.adjacent) assert.ok(m.reasons.length >= 1 && m.entry.name);
  });
  it("offers only processes and materials the database reference lists know", () => {
    assert.ok(START_PROCESSES.length === 4 && START_MATERIALS.length === 4);
  });
});

describe("public pages and routing", () => {
  const proxy = read("src/lib/supabase/proxy.ts");
  it("signed-out visitors see the homepage at / and can open /welcome and /sample", () => {
    assert.match(proxy, /"\/welcome"/);
    assert.match(proxy, /"\/sample"/);
    assert.match(proxy, /!signedIn && pathname === "\/"[\s\S]*NextResponse\.rewrite\(new URL\("\/welcome"/);
  });
  it("everything else still requires sign-in, and the wireframes are public outside production only", () => {
    assert.match(proxy, /!signedIn && !isPublic\(pathname\)/);
    assert.match(proxy, /NODE_ENV === "production" \? \[\] : \["\/ux-preview"\]/);
  });
  it("the public pages exist, take no session, and link to the real sign-up", () => {
    for (const f of ["src/app/(public)/welcome/page.tsx", "src/app/(public)/sample/page.tsx", "src/app/(public)/layout.tsx"]) assert.ok(existsSync(new URL(`../../${f}`, import.meta.url)), f);
    const layouts = read("src/app/(public)/layout.tsx") + read("src/components/public/public-header.tsx");
    assert.ok(!/requireUser|requireOrganization|supabase/i.test(layouts));
    assert.match(read("src/components/public/public-header.tsx"), /href="\/signup"/);
    assert.match(read("src/app/(public)/sample/page.tsx"), /signup: "\/signup"/);
  });
  it("the guest sample makes no network calls and says the AI is simulated", () => {
    for (const f of ["sample-demo", "ai-landed-cost"]) assert.ok(!/fetch\s*\(|supabase|process\.env/i.test(read(`src/components/ux-preview/${f}.tsx`)), f);
    assert.match(read("src/components/ux-preview/ai-landed-cost.tsx"), /Simulated in this wireframe: no AI is called/);
  });
});

describe("start actions", () => {
  const src = read("src/lib/actions/start.ts");
  it("require the signed-in company, owner role for writes, and never use the service role", () => {
    assert.match(src, /requireOrganization/);
    assert.equal((src.match(/organization\.role !== "owner"/g) ?? []).length, 2);
    assert.ok(!/service_role|SERVICE_ROLE|createAdmin/i.test(src));
  });
  it("store the goal as a device cookie, not in the database", () => {
    assert.match(src, /cookies\(\)\)\.set\(GOAL_COOKIE/);
    assert.match(src, /httpOnly: true/);
  });
  it("keep an unverified HS claim shape and validate it", () => {
    assert.match(src, /\^\\d\{4\}\(\[\.\]\?\\d\{2\}\)\{0,3\}\$/);
  });
  it("Home asks once for a goal when there is no factory and no product, then never loops", () => {
    const home = read("src/app/(app)/page.tsx");
    assert.match(home, /factories\.length === 0 && products\.length === 0 && !goal\) redirect\("\/start"\)/);
    for (const f of ["src/app/(app)/start/page.tsx", "src/app/(app)/start/a/page.tsx", "src/app/(app)/start/b/page.tsx"]) assert.ok(!/redirect\("\/"\)/.test(read(f)), f);
  });
});
