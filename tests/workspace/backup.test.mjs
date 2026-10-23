// Pure tests: the workspace file round-trips, migrates, refuses other companies and invalid files, and never silently overwrites newer work.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyRestore, collect, deviceStatus, parseBackup, planRestore, serialize, BACKUP_VERSION } from "../../src/lib/workspace/backup.ts";
import { newAssessment, storageKey } from "../../src/lib/landed-cost/assessment.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";
import { draftKey, requestsKey } from "../../src/lib/experts/brief.ts";

const ORG = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const P1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const P2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { keys: () => [...m.keys()], get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), _m: m };
};
const assessment = (ref, updatedAt, edit = {}) => ({ ...newAssessment(ref, sampleInputs()), updatedAt, ...edit });
const request = (id, updatedAt, over = {}) => ({ id, topic: "hs", productRef: P1, productName: "Crates", title: "Brief", summary: "text", status: "draft", reply: "", createdAt: updatedAt, updatedAt, ...over });
const populated = () =>
  memory({
    [storageKey(ORG, P1)]: JSON.stringify(assessment(P1, "2026-10-02T10:00:00Z", { edited: ["quantity"], answers: { "q.one": { state: "answered", answer: "Yes", note: "", source: "", sourceDate: "", reviewer: "", reviewedOn: "", answeredOn: "2026-10-02" } } })),
    [storageKey(ORG, P2)]: JSON.stringify(assessment(P2, "2026-10-01T10:00:00Z")),
    [storageKey(OTHER, "cccccccc-cccc-cccc-cccc-cccccccccccc")]: JSON.stringify(assessment("cccccccc-cccc-cccc-cccc-cccccccccccc", "2026-10-03T00:00:00Z")),
    [requestsKey(ORG)]: JSON.stringify([request("req-abcdef000001", "2026-10-02T09:00:00Z")]),
    [draftKey(ORG, P1, "hs")]: "My edited brief",
    [`export-enablement:capacity:v1:${ORG}:dddddddd-dddd-dddd-dddd-dddddddddddd`]: JSON.stringify({ layout: "sequential", confirmed: true, byProcess: {} }),
  });

describe("collecting", () => {
  it("gathers one company's data and only that company's", () => {
    const b = collect(populated(), ORG);
    assert.deepEqual(Object.keys(b.assessments).sort(), [P1, P2]);
    assert.equal(b.requests.length, 1);
    assert.deepEqual(b.drafts, { [`${P1}:hs`]: "My edited brief" });
    assert.equal(Object.keys(b.capacity).length, 1);
    assert.equal(b.organizationId, ORG);
    assert.ok(!JSON.stringify(b).includes("cccccccc"), "another company's product is never included");
  });
  it("reads a version 1 assessment, migrating it in the copy and leaving the stored original untouched", () => {
    const v1 = JSON.stringify({ v: 1, inputs: sampleInputs(), edited: [], checks: { "q.old": true }, updatedAt: "2026-09-01T00:00:00Z" });
    const store = memory({ [storageKey(ORG, P1, 1)]: v1 });
    const b = collect(store, ORG);
    assert.equal(b.assessments[P1].v, 2);
    assert.equal(b.assessments[P1].answers["q.old"].legacy, true);
    assert.equal(store.get(storageKey(ORG, P1, 1)), v1);
  });
  it("a newer saved copy beats an older version of the same product", () => {
    const store = memory({ [storageKey(ORG, P1, 1)]: JSON.stringify({ v: 1, inputs: sampleInputs(), updatedAt: "2026-01-01T00:00:00Z" }), [storageKey(ORG, P1)]: JSON.stringify(assessment(P1, "2026-10-01T00:00:00Z", { edited: ["quantity"] })) });
    assert.deepEqual(collect(store, ORG).assessments[P1].edited, ["quantity"]);
  });
});

describe("round trip", () => {
  it("export then import into an empty device gives the same workspace", () => {
    const text = serialize(collect(populated(), ORG));
    const parsed = parseBackup(text);
    assert.equal(parsed.ok, true);
    const fresh = memory();
    const r = applyRestore(fresh, ORG, parsed.backup, "merge");
    assert.equal(r.ok, true);
    const back = collect(fresh, ORG);
    assert.deepEqual(back.assessments[P1].answers, collect(populated(), ORG).assessments[P1].answers);
    assert.deepEqual(back.assessments[P1].edited, ["quantity"]);
    assert.equal(back.requests.length, 1);
    assert.equal(back.drafts[`${P1}:hs`], "My edited brief");
    assert.equal(back.version, BACKUP_VERSION);
  });
  it("importing twice changes nothing the second time", () => {
    const parsed = parseBackup(serialize(collect(populated(), ORG)));
    const fresh = memory();
    applyRestore(fresh, ORG, parsed.backup, "merge");
    const first = JSON.stringify(collect(fresh, ORG).assessments);
    const again = applyRestore(fresh, ORG, parsed.backup, "merge");
    assert.equal(JSON.stringify(collect(fresh, ORG).assessments), first);
    assert.deepEqual(again.plan.addAssessments, []);
    assert.deepEqual(again.plan.replaceOlder, []);
  });
});

