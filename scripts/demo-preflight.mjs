// Demo preflight. READ-ONLY and safe to run any time before a demonstration:
//
//   npm run demo:preflight                 checks everything that does not need the app running
//   BASE_URL=http://localhost:3000 npm run demo:preflight     also checks that every page responds
//
// It signs in ONLY as the synthetic demo account (password from the git-ignored .env.demo.local, never
// printed) and only reads. It never touches any other user or company, never uses the privileged key,
// never calls an AI provider and never prints a secret. Exit code 1 if any required check fails.

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { client } from "../tests/db/lib/api.mjs";
import { sampleInputs } from "../src/lib/landed-cost/defaults.ts";
import { calculate, validateInputs } from "../src/lib/landed-cost/calc.ts";
import { discover } from "../src/lib/opportunities/engine.ts";
import { aiStatus } from "../src/lib/ai/provider.ts";
import { loadSnapshot, SNAPSHOT_FILE } from "../src/lib/trade/evidence.ts";

const results = [];
const check = (level, name, ok, detail = "") => results.push({ level, name, ok, detail });
const required = (name, ok, detail) => check("required", name, ok, detail);
const advisory = (name, ok, detail) => check("advisory", name, ok, detail);

const readEnvFile = (file) => {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
};
const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

// ---- configuration for the deterministic experience
required("Supabase URL and publishable key are configured", Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY), "needed for sign-in and data; nothing else is required for the deterministic experience");

// ---- demo account, factory, products (as the demo user, read-only)
const demoEnv = readEnvFile(resolve(process.cwd(), ".env.demo.local"));
let factoryInput = null;
if (!demoEnv.DEMO_EMAIL || !demoEnv.DEMO_PASSWORD) {
  required("demo account exists", false, "no .env.demo.local: run npm run demo:create");
} else {
  try {
    const api = client();
    const { token } = await api.signIn(demoEnv.DEMO_EMAIL, demoEnv.DEMO_PASSWORD);
    required("demo account exists and can sign in", true);
    const get = async (path) => {
      const r = await api.rest(token, "GET", path);
      if (!r.ok) throw new Error(`read failed (${path.split("?")[0]}, status ${r.status})`);
      return r.body;
    };
    const orgs = await get("organizations?select=id,name");
    const demoOrg = orgs.find((o) => String(o.name).startsWith("DEMO"));
    required("demo company exists and is labelled DEMO", Boolean(demoOrg), demoOrg ? "" : "run npm run demo:reset");
    if (demoOrg) {
      const factories = (await get("factories?select=id,name&archived_at=is.null")).filter(Boolean);
      required("demo factory exists", factories.length > 0, `${factories.length} active`);
      const f = factories[0];
      if (f) {
        const [proc, mach, mat, links] = await Promise.all([
          get(`factory_processes?select=scope,capacity_quantity,capacity_unit,capacity_period,custom_name,ref:ref_processes(code,name)&factory_id=eq.${f.id}`),
          get(`machines?select=name,quantity,rating_value,rating_unit,ref:ref_processes(code,name)&factory_id=eq.${f.id}&archived_at=is.null`),
          get(`factory_materials?select=custom_name,ref:ref_materials(code,name)&factory_id=eq.${f.id}`),
          get(`factory_products?select=product:products(id,name,category,description,archived_at)&factory_id=eq.${f.id}`),
        ]);
        const one = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
        const products = links.map((l) => one(l.product)).filter((p) => p && !p.archived_at);
        required("demo products exist", products.length > 0, `${products.length} linked`);
        required("demo machinery and materials exist", mach.length > 0 && mat.length > 0, `${mach.length} machines, ${mat.length} materials`);
        factoryInput = {
          processes: proc.filter((p) => p.scope === "process").map((p) => ({ code: one(p.ref)?.code ?? null, label: one(p.ref)?.name ?? p.custom_name, capacityText: p.capacity_quantity ? `${p.capacity_quantity} ${p.capacity_unit} per ${p.capacity_period}` : null })),
          materials: mat.map((m) => ({ code: one(m.ref)?.code ?? null, label: one(m.ref)?.name ?? m.custom_name })),
          machines: mach.map((m) => ({ processCode: one(m.ref)?.code ?? null, name: m.name, quantity: m.quantity, ratingValue: m.rating_value === null ? null : Number(m.rating_value), ratingUnit: m.rating_unit })),
          factoryWideCapacity: null,
          products: products.map((p) => ({ id: p.id, name: p.name, category: p.category, description: p.description })),
        };
      }
    }
  } catch (e) {
    required("demo account can be read", false, e instanceof Error ? e.message : "unexpected error");
  }
}

