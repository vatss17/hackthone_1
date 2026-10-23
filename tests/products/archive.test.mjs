// Static tests: archiving is reversible in the interface, never deletes, and restoring goes through one narrow owner-only function.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const actions = src("src/lib/actions/capabilities.ts");
const restore = actions.slice(actions.indexOf("export async function restoreProduct"), actions.indexOf("export async function archiveProduct"));
const migration = src("supabase/migrations/20261023120000_restore_archived_product.sql");

describe("restoring an archived product", () => {
  it("is owner-only, scoped to the signed-in company, and uses the user's own session", () => {
    assert.match(restore, /await owner\(/);
    assert.match(restore, /supabase\.rpc\("restore_product"/);
    assert.ok(!/service|secret/i.test(restore));
  });
  it("says plainly when the database function is not there, and changes nothing", () => {
    assert.match(restore, /PGRST202/);
    assert.match(restore, /restore_unavailable/);
    assert.match(src("src/lib/capability-validation.ts"), /restore_unavailable: "Restoring an archived product is not switched on/);
  });
  it("explains a name clash instead of failing silently", () => {
    assert.match(restore, /23505/);
    assert.match(src("src/lib/capability-validation.ts"), /restore_duplicate: "An active product already has the same name/);
  });
});

describe("the proposed migration is narrow and is NOT applied", () => {
  it("is marked proposed and creates one owner-only function", () => {
    assert.match(migration, /PROPOSED, NOT APPLIED/);
    assert.match(migration, /create function public\.restore_product\(p_product_id uuid\)/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(migration, /private\.is_org_owner\(v_org\)/);
    assert.match(migration, /revoke all on function public\.restore_product\(uuid\) from public, anon/);
    assert.match(migration, /grant execute on function public\.restore_product\(uuid\) to authenticated/);
  });
  it("only clears archived_at on one row and does not reopen editing of archived rows", () => {
    assert.match(migration, /update public\.products set archived_at = null where id = p_product_id/);
    assert.ok(!/drop policy|alter policy|create policy/i.test(migration));
    assert.ok(!/\bdelete\b/i.test(migration.replace(/--.*$/gm, "")));
  });
  it("answers 'missing' and 'not yours' identically", () => {
    assert.equal((migration.match(/raise exception/g) ?? []).length, 1);
  });
});

describe("the interface", () => {
  it("states the consequences and gives an undo window before anything is archived", () => {
    const c = src("src/components/products/archive-product.tsx");
    assert.match(c, /Nothing is deleted/);
    assert.match(c, /seconds to undo/);
    assert.match(c, /Undo/);
    assert.match(c, /setTimeout/);
  });
  it("archived products stay visible with their details and a restore control for owners", () => {
    const p = src("src/app/(app)/products/page.tsx");
    assert.match(p, /Archived products \(/);
    assert.match(p, /restoreProduct/);
    assert.match(p, /never deleted/);
    assert.match(src("src/lib/capabilities.ts"), /listArchivedProducts/);
  });
  it("archiving never deletes rows", () => {
    const a = actions.slice(actions.indexOf("export async function archiveProduct"), actions.indexOf("export async function addSpecification"));
    assert.ok(!/\.delete\(\)/.test(a));
    assert.match(a, /archived_at/);
  });
});
