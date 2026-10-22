// Pure tests: the personalised roadmap reacts to real information and never counts a manual mark as approval.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PHASES, buildRoadmap } from "../../src/lib/roadmap/engine.ts";
import { newAssessment } from "../../src/lib/landed-cost/assessment.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";

const ids = (n, p) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const facts = (over = {}) => ({
  ref: "prod-1",
  standalone: false,
  company: { name: "DEMO Co", legalName: null, address: null },
  product: { name: "Plastic containers", own: true, description: true, category: true, intendedUse: true, specCount: 3, hsCode: null, unitWeightG: 95, unitsPerCarton: 24, cartonWeightKg: null, cartonDims: false, linkedFactories: ["Plant 1"] },
  fit: { level: "strong", score: 100, gaps: [], missingProcesses: [] },
  profile: { factories: 1, processes: 2, machines: 5, ratedMachines: 5, materials: 3, capacity: true },
  questions: { family: "food-contact", all: [...ids(6, "c"), ...ids(4, "t"), ...ids(3, "x"), ...ids(2, "s")], compliance: ids(6, "c"), testing: ids(4, "t"), hs: ["h0"], cepa: ids(3, "x"), schemes: ids(2, "s") },
  opportunities: { count: 5, top: [] },
  ...over,
});
const docs = (inv = 9, pack = 8, answered = 0) => ({ invoice: { missing: inv, total: 10, complete: inv === 0 }, packing: { missing: pack, total: 10, complete: pack === 0 }, checklist: { answered, total: 10 } });
const build = (over = {}) => buildRoadmap({ facts: facts(), assessment: null, docs: docs(), requests: [], ...(over) });
const task = (r, id) => r.tasks.find((t) => t.id === id);
const withAssessment = (mutate) => {
  const a = newAssessment("prod-1", sampleInputs());
  mutate(a);
  return a;
};

describe("structure", () => {
  const r = build();
  it("has the five phases in order, each with tasks", () => {
    assert.deepEqual(r.phases.map((p) => p.id), [1, 2, 3, 4, 5]);
    assert.deepEqual(r.phases.map((p) => p.title), PHASES.map((p) => p.title));
    assert.ok(r.phases.every((p) => p.tasks.length > 0));
  });
  it("every task explains what, why, the next action, priority, status and what backs it", () => {
    for (const t of r.tasks) {
      assert.ok(t.title && t.why && t.next.label && t.next.href.startsWith("/"), t.id);
      assert.ok(["high", "medium", "low"].includes(t.priority));
      assert.ok(["not_started", "in_progress", "completed", "needs_review"].includes(t.status));
      assert.ok(["data", "assumption", "unknown"].includes(t.support));
      assert.ok(t.supportNote.length > 5, t.id);
    }
  });
  it("offers a counts summary and no percentage score", () => {
    assert.equal(r.counts.total, r.tasks.length);
    assert.ok(!("percent" in r) && !("score" in r) && !("readiness" in r));
  });
  it("task ids are unique", () => {
    assert.equal(new Set(r.tasks.map((t) => t.id)).size, r.tasks.length);
  });
});