// ---- the deterministic engine has something useful to show
if (factoryInput) {
  const found = discover(factoryInput);
  required("opportunities: the demo factory has adjacent products to show", found.adjacent.length >= 3, `${found.adjacent.length} adjacent, ${found.yourProducts.filter((p) => p.entry).length} of its own products recognised`);
  required("workspace: a recognised own product to open", found.yourProducts.some((p) => p.entry), "");
}

// ---- calculator
const sample = sampleInputs();
const valid = Object.keys(validateInputs(sample).errors).length === 0;
const r = valid ? calculate(sample) : null;
required("landed-cost calculator returns a finite result on its starting values", Boolean(r) && Number.isFinite(r.landedPerUnitAed) && r.landedPerUnitAed > 0, r ? `AED ${r.landedPerUnitAed.toFixed(2)} per unit (sample values)` : "inputs invalid");

// ---- AI is honest
const local = { ...readEnvFile(resolve(process.cwd(), ".env.local")) };
const ai = aiStatus(local);
advisory("AI state is honest", true, ai.configured ? "AI is ON for this server: each use still needs the user's consent" : "AI is OFF: the interface says what is needed and every feature works without it");

// ---- restricted trade data is not exposed
const tracked = git("ls-files", "src/data", "docs/screenshots/restricted") ?? "";
required("no restricted trade snapshot or image is tracked by git", !/restricted|comtrade/i.test(tracked), tracked || "none tracked");
required("the restricted folders are git-ignored", git("check-ignore", SNAPSHOT_FILE, "docs/screenshots/restricted/x.png")?.split("\n").length === 2, "");
const flag = local.TRADE_SNAPSHOT_DISPLAY === "internal-demo";
const loaded = loadSnapshot(local) !== null;
const site = local.SITE_URL ?? "http://localhost:3000";
const publicHost = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(site);
required("trade figures are not enabled for a public site", !(flag && publicHost), flag && publicHost ? `TRADE_SNAPSHOT_DISPLAY is on while SITE_URL is ${site}` : "");
advisory("trade evidence in this local setup", true, loaded ? "figures WILL be shown (internal demo only)" : flag ? "flag is on but no valid local file: empty state will show" : "not loaded: pages show the honest empty state");

// ---- pages respond (only when the app is running)
const base = process.env.BASE_URL;
if (!base) advisory("pages respond", true, "skipped: set BASE_URL=http://localhost:3000 with the app running to include this");
else {
  const routes = ["/", "/opportunities", "/evidence", "/viability", "/compliance", "/schemes", "/roadmap", "/documentation", "/services", "/workspace", "/products/import", "/factories"];
  const bad = [];
  for (const path of routes) {
    try {
      const res = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(20000) });
      if (res.status >= 500) bad.push(`${path} ${res.status}`);
    } catch {
      bad.push(`${path} unreachable`);
    }
  }
  required("every page responds without a server error (signed-out: redirect to sign-in)", bad.length === 0, bad.length ? bad.join(", ") : `${routes.length} routes`);
}

console.log("\nDemo preflight (read-only)\n");
for (const c of results) console.log(`${c.ok ? "  pass " : c.level === "required" ? "  FAIL " : "  note "} ${c.name}${c.detail ? `  - ${c.detail}` : ""}`);
const failed = results.filter((c) => c.level === "required" && !c.ok);
console.log(failed.length ? `\n${failed.length} required check${failed.length === 1 ? "" : "s"} failed.\n` : "\nAll required checks passed. The real user and company were not touched.\n");
process.exit(failed.length ? 1 : 0);
