// Pure tests: screening answers are structured, "resolved" is separate from "compliant", and old ticks migrate without invented answers.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { answerResolved, isResolved, newAssessment, parseAssessment, resolvedMirror } from "../../src/lib/landed-cost/assessment.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";

const defaults = sampleInputs();
const ans = (over = {}) => ({ state: "answered", answer: "", note: "", source: "", sourceDate: "", reviewer: "", reviewedOn: "", answeredOn: "2026-10-22", ...over });

describe("what counts as resolved", () => {
  it("an answer with text is resolved; an empty answer is not", () => {
    assert.equal(answerResolved(ans({ answer: "Broker confirmed" })), true);
    assert.equal(answerResolved(ans()), false);
  });
  it("not applicable needs a reason", () => {
    assert.equal(answerResolved(ans({ state: "not_applicable", note: "We do not sell food-contact items" })), true);
    assert.equal(answerResolved(ans({ state: "not_applicable" })), false);
  });
  it("unknown is never resolved, even with a note", () => {
    assert.equal(answerResolved(ans({ state: "unknown", note: "Asked the lab, waiting" })), false);
  });
  it("there is no state that means compliant", () => {
    const a = newAssessment("r", defaults);
    assert.ok(!JSON.stringify(a).match(/compliant|complies|approved|verified/i));
    for (const st of ["answered", "not_applicable", "unknown"]) assert.ok(!/compli/i.test(st));
  });
  it("the resolved mirror matches the answers", () => {
    const answers = { a: ans({ answer: "yes" }), b: ans({ state: "unknown" }), c: ans({ state: "not_applicable", note: "n/a because" }) };
    assert.deepEqual(Object.keys(resolvedMirror(answers)).sort(), ["a", "c"]);
  });
});

describe("structured fields survive a round trip and are sanitised", () => {
  it("keeps answer, note, source, dates and reviewer", () => {
    const a = newAssessment("r", defaults);
    a.answers = { "q.one": ans({ answer: "Yes, test report held", note: "Report for grade X", source: "Lab report 42", sourceDate: "2026-09-30", reviewer: "A. Person", reviewedOn: "2026-10-01" }) };
    a.checks = resolvedMirror(a.answers);
    const back = parseAssessment(JSON.stringify(a), "r", defaults);
    assert.deepEqual(back.answers, a.answers);
    assert.deepEqual(back.checks, { "q.one": true });
  });
  it("drops bad states, bad ids and malformed dates", () => {
    const raw = JSON.stringify({ v: 2, inputs: defaults, answers: { good: ans({ answer: "x", sourceDate: "not a date" }), "bad id!": ans({ answer: "x" }), weird: { state: "compliant", answer: "x" } } });
    const a = parseAssessment(raw, "r", defaults);
    assert.deepEqual(Object.keys(a.answers), ["good"]);
    assert.equal(a.answers.good.sourceDate, "");
  });
});

describe("migrating version 1 ticks", () => {
  const v1 = JSON.stringify({ v: 1, inputs: defaults, checks: { "q.one": true, "q.two": true, "q.false": false } });
  it("keeps them resolved without inventing any answer", () => {
    const a = parseAssessment(v1, "r", defaults);
    assert.deepEqual(Object.keys(a.checks).sort(), ["q.one", "q.two"]);
    for (const id of ["q.one", "q.two"]) {
      assert.equal(a.answers[id].legacy, true);
      assert.equal(a.answers[id].answer, "");
      assert.equal(a.answers[id].source, "");
      assert.equal(isResolved(a, id), true);
    }
    assert.equal(a.answers["q.false"], undefined);
  });
  it("a migrated tick stays resolved until the person writes an answer, and writing one clears the legacy mark in the UI", () => {
    const a = parseAssessment(v1, "r", defaults);
    assert.equal(answerResolved({ ...a.answers["q.one"], legacy: undefined }), false, "without the legacy mark an empty answer would not count");
    assert.equal(answerResolved({ ...a.answers["q.one"], answer: "now written", legacy: undefined }), true);
  });
  it("is idempotent: reading the migrated result again changes nothing", () => {
    const once = parseAssessment(v1, "r", defaults);
    const twice = parseAssessment(JSON.stringify(once), "r", defaults);
    assert.deepEqual(twice.answers, once.answers);
    assert.deepEqual(twice.checks, once.checks);
  });
});
