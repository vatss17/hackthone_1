// Pure tests: roadmap notes and expert drafts are not lost, and two quick edits never overwrite each other.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyTaskPatch, newAssessment, parseAssessment, storageKey } from "../../src/lib/landed-cost/assessment.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";
import { draftKey, requestsKey } from "../../src/lib/experts/brief.ts";

const fresh = () => newAssessment("r", sampleInputs());
const NOW = "2026-10-22T10:00:00Z";

describe("roadmap notes and statuses", () => {
  it("a note alone is kept and does not pin the status", () => {
    const a = applyTaskPatch(fresh(), "p1-link", { note: "asked the plant manager" }, NOW);
    assert.deepEqual(a.tasks["p1-link"], { status: null, note: "asked the plant manager", updatedAt: NOW });
  });
  it("a status alone is kept and keeps an existing note", () => {
    let a = applyTaskPatch(fresh(), "p3-hs", { note: "waiting on broker" }, NOW);
    a = applyTaskPatch(a, "p3-hs", { status: "in_progress" }, NOW);
    assert.equal(a.tasks["p3-hs"].note, "waiting on broker");
    assert.equal(a.tasks["p3-hs"].status, "in_progress");
  });
  it("clearing both removes the entry; clearing only the status keeps the note", () => {
    let a = applyTaskPatch(fresh(), "t-one-x", { status: "completed", note: "done" }, NOW);
    a = applyTaskPatch(a, "t-one-x", { status: null }, NOW);
    assert.equal(a.tasks["t-one-x"].note, "done");
    a = applyTaskPatch(a, "t-one-x", { note: "" }, NOW);
    assert.equal(a.tasks["t-one-x"], undefined);
  });
  it("two quick edits applied to the latest copy both survive (no stale overwrite)", () => {
    // The old behaviour applied each edit to the copy a component rendered earlier, so the second edit erased the first.
    let stored = JSON.stringify(fresh());
    const latest = () => parseAssessment(stored, "r", sampleInputs());
    const save = (a) => (stored = JSON.stringify(a));
    save(applyTaskPatch(latest(), "p3-hs", { note: "note one" }, NOW));
    save(applyTaskPatch(latest(), "p2-fx", { status: "completed" }, NOW));
    save({ ...latest(), focusTaskId: "p3-hs" });
    const a = latest();
    assert.equal(a.tasks["p3-hs"].note, "note one");
    assert.equal(a.tasks["p2-fx"].status, "completed");
    assert.equal(a.focusTaskId, "p3-hs");
  });
  it("notes survive being saved and read back", () => {
    const a = applyTaskPatch(fresh(), "p1-link", { note: "x".repeat(400) }, NOW);
    assert.equal(a.tasks["p1-link"].note.length, 300, "capped, not dropped");
    const back = parseAssessment(JSON.stringify(a), "r", sampleInputs());
    assert.equal(back.tasks["p1-link"].note.length, 300);
    assert.equal(back.tasks["p1-link"].status, null);
  });
});

describe("storage keys keep companies and products apart", () => {
  it("assessments are per company and per product", () => {
    assert.notEqual(storageKey("org-a", "p1"), storageKey("org-b", "p1"));
    assert.notEqual(storageKey("org-a", "p1"), storageKey("org-a", "p2"));
    assert.match(storageKey("org-a", "p1"), /:v2:/);
    assert.match(storageKey("org-a", "p1", 1), /:v1:/);
  });
  it("expert drafts are per company, product and topic, so switching never discards an edit", () => {
    const keys = new Set([draftKey("org-a", "p1", "hs"), draftKey("org-a", "p1", "cepa"), draftKey("org-a", "p2", "hs"), draftKey("org-b", "p1", "hs"), draftKey("org-a", null, "hs")]);
    assert.equal(keys.size, 5);
  });
  it("expert requests are per company", () => {
    assert.notEqual(requestsKey("org-a"), requestsKey("org-b"));
  });
});
