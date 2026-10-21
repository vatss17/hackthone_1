// Pure unit tests: factory validation and write-error mapping. No server, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INDIAN_STATES, isUuid, validateFactory } from "../../src/lib/factory-validation.ts";
import { mapFactoryWriteError } from "../../src/lib/factory-errors.ts";

const good = {
  factoryName: "Synthetic Plant 1",
  addressLine1: "1 Test Road",
  addressLine2: "",
  city: "Testville",
  state: "Gujarat",
  postalCode: "380001",
};

describe("validateFactory", () => {
  it("accepts a complete valid factory", () => {
    const r = validateFactory(good);
    assert.equal(r.ok, true);
    assert.equal(r.values.factoryName, "Synthetic Plant 1");
  });

  it("address line 2 is optional", () => {
    assert.equal(validateFactory({ ...good, addressLine2: "" }).ok, true);
    assert.equal(validateFactory({ ...good, addressLine2: "Near the test depot" }).ok, true);
  });

  it("requires every other field, with a specific message each", () => {
    const r = validateFactory({});
    assert.equal(r.ok, false);
    assert.match(r.fieldErrors.factoryName, /Enter the factory name/);
    assert.match(r.fieldErrors.addressLine1, /Enter the address/);
    assert.match(r.fieldErrors.city, /Enter the city/);
    assert.match(r.fieldErrors.state, /Choose the state/);
    assert.match(r.fieldErrors.postalCode, /Enter the PIN code/);
    assert.equal(r.fieldErrors.addressLine2, undefined);
  });

  it("enforces the database length limits", () => {
    assert.match(validateFactory({ ...good, factoryName: "A" }).fieldErrors.factoryName, /at least 2/);
    assert.match(validateFactory({ ...good, factoryName: "A".repeat(201) }).fieldErrors.factoryName, /at most 200/);
    assert.equal(validateFactory({ ...good, factoryName: "A".repeat(200) }).ok, true);
    assert.match(validateFactory({ ...good, addressLine1: "B".repeat(201) }).fieldErrors.addressLine1, /at most 200/);
    assert.match(validateFactory({ ...good, addressLine2: "B".repeat(201) }).fieldErrors.addressLine2, /at most 200/);
    assert.match(validateFactory({ ...good, city: "C".repeat(101) }).fieldErrors.city, /at most 100/);
  });

  it("PIN code must be 6 digits and not start with 0 (spaces are ignored)", () => {
    for (const bad of ["12345", "1234567", "012345", "ABCDEF", "38 00 1x", "380 001!"]) {
      assert.match(validateFactory({ ...good, postalCode: bad }).fieldErrors.postalCode, /6-digit PIN/, bad);
    }
    const spaced = validateFactory({ ...good, postalCode: "380 001" });
    assert.equal(spaced.ok, true);
    assert.equal(spaced.values.postalCode, "380001");
  });

  it("state must be one of the 36 states and union territories", () => {
    assert.equal(INDIAN_STATES.length, 36);
    assert.equal(new Set(INDIAN_STATES).size, 36);
    for (const s of INDIAN_STATES) assert.equal(validateFactory({ ...good, state: s }).ok, true, s);
    for (const bad of ["Atlantis", "gujarat", "Gujarat ; drop table", "India"]) {
      assert.match(validateFactory({ ...good, state: bad }).fieldErrors.state, /from the list/, bad);
    }
  });

  it("rejects control characters and symbol-only text, trims and collapses whitespace", () => {
    assert.match(validateFactory({ ...good, factoryName: "Bad\u0000Name" }).fieldErrors.factoryName, /control characters/);
    assert.match(validateFactory({ ...good, addressLine1: "!!!" }).fieldErrors.addressLine1, /letter or number/);
    assert.equal(validateFactory({ ...good, factoryName: "  Plant   One \t" }).values.factoryName, "Plant One");
  });

  it("has no country field: only the six factory fields are read, extras are ignored", () => {
    const r = validateFactory({ ...good, country: "US", organization_id: "x", created_by: "y", id: "z" });
    assert.equal(r.ok, true);
    assert.deepEqual(Object.keys(r.values).sort(), ["addressLine1", "addressLine2", "city", "factoryName", "postalCode", "state"]);
  });

  it("non-string input is treated as empty", () => {
    for (const bad of [undefined, null, 5, {}, ["x"]]) assert.equal(validateFactory({ ...good, factoryName: bad }).ok, false);
  });

  it("keeps submitted values for redisplay after an error", () => {
    const r = validateFactory({ ...good, postalCode: "bad" });
    assert.equal(r.values.factoryName, "Synthetic Plant 1");
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects everything else", () => {
    assert.equal(isUuid("3f2b8c1e-4d5a-4b6c-9d7e-1a2b3c4d5e6f"), true);
    for (const bad of ["", "1", "not-a-uuid", "3f2b8c1e-4d5a-4b6c-9d7e-1a2b3c4d5e6", "../etc/passwd", "3f2b8c1e-4d5a-4b6c-9d7e-1a2b3c4d5e6f; drop", null, undefined, 5]) {
      assert.equal(isUuid(bad), false, String(bad));
    }
  });
});

describe("mapFactoryWriteError", () => {
  const values = { ...good };
  it("duplicate active name becomes a field error, without the constraint name", () => {
    const s = mapFactoryWriteError({ code: "23505", message: 'duplicate key value violates unique constraint "factories_org_name_active_idx"' }, values);
    assert.match(s.fieldErrors.factoryName, /already have an active factory with this name/);
    assert.ok(!JSON.stringify(s).includes("factories_org_name_active_idx"));
    assert.deepEqual(s.values, values);
  });
  it("row-level-security refusals say only owners can change factories", () => {
    for (const e of [{ code: "42501", message: "x" }, { message: 'new row violates row-level security policy for table "factories"' }]) {
      assert.match(mapFactoryWriteError(e, values).error, /Only company owners/);
    }
  });
  it("unknown failures say nothing was changed and expose no raw detail", () => {
    for (const e of [{ code: "XX000", message: 'relation "public.factories" does not exist' }, { code: "PGRST301", message: "JWT expired" }, { message: "fetch failed" }]) {
      const s = mapFactoryWriteError(e, values);
      assert.match(s.error, /Nothing was changed/);
      for (const leak of ["relation", "JWT", "fetch failed", "PGRST", "XX000"]) assert.ok(!JSON.stringify(s).includes(leak), leak);
    }
  });
});