describe("it reacts to the information it has", () => {
  it("marks profile steps from the data", () => {
    const r = build();
    assert.equal(task(r, "p1-record").status, "completed");
    assert.equal(task(r, "p1-link").status, "completed");
    assert.equal(task(r, "p1-fit").status, "completed");
    const thin = build({ facts: facts({ product: { ...facts().product, description: false, category: false, specCount: 0, linkedFactories: [] } }) });
    assert.equal(task(thin, "p1-record").status, "in_progress");
    assert.equal(task(thin, "p1-link").status, "not_started");
    assert.equal(task(thin, "p1-record").blocker, true);
  });
  it("lists gaps and a stretch fit as work to do, not as done", () => {
    const gaps = build({ facts: facts({ fit: { level: "good", score: 80, gaps: ["a", "b"], missingProcesses: [] } }) });
    assert.equal(task(gaps, "p1-fit").status, "in_progress");
    const stretch = build({ facts: facts({ fit: { level: "stretch", score: 30, gaps: ["new process"], missingProcesses: ["blow_moulding"] } }) });
    assert.equal(task(stretch, "p1-fit").status, "needs_review");
    assert.equal(task(stretch, "p1-fit").blocker, true);
    const unknown = build({ facts: facts({ fit: { level: null, score: null, gaps: [], missingProcesses: [] } }) });
    assert.equal(task(unknown, "p1-fit").manual, true);
    assert.equal(task(unknown, "p1-fit").support, "unknown");
  });
  it("treats sample calculator inputs as an assumption and your own as data", () => {
    assert.equal(task(build(), "p2-inputs").status, "not_started");
    assert.equal(task(build(), "p2-inputs").support, "assumption");
    const a = withAssessment((x) => { x.edited = ["unitProductionCostInr"]; });
    const r = build({ assessment: a });
    assert.equal(task(r, "p2-inputs").status, "completed");
    assert.equal(task(r, "p2-inputs").support, "data");
  });
  it("tracks quotes: freight confirmed, other charges partly confirmed", () => {
    const a = withAssessment((x) => { x.edited = ["quantity"]; x.inputs.lines.internationalFreight.confirmed = true; x.inputs.fxNote = "bank, 1 Nov"; });
    const r = build({ assessment: a });
    assert.equal(task(r, "p2-freight").status, "completed");
    assert.equal(task(r, "p2-fx").status, "completed");
    assert.equal(task(r, "p2-quotes").status, "in_progress");
  });
  it("flags a margin below target or a loss for review, and passes a healthy one with an honest caveat", () => {
    const low = withAssessment((x) => { x.edited = ["sellingPriceAed"]; x.inputs.sellingPriceAed = 4; });
    assert.equal(task(build({ assessment: low }), "p2-margin").status, "needs_review");
    assert.equal(task(build({ assessment: low }), "p2-margin").blocker, true);
    const good = withAssessment((x) => { x.edited = ["sellingPriceAed"]; x.inputs.sellingPriceAed = 9; });
    const t = task(build({ assessment: good }), "p2-margin");
    assert.equal(t.status, "completed");
    assert.match(t.supportNote, /not tested against the market/);
    assert.equal(t.support, "assumption");
  });
  it("counts screening answers by section and never calls them verified", () => {
    const a = withAssessment((x) => { x.checks = { c0: true, c1: true, t0: true, x0: true }; });
    const r = build({ assessment: a });
    assert.equal(task(r, "p3-reqs").status, "in_progress");
    assert.match(task(r, "p3-reqs").supportNote, /2 of 6/);
    assert.equal(task(r, "p3-testing").status, "in_progress");
    assert.equal(task(r, "p3-cepa").status, "in_progress");
    assert.equal(task(r, "p3-schemes").status, "not_started");
    for (const id of ["p3-reqs", "p3-testing", "p3-cepa", "p3-schemes"]) assert.equal(task(r, id).support, "unknown");
    const all = withAssessment((x) => { x.checks = Object.fromEntries(facts().questions.compliance.map((i) => [i, true])); });
    assert.equal(task(build({ assessment: all }), "p3-reqs").status, "completed");
    assert.equal(task(build({ assessment: all }), "p3-reqs").support, "unknown", "completed questions are still not a verified finding");
  });
  it("follows the document drafts and the checklist", () => {
    const r = build({ docs: docs(0, 5, 10) });
    assert.equal(task(r, "p4-invoice").status, "completed");
    assert.equal(task(r, "p4-packing").status, "in_progress");
    assert.equal(task(r, "p4-checklist").status, "completed");
    assert.equal(task(build({ docs: docs(10, 10, 0) }), "p4-invoice").status, "not_started");
  });
  it("follows expert requests but states they are local", () => {
    const req = (status) => ({ id: "r", topic: "hs", productRef: "prod-1", productName: "x", title: "t", summary: "s", status, reply: "", createdAt: "", updatedAt: "" });
    assert.equal(task(build({ requests: [req("draft")] }), "p5-expert").status, "in_progress");
    assert.equal(task(build({ requests: [req("sent")] }), "p5-expert").status, "completed");
    assert.match(task(build(), "p5-expert").supportNote, /nothing is sent/i);
  });
  it("adds a step to adopt a suggested product", () => {
    const r = build({ facts: facts({ product: { ...facts().product, own: false } }) });
    assert.ok(task(r, "p1-adopt"));
    assert.equal(task(r, "p1-record"), undefined);
  });
});

