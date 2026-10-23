// Text that reaches the screen as data (lists in lib files, error messages, the HS helper's rules) is translated when it is shown,
// so the usual "every t(...) literal" test cannot see it. This checks each such string has a Hindi and a Gujarati entry.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DICTIONARIES } from "../../src/lib/i18n/messages/index.ts";
import { placeholders } from "../../src/lib/i18n/translate.ts";
import { START_PROCESSES, START_MATERIALS, processName, materialName } from "../../src/lib/start/capability.ts";
import { FIT_LABEL } from "../../src/lib/opportunities/engine.ts";
import { CATALOGUE } from "../../src/lib/opportunities/catalogue.ts";
import { readProduct } from "../../src/lib/start/read-product.ts";
import { findCandidates, CONFIRM_TEXT } from "../../src/lib/classification/candidates.ts";
import { HEADING_LABELS } from "../../src/lib/trade/headings.ts";
import { INDIAN_STATES } from "../../src/lib/factory-validation.ts";
import { mapLogInError, mapSignUpError, mapResetRequestError, mapUpdatePasswordError } from "../../src/lib/auth-errors.ts";
import { mapRegisterError } from "../../src/lib/organization-errors.ts";
import { validateCompany } from "../../src/lib/organization-validation.ts";
import { PASSWORD_MIN, PASSWORD_MAX } from "../../src/lib/auth-types.ts";

const DEVANAGARI = /[ऀ-ॿ]/;
const GUJARATI = /[઀-૿]/;
const LATIN_WORD = /[A-Za-z]{3,}/;

function check(label, strings) {
  const list = [...new Set(strings.filter(Boolean))];
  assert.ok(list.length > 0, `${label}: nothing collected`);
  for (const [loc, script] of [["hi", DEVANAGARI], ["gu", GUJARATI]]) {
    const dict = DICTIONARIES[loc];
    const missing = list.filter((s) => !dict[s]);
    assert.deepEqual(missing, [], `${label}: missing ${loc}`);
    const bad = list.filter((s) => placeholders(s).join() !== placeholders(dict[s]).join() || (LATIN_WORD.test(s.replace(/\b(?:PP|HDPE|LDPE|PET|HS|HSN)\b/g, "")) && !script.test(dict[s])));
    assert.deepEqual(bad, [], `${label}: wrong script or placeholders in ${loc}`);
  }
}

describe("public section data is translated", () => {
  it("process and material names and their plain-English lines", () => {
    check("start capability", [...START_PROCESSES.flatMap((p) => [processName(p.code), p.plain]), ...START_MATERIALS.flatMap((m) => [materialName(m.code), m.plain])]);
  });
  it("fit labels and catalogue product names", () => {
    check("fit labels", Object.values(FIT_LABEL));
    check("catalogue", CATALOGUE.map((e) => e.name));
  });
  it("what the product reader labels and guesses", () => {
    const rows = [...readProduct("Crate", "storage box"), ...readProduct("Pipe", "conduit"), ...readProduct("Jar", "bottle")];
    check("product use", rows.filter((r) => r.key === "use").map((r) => r.value));
  });
  it("the HS helper's rules, notes and headings", () => {
    const out = [];
    for (const text of ["crate box", "bottle cap pallet", "pipe hose elbow", "tank window", "hanger clip", "chair table", "profile rod", "household bucket", "zzz"]) {
      const r = findCandidates({ name: text });
      out.push(r.confirm, r.none);
      for (const c of r.candidates) {
        out.push(c.label, c.rationale);
        if (!/^Other headings may also fit \(/.test(c.ambiguity)) out.push(c.ambiguity);
      }
    }
    out.push(CONFIRM_TEXT, ...Object.values(HEADING_LABELS));
    check("hs helper", out);
    assert.ok(DICTIONARIES.hi["Other headings may also fit ({headings}). Which one applies depends on the exact product and how it is mainly used."]);
  });
  it("India's states and union territories", () => {
    check("states", [...INDIAN_STATES]);
  });
  it("sign-in, sign-up, reset and registration messages", () => {
    const e = (code, extra = {}) => ({ code, ...extra });
    const msgs = [];
    const push = (s) => {
      if (s.error) msgs.push(s.error);
      for (const v of Object.values(s.fieldErrors ?? {})) msgs.push(v);
    };
    for (const code of ["email_not_confirmed", "over_request_rate_limit", "invalid_credentials", "other"]) push(mapLogInError(e(code), "a@b.c"));
    for (const x of [e("weak_password"), e("email_address_invalid"), e("over_email_send_rate_limit"), e("smtp_failed"), e("other")]) push(mapSignUpError(x, "a@b.c"));
    for (const x of [e("over_email_send_rate_limit"), e("smtp_failed"), e("email_address_invalid"), e("other")]) push(mapResetRequestError(x, "a@b.c"));
    for (const x of [e("weak_password"), e("same_password"), e("over_request_rate_limit"), e("session_not_found"), e("other")]) push(mapUpdatePasswordError(x));
    for (const x of [e("42501", { message: "not confirmed" }), e("22023"), e("other")]) {
      const o = mapRegisterError(x, {});
      if (o.kind === "state") push(o.state);
    }
    for (const [n, l] of [["", "x".repeat(400)], ["a", "\n"], ["x".repeat(300), "!"]]) push({ fieldErrors: validateCompany(n, l).fieldErrors ?? {} });
    // Messages the sign-in and sign-up actions write themselves (src/lib/actions/auth.ts).
    msgs.push("Enter your email address.", "Enter a valid email address.", "Enter your password.", `Use at least ${PASSWORD_MIN} characters.`, `Use at most ${PASSWORD_MAX} characters.`, "The passwords do not match.", "This page only works right after you open the link in a password-reset email. Request a new link.");
    check("auth messages", msgs);
  });
});
