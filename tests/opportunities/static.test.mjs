// Static checks: no dead-end navigation, every action is owner-gated, nothing here uses the service role.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { navigation } from "../../src/config/navigation.ts";

const root = new URL("../../", import.meta.url).pathname;
const appDir = join(root, "src/app/(app)");

function walk(dir) {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}

describe("navigation", () => {
  it("every available or preview item points at a real page, so there are no dead ends", () => {
    for (const item of navigation.filter((i) => i.status !== "planned")) {
      const file = item.href === "/" ? join(appDir, "page.tsx") : join(appDir, item.href, "page.tsx");
      assert.ok(existsSync(file), `${item.label} (${item.href}) has no page`);
    }
  });
  it("includes the seven journey destinations the product promises", () => {
    const labels = navigation.map((i) => i.label).join(" | ").toLowerCase();
    for (const l of ["Opportunity Studio", "Export Economics", "Compliance Engine", "Benefits Studio", "Document Studio", "Export Readiness Roadmap", "Assistance Hub"]) assert.ok(labels.includes(l.toLowerCase()), l);
  });
  it("preview pages say they are previews", () => {
    for (const item of navigation.filter((i) => i.status === "preview")) {
      const src = readFileSync(join(appDir, item.href, "page.tsx"), "utf8");
      assert.match(src, /FeaturePreview/, item.href);
    }
  });
  it("pages that are no longer previews do not claim to be", () => {
    for (const item of navigation.filter((i) => i.status === "available")) {
      const src = readFileSync(item.href === "/" ? join(appDir, "page.tsx") : join(appDir, item.href, "page.tsx"), "utf8");
      assert.ok(!/FeaturePreview/.test(src), `${item.href} still uses the preview shell`);
    }
  });
});

describe("profile actions", () => {
  const src = readFileSync(join(root, "src/lib/actions/capabilities.ts"), "utf8");
  it("start with the server directive and never use the service role or secret keys", () => {
    assert.ok(src.startsWith('"use server"'));
    assert.ok(!/SUPABASE_SECRET|service_role|SERVICE_ROLE/.test(src));
  });
  it("every exported action checks the owner role before writing", () => {
    const actions = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
    assert.ok(actions.length >= 15, `found ${actions.length}`);
    for (const name of actions) {
      const body = src.slice(src.indexOf(`export async function ${name}(`)).split(/\nexport async function /)[0];
      assert.match(body, /await owner\(/, `${name} does not call owner()`);
    }
  });
  it("takes the company from the session, never from the form", () => {
    assert.ok(!/formData?\.get\(["']organization/i.test(src) && !/fd\.get\(["']organization/i.test(src));
  });
});

describe("secrets and the app", () => {
  it("no page or library under src reads the secret key", () => {
    for (const f of walk(join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
      assert.ok(!/SUPABASE_SECRET_KEY/.test(readFileSync(f, "utf8")), f);
    }
  });
  it("the demo credentials file is git-ignored", () => {
    assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\.env\*/m);
  });
});