describe("manual progress is progress, not approval", () => {
  it("lets the person set any status and records where it came from", () => {
    const a = withAssessment((x) => { x.tasks["p3-hs"] = { status: "in_progress", note: "asked broker", updatedAt: "" }; });
    const t = task(build({ assessment: a }), "p3-hs");
    assert.equal(t.status, "in_progress");
    assert.equal(t.statusSource, "you");
    assert.equal(t.note, "asked broker");
  });
  it("a manual 'completed' on a regulatory task rests on the person's word and is never 'data'", () => {
    const a = withAssessment((x) => { x.tasks["p3-hs"] = { status: "completed", note: "", updatedAt: "" }; x.tasks["p3-duty"] = { status: "completed", note: "", updatedAt: "" }; });
    const r = build({ assessment: a });
    for (const id of ["p3-hs", "p3-duty"]) {
      assert.equal(task(r, id).status, "completed");
      assert.notEqual(task(r, id).support, "data");
      assert.match(task(r, id).supportNote, /Marked completed by you/);
      assert.match(task(r, id).disclaimer, /not an approval/);
      assert.equal(task(r, id).blocker, false);
    }
    assert.ok(r.counts.resting >= 2);
  });
  it("every regulatory task carries the not-an-approval disclaimer", () => {
    for (const t of build().phases[2].tasks) assert.match(t.disclaimer ?? "", /not an approval/, t.id);
  });
  it("overriding a data-backed task to completed without data shows it as resting on the person's mark", () => {
    const a = withAssessment((x) => { x.tasks["p2-freight"] = { status: "completed", note: "", updatedAt: "" }; });
    const t = task(build({ assessment: a }), "p2-freight");
    assert.equal(t.status, "completed");
    assert.equal(t.support, "assumption");
    assert.match(t.supportNote, /does not show it/);
  });
});

describe("next best action and blockers", () => {
  it("starts with the earliest open high-priority step", () => {
    const thin = build({ facts: facts({ product: { ...facts().product, description: false, linkedFactories: [] } }) });
    assert.equal(thin.next.task.id, "p1-record");
    assert.equal(thin.next.task.phase, 1);
  });
  it("moves on as work is completed", () => {
    const r1 = build();
    assert.equal(r1.next.task.id, "p2-inputs", "profile done, so the calculator inputs come first");
    const a = withAssessment((x) => { x.edited = ["unitProductionCostInr"]; });
    const r2 = build({ assessment: a });
    assert.notEqual(r2.next.task.id, "p2-inputs");
    assert.ok(r2.next.task.phase >= 2);
  });
  it("explains why that action is next, in plain words", () => {
    const r = build();
    assert.match(r.next.reason, /earliest open/);
    assert.ok(r.next.reason.length > 30);
  });
  it("lists only open blockers, and removes one when it is resolved", () => {
    const r = build();
    assert.ok(r.blockers.some((t) => t.id === "p3-hs"));
    assert.ok(r.blockers.every((t) => t.status !== "completed"));
    const a = withAssessment((x) => { x.tasks["p3-hs"] = { status: "completed", note: "", updatedAt: "" }; });
    assert.ok(!build({ assessment: a }).blockers.some((t) => t.id === "p3-hs"));
  });
  it("works for a standalone assessment with no product", () => {
    const r = buildRoadmap({ facts: facts({ standalone: true, ref: "standalone", product: null, fit: { level: null, score: null, gaps: [], missingProcesses: [] }, questions: { family: null, all: [], compliance: [], testing: [], hs: [], cepa: [], schemes: [] } }), assessment: null, docs: docs(), requests: [] });
    assert.ok(r.tasks.length > 5);
    assert.ok(r.tasks.every((t) => t.next.href.startsWith("/")));
    assert.ok(r.next);
  });
  it("reports a finished roadmap as having no next action", () => {
    const a = withAssessment((x) => {
      x.edited = ["quantity"]; x.inputs.lines.internationalFreight.confirmed = true; x.inputs.fxNote = "bank";
      for (const k of Object.keys(x.inputs.lines)) x.inputs.lines[k].confirmed = true;
      x.inputs.sellingPriceAed = 9;
      x.checks = Object.fromEntries(facts().questions.all.map((i) => [i, true]));
      const all = buildRoadmap({ facts: facts(), assessment: x, docs: docs(0, 0, 10), requests: [] }).tasks;
      for (const t of all) if (t.status !== "completed") x.tasks[t.id] = { status: "completed", note: "", updatedAt: "" };
    });
    const r = buildRoadmap({ facts: facts(), assessment: a, docs: docs(0, 0, 10), requests: [] });
    assert.equal(r.next, null);
    assert.equal(r.counts.completed, r.counts.total);
  });
});