describe("safety", () => {
  it("refuses a file that belongs to another company", () => {
    const parsed = parseBackup(serialize(collect(populated(), ORG)));
    const r = applyRestore(memory(), OTHER, parsed.backup, "merge");
    assert.equal(r.ok, false);
    assert.match(r.error, /different company/);
  });
  it("rejects invalid, foreign, newer-version and oversized files without touching anything", () => {
    assert.match(parseBackup("not json").error, /not JSON/);
    assert.match(parseBackup(JSON.stringify({ hello: 1 })).error, /not an Export Enablement/);
    assert.match(parseBackup(JSON.stringify({ format: "export-enablement-workspace", version: 99, organizationId: ORG })).error, /newer version/);
    assert.match(parseBackup(JSON.stringify({ format: "export-enablement-workspace", version: 1 })).error, /which company/);
    assert.match(parseBackup("x".repeat(5_000_001)).error, /too large/);
  });
  it("skips unreadable parts with a warning instead of failing everything", () => {
    const text = JSON.stringify({ format: "export-enablement-workspace", version: 1, organizationId: ORG, assessments: { [P1]: { v: 99 }, "bad ref!": {}, [P2]: assessment(P2, "2026-10-01T00:00:00Z") }, requests: "nope", drafts: { "bad key": "x", [`${P1}:hs`]: "ok" }, capacity: { [P1]: "not json" } });
    const r = parseBackup(text);
    assert.equal(r.ok, true);
    assert.deepEqual(Object.keys(r.backup.assessments), [P2]);
    assert.ok(r.warnings.length >= 2);
    assert.deepEqual(r.backup.requests, []);
    assert.deepEqual(Object.keys(r.backup.drafts), [`${P1}:hs`]);
  });
  it("hostile values are coerced like any saved assessment", () => {
    const evil = { ...assessment(P1, "2026-10-01T00:00:00Z"), inputs: { ...sampleInputs(), productLabel: "x\u0000y", unitsPerCarton: "free" } };
    const r = parseBackup(JSON.stringify({ format: "export-enablement-workspace", version: 1, organizationId: ORG, assessments: { [P1]: evil } }));
    assert.equal(r.backup.assessments[P1].inputs.productLabel, "x y");
    assert.equal(r.backup.assessments[P1].inputs.unitsPerCarton, sampleInputs().unitsPerCarton);
  });
});

describe("merge versus replace", () => {
  const local = collect(populated(), ORG);
  const incomingOlder = { ...local, assessments: { [P1]: assessment(P1, "2026-09-01T00:00:00Z", { edited: ["inrPerAed"] }), [P2]: assessment(P2, "2026-11-01T00:00:00Z", { edited: ["quantity"] }), ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"]: assessment("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "2026-11-01T00:00:00Z") }, requests: [], drafts: {}, capacity: {} };
  it("merge never overwrites newer local work", () => {
    const p = planRestore(local, incomingOlder, "merge");
    assert.deepEqual(p.keepLocal, [P1]);
    assert.deepEqual(p.replaceOlder, [P2]);
    assert.deepEqual(p.addAssessments, ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"]);
    assert.deepEqual(p.replaceNewer, []);
    const store = populated();
    applyRestore(store, ORG, incomingOlder, "merge");
    assert.deepEqual(collect(store, ORG).assessments[P1].edited, ["quantity"], "the newer local copy is kept");
    assert.deepEqual(collect(store, ORG).assessments[P2].edited, ["quantity"], "the newer file copy replaced the older local one");
  });
  it("replace overwrites newer local work and says so in the plan", () => {
    const p = planRestore(local, incomingOlder, "replace");
    assert.deepEqual(p.replaceNewer, [P1]);
    const store = populated();
    applyRestore(store, ORG, incomingOlder, "replace");
    assert.deepEqual(collect(store, ORG).assessments[P1].edited, ["inrPerAed"]);
  });
  it("never deletes: local products missing from the file stay", () => {
    const store = populated();
    applyRestore(store, ORG, { ...incomingOlder, assessments: {} }, "replace");
    assert.deepEqual(Object.keys(collect(store, ORG).assessments).sort(), [P1, P2]);
  });
  it("requests merge by id, preferring the newer", () => {
    const store = populated();
    const incoming = { ...local, assessments: {}, requests: [request("req-abcdef000001", "2026-12-01T00:00:00Z", { status: "sent" }), request("req-abcdef000002", "2026-11-01T00:00:00Z")], drafts: {}, capacity: {} };
    applyRestore(store, ORG, incoming, "merge");
    const rs = collect(store, ORG).requests;
    assert.equal(rs.length, 2);
    assert.equal(rs.find((r) => r.id === "req-abcdef000001").status, "sent");
  });
});

describe("device status", () => {
  it("reports what is saved on this device and when it last changed", () => {
    const s = deviceStatus(collect(populated(), ORG));
    assert.equal(s.assessments, 2);
    assert.equal(s.requests, 1);
    assert.equal(s.drafts, 1);
    assert.equal(s.lastSaved, "2026-10-02T10:00:00Z");
    assert.equal(deviceStatus(collect(memory(), ORG)).lastSaved, null);
  });
});
