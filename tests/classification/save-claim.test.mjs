// Static checks: saving a claimed HS code reuses the owner check and company scope, and mirrors the database constraint.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../src/lib/actions/capabilities.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../../supabase/migrations/20261022150000_capabilities_and_products.sql", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("async function saveHsClaim"), src.indexOf("export async function updateProduct"));

describe("claimed HS code", () => {
  it("checks the owner role, scopes to the company and only touches the claim column", () => {
    assert.match(fn, /await owner\(/);
    assert.match(fn, /\.eq\("organization_id", org\.id\)/);
    assert.match(fn, /update\(\{ hs_code_claimed:/);
    assert.ok(!/service|secret/i.test(fn));
  });
  it("uses the same pattern as the database check", () => {
    const db = /hs_code_claimed ~ '(\^\[0-9\]\{4\}\(\[\.\]\?\[0-9\]\{2\}\)\{0,3\}\$)'/.exec(sql)[1];
    const app = /\/(\^\\d\{4\}\(\[\.\]\?\\d\{2\}\)\{0,3\}\$)\//.exec(fn)[1];
    assert.equal(db.replace(/\[0-9\]/g, "\\d"), app);
  });
  it("is reached only through the existing product update action and says unverified", () => {
    assert.match(src, /if \(clean\(fd\.get\("only"\)\) === "hs"\) return saveHsClaim\(fd\)/);
    assert.match(readFileSync(new URL("../../src/lib/capability-validation.ts", import.meta.url), "utf8"), /hs_saved: ".*unverified/);
  });
});
