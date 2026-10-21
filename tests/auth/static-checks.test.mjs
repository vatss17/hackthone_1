// Static checks that need no running server and no network.
// - the privileged key and any Supabase client never reach browser code
// - the application never reads the secret key
// - built browser bundles contain neither key (run after `npm run build`)
// Values are compared in memory and never printed.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const sourceFiles = walk("src").filter((f) => /\.(ts|tsx)$/.test(f));
const read = (f) => readFileSync(f, "utf8");

describe("credential isolation (static)", () => {
  it("application source never references the secret / service-role key", () => {
    const hits = sourceFiles.filter((f) => /SUPABASE_SECRET_KEY|service_role|sb_secret_/i.test(read(f)));
    assert.deepEqual(hits, []);
  });

  it("no NEXT_PUBLIC_ Supabase variable is used: no Supabase key is sent to the browser", () => {
    const hits = sourceFiles.filter((f) => /NEXT_PUBLIC_SUPABASE/.test(read(f)));
    assert.deepEqual(hits, []);
  });

  it("only src/lib/supabase reads the Supabase environment variables", () => {
    const hits = sourceFiles
      .filter((f) => /process\.env\.SUPABASE_/.test(read(f)))
      .filter((f) => !f.startsWith(join("src", "lib", "supabase")));
    assert.deepEqual(hits, []);
  });

  it("no Client Component imports Supabase", () => {
    const hits = sourceFiles
      .filter((f) => /^\s*["']use client["']/m.test(read(f).slice(0, 200)))
      .filter((f) => /@supabase\//.test(read(f)) || /lib\/supabase/.test(read(f)));
    assert.deepEqual(hits, []);
  });

  it("server-only modules are marked server-only", () => {
    for (const f of ["src/lib/supabase/server.ts", "src/lib/supabase/config.ts", "src/lib/auth.ts"]) {
      assert.match(read(f), /import "server-only"/, f);
    }
  });

  it("built browser bundles contain neither the publishable nor the secret key value", (t) => {
    const dir = join(".next", "static");
    if (!existsSync(dir)) return t.skip("no build output: run `npm run build` first");
    const secrets = [process.env.SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_SECRET_KEY].filter(Boolean);
    if (secrets.length === 0) return t.skip("keys not in the environment: cannot compare");
    const files = walk(dir).filter((f) => /\.(js|css|html|json|map)$/.test(f));
    assert.ok(files.length > 0, "no files scanned");
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      for (const s of secrets) assert.ok(!body.includes(s), `a key value appears in a browser bundle: ${f}`);
    }
    t.diagnostic(`${files.length} browser bundle files scanned`);
  });
});

describe("authorization and hygiene (static)", () => {
  it("every page and route handler in the authenticated area verifies the user on the server", () => {
    const protectedFiles = sourceFiles.filter((f) => f.includes(join("src", "app", "(app)")) && /(page|layout|route)\.tsx?$/.test(f));
    assert.ok(protectedFiles.length >= 2, "expected the (app) layout and page");
    for (const f of protectedFiles) assert.match(read(f), /requireUser\(|requireOrganization\(/, `${f} does not verify the user on the server`);
  });

  it("Server Actions that act on a session do not trust the client", () => {
    const actions = read("src/lib/actions/auth.ts");
    assert.match(actions, /^"use server"/m);
    // No role, organization or user id is ever read from submitted form data.
    for (const forbidden of ["role", "organization", "platform", "user_id", "userId"]) {
      assert.ok(!new RegExp(`formData\\.get\\(["']${forbidden}`, "i").test(actions), `action reads ${forbidden} from the form`);
    }
  });

  it("signup sends no user metadata and no role", () => {
    const actions = read("src/lib/actions/auth.ts");
    const signUpCall = actions.slice(actions.indexOf("auth.signUp("), actions.indexOf("auth.signUp(") + 300);
    assert.ok(!/data\s*:/.test(signUpCall), "signUp passes options.data (user metadata)");
  });

  it("no client-readable session: cookies are forced HttpOnly in both places that set them", () => {
    for (const f of ["src/lib/supabase/config.ts", "src/lib/supabase/proxy.ts"]) assert.match(read(f), /httpOnly:\s*true/, f);
  });

  it("environment files with secrets are git-ignored and untracked; only .env.example is tracked", () => {
    for (const f of [".env.local", ".env.test.local"]) {
      execFileSync("git", ["check-ignore", "-q", f]); // throws if NOT ignored
    }
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => /^\.env/.test(f));
    assert.deepEqual(tracked, [".env.example"]);
  });

  it("the running app's env file holds no test-only secret", () => {
    if (!existsSync(".env.local")) return;
    const names = read(".env.local").split("\n").map((l) => l.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=/)?.[1]).filter(Boolean);
    assert.deepEqual(names.filter((n) => /SECRET|SERVICE_ROLE|DB_TESTS/.test(n)), []);
  });

  it("tests, docs and source contain only synthetic email addresses (example.com / example.test)", () => {
    const files = [...walk("tests"), ...walk("docs").filter((f) => /\.(md|mjs)$/.test(f)), ...sourceFiles, "README.md", ".env.example"];
    const offenders = [];
    for (const f of files) {
      for (const m of read(f).matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)) {
        const domain = m[1].toLowerCase();
        if (!/^(example\.(com|test|org)|noreply\.example\.com)$/.test(domain) && !m[0].startsWith("noreply@anthropic.com"))
          offenders.push(`${f}: ${m[0]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("built server bundles do not contain the secret key value either", (t) => {
    const dir = join(".next", "server");
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!existsSync(dir) || !secret) return t.skip("no build output or no secret in the environment");
    const files = walk(dir).filter((f) => /\.(js|json|html|rsc|body)$/.test(f));
    for (const f of files) assert.ok(!readFileSync(f, "utf8").includes(secret), `secret key value found in ${f}`);
    t.diagnostic(`${files.length} server build files scanned`);
  });
});

describe("company registration (static)", () => {
  it("the application never writes organizations or memberships directly; only the RPC creates them", () => {
    const hits = sourceFiles.filter((f) =>
      /from\(\s*["'](organizations|memberships)["']\s*\)\s*\.\s*(insert|upsert|update|delete)/.test(read(f)),
    );
    assert.deepEqual(hits, []);
    assert.match(read("src/lib/actions/organization.ts"), /rpc\(\s*["']create_organization["']/);
  });

  it("the registration action reads only the two company fields from the form", () => {
    const src = read("src/lib/actions/organization.ts");
    const reads = [...src.matchAll(/formData\.get\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    assert.deepEqual(reads.sort(), ["companyName", "legalName"]);
    assert.match(src, /await requireUser\(\)/);
  });

  it("the RPC call passes only the two name parameters (no user id, organization id or role)", () => {
    const src = read("src/lib/actions/organization.ts");
    const call = src.slice(src.indexOf('rpc("create_organization"'), src.indexOf('rpc("create_organization"') + 160);
    const keys = [...call.matchAll(/\b(p_[a-z_]+)\s*:/g)].map((m) => m[1]);
    assert.deepEqual(keys.sort(), ["p_legal_name", "p_name"]);
  });

  it("organization-dependent pages use requireOrganization()", () => {
    assert.match(read("src/app/(app)/page.tsx"), /requireOrganization\(/);
    assert.match(read("src/app/(app)/layout.tsx"), /requireOrganization\(/);
  });
});

describe("factory management (static)", () => {
  it("the application never hard-deletes any record", () => {
    const hits = sourceFiles.filter((f) => /\.delete\(/.test(read(f)));
    assert.deepEqual(hits, []);
  });

  it("factory actions take the company from the server, never from the form", () => {
    const src = read("src/lib/actions/factory.ts");
    assert.match(src, /requireOrganization\(\)/);
    assert.match(src, /organization_id:\s*organization\.id/);
    const reads = [...src.matchAll(/formData\.get\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(reads)].sort(), ["addressLine1", "addressLine2", "city", "factoryName", "id", "postalCode", "state"]);
    // every update and archive is scoped to the company and to active rows
    for (const chunk of src.split(".update(").slice(1)) {
      assert.match(chunk, /\.eq\("organization_id", organization\.id\)/);
      assert.match(chunk, /\.is\("archived_at", null\)/);
    }
  });

  it("the insert payload contains only the columns the database grants (no country, no created_by)", () => {
    const src = read("src/lib/actions/factory.ts");
    const insert = src.slice(src.indexOf(".insert("), src.indexOf("});", src.indexOf(".insert(")));
    const keys = [...insert.matchAll(/^\s+([a-z_0-9]+):/gm)].map((m) => m[1]).sort();
    assert.deepEqual(keys, ["address_line1", "address_line2", "city", "name", "organization_id", "postal_code", "state"]);
  });

  it("factory pages and the dashboard verify the company on the server", () => {
    for (const f of ["src/app/(app)/factories/page.tsx", "src/app/(app)/factories/new/page.tsx", "src/app/(app)/factories/[id]/edit/page.tsx", "src/app/(app)/page.tsx"]) {
      assert.match(read(f), /requireOrganization\(/, f);
    }
  });
});

describe("read-after-write safety (static)", () => {
  it("the server Supabase client opts its fetches out of Next's per-request memoization", () => {
    const src = read("src/lib/supabase/server.ts");
    assert.match(src, /global:\s*\{[\s\S]*fetch:/);
    assert.match(src, /cache:\s*"no-store"/);
    assert.match(src, /signal:/);
  });
});
