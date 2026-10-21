// Pure unit tests: company validation and registration error mapping. No server, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateCompany } from "../../src/lib/organization-validation.ts";
import { mapRegisterError } from "../../src/lib/organization-errors.ts";

describe("validateCompany", () => {
  it("accepts a normal name and treats a blank legal name as absent", () => {
    const r = validateCompany("Synthetic Plastics Pvt Ltd", "");
    assert.equal(r.ok, true);
    assert.equal(r.name, "Synthetic Plastics Pvt Ltd");
    assert.equal(r.legalName, null);
  });

  it("trims and collapses whitespace", () => {
    const r = validateCompany("  Synthetic   Plastics \t Ltd  ", "  Legal   Name  Ltd ");
    assert.equal(r.name, "Synthetic Plastics Ltd");
    assert.equal(r.legalName, "Legal Name Ltd");
  });

  it("requires a company name", () => {
    for (const v of [undefined, null, "", "   ", 5, {}, []]) {
      const r = validateCompany(v, "");
      assert.equal(r.ok, false, JSON.stringify(v));
      assert.equal(r.fieldErrors.companyName, "Enter your company name.");
    }
  });

  it("enforces length limits that match the database (2 to 200, legal 2 to 300)", () => {
    assert.match(validateCompany("A", "").fieldErrors.companyName, /at least 2/);
    assert.equal(validateCompany("AB", "").ok, true);
    assert.equal(validateCompany("A".repeat(200), "").ok, true);
    assert.match(validateCompany("A".repeat(201), "").fieldErrors.companyName, /at most 200/);
    assert.match(validateCompany("Valid Name", "X").fieldErrors.legalName, /at least 2/);
    assert.equal(validateCompany("Valid Name", "L".repeat(300)).ok, true);
    assert.match(validateCompany("Valid Name", "L".repeat(301)).fieldErrors.legalName, /at most 300/);
  });

  it("rejects control characters and names with no letter or number", () => {
    assert.match(validateCompany("Bad\u0000Name", "").fieldErrors.companyName, /control characters/);
    assert.match(validateCompany("!!!", "").fieldErrors.companyName, /letter or number/);
    assert.match(validateCompany("Valid Name", "---").fieldErrors.legalName, /letter or number/);
  });

  it("accepts international names", () => {
    for (const n of ["प्लास्टिक उद्योग", "Müller Kunststoffe GmbH", "株式会社テスト", "شركة اختبار"]) {
      assert.equal(validateCompany(n, "").ok, true, n);
    }
  });

  it("reports both field errors at once and returns the cleaned values for redisplay", () => {
    const r = validateCompany("", "x");
    assert.ok(r.fieldErrors.companyName && r.fieldErrors.legalName);
    assert.deepEqual(r.values, { companyName: "", legalName: "x" });
  });

  it("returns the submitted name unchanged when it contains markup (escaping is the renderer's job)", () => {
    assert.equal(validateCompany("<b>Acme</b>", "").name, "<b>Acme</b>");
  });
});

describe("mapRegisterError", () => {
  const values = { companyName: "Synthetic Co", legalName: "" };

  it("one-company-per-user violation (duplicate / concurrent submit) is 'already registered', not a failure", () => {
    const o = mapRegisterError({ code: "23505", message: "user already belongs to an organization" }, values);
    assert.equal(o.kind, "already-registered");
  });

  it("no session means sign in", () => {
    assert.equal(mapRegisterError({ code: "28000", message: "not authenticated" }, values).kind, "signed-out");
  });

  it("unconfirmed email gets a specific, safe message", () => {
    const o = mapRegisterError({ code: "42501", message: "email address not confirmed" }, values);
    assert.equal(o.kind, "state");
    assert.match(o.state.error, /Confirm your email address first/);
  });

  it("unknown database failures say nothing was saved and expose no raw detail", () => {
    for (const e of [
      { code: "XX000", message: 'duplicate key value violates unique constraint "memberships_user_id_key"' },
      { code: "PGRST301", message: "JWT expired" },
      { code: "", message: "fetch failed" },
      { message: "relation \"public.organizations\" does not exist" },
    ]) {
      const o = mapRegisterError(e, values);
      assert.equal(o.kind, "state");
      assert.match(o.state.error, /Nothing was saved/);
      const text = JSON.stringify(o);
      for (const leak of ["duplicate key", "memberships_user_id_key", "JWT", "fetch failed", "relation", "PGRST", "XX000"]) {
        assert.ok(!text.includes(leak), `leaked ${leak}`);
      }
      assert.deepEqual(o.state.values, values, "form values kept so the user can retry");
    }
  });

  it("a duplicate-key error WITHOUT the one-company message is not mistaken for success", () => {
    const o = mapRegisterError({ code: "23505", message: "something else entirely" }, values);
    assert.equal(o.kind, "state");
  });
});
