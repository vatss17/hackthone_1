// Pure tests: HS candidates are rule-based, explained, ambiguous where they should be, and never a classification.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONFIRM_TEXT, findCandidates } from "../../src/lib/classification/candidates.ts";

describe("hs candidates", () => {
  it("suggests the pipe heading for a conduit and says why", () => {
    const r = findCandidates({ name: "Cable Conduit Pipe 32mm", description: "Flexible conduit for cable protection" });
    assert.equal(r.candidates[0].heading, "3917");
    assert.ok(r.candidates[0].basis.includes("conduit") || r.candidates[0].basis.includes("pipe"));
    assert.match(r.candidates[0].rationale, /pipes/i);
  });
  it("flags a real ambiguity between packaging and household headings", () => {
    const r = findCandidates({ name: "Storage box", description: "household storage container with lid" });
    const hs = r.candidates.map((c) => c.heading);
    assert.ok(hs.includes("3923") && hs.includes("3924"));
    assert.match(r.candidates.find((c) => c.heading === "3923").ambiguity, /pack|household/);
  });
  it("uses the catalogue product type as another source, labelled as such", () => {
    const r = findCandidates({ name: "Thing", catalogueId: "irrigation-drip" });
    assert.equal(r.candidates[0].heading, "3917");
    assert.deepEqual(r.candidates[0].basis, ["the product type"]);
  });
  it("is honest when nothing matches", () => {
    const r = findCandidates({ name: "Widget", description: "an item" });
    assert.deepEqual(r.candidates, []);
    assert.match(r.none, /Nothing in the description/);
  });
  it("always carries the confirmation requirement, never calls anything verified or official", () => {
    const r = findCandidates({ name: "Bucket 10L" });
    assert.equal(r.confirm, CONFIRM_TEXT);
    assert.match(r.confirm, /Unverified/);
    for (const c of r.candidates) assert.ok(!/verified code|official classification|is classified/i.test(JSON.stringify(c)));
  });
  it("suggests at most three headings, all four digits", () => {
    const r = findCandidates({ name: "box bottle pipe chair tank hanger bucket", description: "container profile" });
    assert.ok(r.candidates.length <= 3);
    for (const c of r.candidates) assert.match(c.heading, /^\d{4}$/);
  });
});
