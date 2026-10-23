// Pure tests: capability guidance comes from the declared processes and never contradicts itself.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE, CATALOGUE_BY_ID } from "../../src/lib/opportunities/catalogue.ts";
import { matchEntry } from "../../src/lib/opportunities/engine.ts";

const factory = (processes, materials = [], machines = []) => ({
  processes: processes.map((code) => ({ code, label: code, capacityText: null })),
  materials: materials.map((code) => ({ code, label: code })),
  machines,
  factoryWideCapacity: null,
  products: [],
});
const trays = CATALOGUE_BY_ID["thermoformed-trays"];

describe("thermoforming guidance", () => {
  const declared = matchEntry(trays, factory(["thermoforming"], ["PP"]));
  it("a declared process is never also reported as missing", () => {
    assert.deepEqual(declared.missingProcesses, []);
    assert.ok(declared.guidance.requiredProcesses.every((p) => p.declared));
    const text = [...declared.reasons, ...declared.gaps].join(" ");
    assert.ok(!/thermoforming is not in your declared/i.test(text));
    assert.ok(!declared.gaps.some((g) => /not in your declared processes/.test(g)));
  });
  it("a declared process with no machine is described as exactly that", () => {
    assert.deepEqual(declared.guidance.missingMachinery, ["thermoforming"]);
    assert.ok(declared.gaps.some((g) => /declared thermoforming but list no machine/.test(g)));
  });
  it("extrusion is optional and sheet is a purchased input, not a missing capability", () => {
    assert.deepEqual(declared.guidance.optionalProcesses, [{ code: "extrusion", declared: false }]);
    assert.ok(declared.guidance.purchasedInputs.some((x) => /sheet/i.test(x)));
    assert.ok(declared.optional.some((o) => /Optional: extrusion/.test(o) && /bought in/.test(o)));
    assert.ok(!declared.gaps.some((g) => /extrusion/i.test(g)));
  });
  it("alternative grades are optional, never gaps", () => {
    assert.deepEqual(declared.guidance.alternativeMaterials.sort(), ["PET", "PS"]);
    assert.ok(declared.optional.some((o) => /Alternative grades/.test(o)));
    assert.ok(!declared.gaps.some((g) => /PET|PS/.test(g)));
  });
  it("without the process, it is genuinely required and missing, once", () => {
    const none = matchEntry(trays, factory(["injection_moulding"], ["PP"]));
    assert.deepEqual(none.missingProcesses, ["thermoforming"]);
    assert.equal(none.gaps.filter((g) => /Thermoforming is not in your declared/.test(g)).length, 1);
    assert.equal(none.level, "stretch");
    assert.deepEqual(none.guidance.requiredProcesses, [{ code: "thermoforming", declared: false, machineListed: false }]);
  });
  it("with a machine listed there is no machinery gap", () => {
    const withMachine = matchEntry(trays, factory(["thermoforming"], ["PP"], [{ processCode: "thermoforming", name: "Former", quantity: 1, ratingValue: 1, ratingUnit: "pieces_per_hour" }]));
    assert.deepEqual(withMachine.guidance.missingMachinery, []);
  });
  it("the catalogue text no longer claims a process is undeclared regardless of the factory", () => {
    assert.ok(!trays.whyUae.some((w) => /process you have not declared/.test(w)));
  });
});

describe("no entry contradicts itself for any factory", () => {
  it("a process is never both a matched requirement and a missing one", () => {
    for (const e of CATALOGUE) {
      const all = ["injection_moulding", "extrusion", "thermoforming", "blow_moulding", "rotational_moulding"];
      for (const have of [all, [], ["extrusion"], ["thermoforming"]]) {
        const m = matchEntry(e, factory(have, ["PP", "HDPE"]));
        for (const p of m.matchedProcesses) assert.ok(!m.missingProcesses.includes(p), `${e.id} ${p}`);
        for (const g of m.gaps) for (const p of m.matchedProcesses) assert.ok(!new RegExp(`${p.replace("_", " ")} is not in your declared`, "i").test(g), `${e.id}: ${g}`);
      }
    }
  });
});
