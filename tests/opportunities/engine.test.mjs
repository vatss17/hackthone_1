// Pure unit tests: the catalogue and the rules-based matching engine. No server, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CATALOGUE, CATALOGUE_BY_ID, COMMON_CONSIDERATIONS } from "../../src/lib/opportunities/catalogue.ts";
import { THRESHOLDS, WEIGHTS, discover, matchEntry, recognise } from "../../src/lib/opportunities/engine.ts";

const PROCESSES = ["injection_moulding", "blow_moulding", "extrusion", "thermoforming", "rotational_moulding", "compression_moulding", "additive_manufacturing", "printing", "finishing"];
const MATERIALS = ["PP", "HDPE", "LDPE", "LLDPE", "PET", "PVC", "PS", "HIPS", "ABS", "PC", "PA", "PMMA", "TPE", "TPU"];

// The sample manufacturer used for the demo: injection moulding + extrusion, PP + HDPE.
const demo = {
  processes: [
    { code: "injection_moulding", label: "Injection moulding", capacityText: "180 tonnes per month" },
    { code: "extrusion", label: "Extrusion", capacityText: "90 tonnes per month" },
  ],
  materials: [
    { code: "PP", label: "PP" },
    { code: "HDPE", label: "HDPE" },
    { code: null, label: "Recycled PP regrind" },
  ],
  machines: [
    { processCode: "injection_moulding", name: "Injection press 150T", quantity: 3, ratingValue: 150, ratingUnit: "tonnes_clamp_force" },
    { processCode: "injection_moulding", name: "Injection press 250T", quantity: 1, ratingValue: 250, ratingUnit: "tonnes_clamp_force" },
    { processCode: "extrusion", name: "Extruder 65mm", quantity: 2, ratingValue: 65, ratingUnit: "mm_screw_diameter" },
  ],
  factoryWideCapacity: "300 tonnes per month",
  products: [
    { id: "p1", name: "Plastic containers", category: "Food and household containers", description: null },
    { id: "p2", name: "Plastic storage products", category: "Household storage", description: null },
  ],
};

describe("catalogue integrity", () => {
  it("ids are unique and every entry is complete", () => {
    assert.equal(new Set(CATALOGUE.map((e) => e.id)).size, CATALOGUE.length);
    for (const e of CATALOGUE) {
      assert.ok(e.name && e.summary && e.group, e.id);
      assert.ok(e.processes.requiredAll.length > 0 && e.processes.requiredAll.every((p) => PROCESSES.includes(p)), `${e.id}: required processes`);
      assert.ok((e.processes.helpful ?? []).every((p) => PROCESSES.includes(p)), `${e.id}: helpful processes`);
      assert.ok(e.materials.preferred.length > 0 && [...e.materials.preferred, ...e.materials.possible].every((m) => MATERIALS.includes(m)), `${e.id}: materials`);
      assert.ok(e.tooling.length > 0 && e.validations.length > 0 && e.whyUae.length > 0 && e.industries.length > 0 && e.regulatoryFocus.length > 0, `${e.id}: lists`);
      assert.ok(e.keywords.every((k) => k === k.toLowerCase()), `${e.id}: keywords lower-case`);
    }
    assert.equal(CATALOGUE_BY_ID["irrigation-drip"].name, "Drip irrigation tubing and fittings");
  });

  it("makes no unsourced claims: no figures and no 'required by law' wording in market or regulatory text", () => {
    const text = JSON.stringify(CATALOGUE.map((e) => [e.whyUae, e.industries, e.regulatoryFocus])) + JSON.stringify(COMMON_CONSIDERATIONS);
    assert.ok(!/\d+\s?%|\$\s?\d|USD|AED\s?\d|billion|million/i.test(text), "found a figure in market/regulatory text");
    assert.ok(!/\b(must comply|is required by law|are required by law|mandatory in the UAE|banned in the UAE)\b/i.test(text), "found a definitive legal statement");
  });

  it("every whyUae line is framed as a hypothesis or to be assessed or checked", () => {
    for (const e of CATALOGUE) {
      for (const line of e.whyUae) {
        assert.match(line, /hypothesis|to be assessed|to be explored|must be checked|to test/i, `${e.id}: "${line}"`);
      }
    }
  });
});

describe("recognising a manufacturer's own products", () => {
  it("matches whole words, not fragments", () => {
    assert.equal(recognise({ name: "Plastic containers", category: null, description: null })?.id, "food-storage-containers");
    assert.equal(recognise({ name: "Plastic storage products", category: null, description: null })?.id, "household-storage-boxes");
    assert.equal(recognise({ name: "Heavy capacity widget", category: null, description: null }), null, "'cap' must not match 'capacity'");
    assert.equal(recognise({ name: "Zzz", category: null, description: null }), null);
  });
  it("name outweighs description", () => {
    assert.equal(recognise({ name: "Garden planter", category: null, description: "a box" })?.id, "planters-and-nursery");
  });
});

describe("matching engine, demo manufacturer", () => {
  const d = discover(demo);

  it("recognises both current products and scores them against the factory", () => {
    assert.deepEqual(d.yourProducts.map((p) => p.entry?.id), ["food-storage-containers", "household-storage-boxes"]);
    assert.ok(d.yourProducts.every((p) => p.match.level === "strong"));
  });

  it("never suggests what the manufacturer already makes", () => {
    const ids = d.adjacent.map((m) => m.entry.id);
    assert.ok(!ids.includes("food-storage-containers") && !ids.includes("household-storage-boxes"));
  });

  it("suggests plausible adjacent products that use extrusion as well as injection moulding", () => {
    const ids = d.adjacent.map((m) => m.entry.id);
    for (const id of ["crates-and-baskets", "caps-and-closures", "planters-and-nursery", "irrigation-drip", "conduits-and-ducts"]) assert.ok(ids.includes(id), id);
  });

  it("puts the unused extrusion capability to work and says so", () => {
    assert.deepEqual(d.underusedProcesses, ["extrusion"]);
    const drip = d.adjacent.find((m) => m.entry.id === "irrigation-drip");
    assert.deepEqual(drip.putsToWork, ["extrusion"]);
    assert.deepEqual(d.adjacent.find((m) => m.entry.id === "caps-and-closures").putsToWork, []);
  });

  it("keeps products needing an undeclared process out of the main list and marks them as stretch", () => {
    assert.ok(d.adjacent.every((m) => m.missingProcesses.length === 0));
    const stretch = d.stretch.map((m) => m.entry.id);
    for (const id of ["blow-moulded-bottles", "thermoformed-trays", "rotomoulded-tanks"]) assert.ok(stretch.includes(id), id);
    assert.ok(d.stretch.every((m) => m.level === "stretch" && m.missingProcesses.length > 0));
  });

  it("ties every reason to the declared data and every score to its parts", () => {
    for (const m of d.adjacent) {
      assert.ok(m.reasons.length > 0);
      assert.equal(m.score, m.parts.reduce((n, p) => n + p.points, 0));
      assert.equal(m.parts.reduce((n, p) => n + p.max, 0), 100);
      assert.ok(m.parts.every((p) => p.points >= 0 && p.points <= p.max));
    }
    assert.deepEqual(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
    const caps = d.adjacent.find((m) => m.entry.id === "caps-and-closures");
    assert.ok(caps.reasons.some((r) => /injection moulding/i.test(r)) && caps.reasons.some((r) => /PP/.test(r)));
  });

  it("never reports high confidence (no market or regulatory evidence exists)", () => {
    for (const m of [...d.adjacent, ...d.stretch, ...d.yourProducts.map((p) => p.match)]) assert.ok(["medium", "low"].includes(m.confidence.level));
    assert.ok(d.adjacent.every((m) => /unverified|not verified/i.test(m.confidence.why) || m.confidence.level === "low"));
  });

  it("flags large products against the declared press size instead of pretending to know", () => {
    const chairs = d.adjacent.find((m) => m.entry.id === "stackable-furniture");
    assert.ok(chairs.gaps.some((g) => /250 tonnes/.test(g) && /toolmaker/.test(g)));
    assert.ok(chairs.parts.find((p) => p.key === "machines").points <= 8);
  });

  it("is deterministic and sorted best-first", () => {
    assert.deepEqual(discover(demo).adjacent.map((m) => m.entry.id), d.adjacent.map((m) => m.entry.id));
    const scores = d.adjacent.map((m) => m.score);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  });
});

describe("matching engine, edge cases", () => {
  const empty = { processes: [], materials: [], machines: [], factoryWideCapacity: null, products: [] };

  it("suggests nothing when no process is declared", () => {
    const d = discover(empty);
    assert.equal(d.profileTooThin, true);
    assert.equal(d.adjacent.length + d.stretch.length, 0);
  });

  it("custom (unrecognised) processes and materials never match catalogue rules", () => {
    const d = discover({ ...empty, processes: [{ code: null, label: "Solvent welding", capacityText: null }], materials: [{ code: null, label: "Bio blend" }] });
    assert.equal(d.profileTooThin, true);
  });

  it("a process with no machinery or materials scores lower and says what is missing", () => {
    const m = matchEntry(CATALOGUE_BY_ID["caps-and-closures"], { ...empty, processes: [{ code: "injection_moulding", label: "Injection moulding", capacityText: null }] });
    assert.ok(m.score < THRESHOLDS.good);
    assert.equal(m.confidence.level, "low");
    assert.ok(m.gaps.some((g) => /machine/i.test(g)) && m.gaps.some((g) => /material/i.test(g)) && m.gaps.some((g) => /capacity/i.test(g)));
  });

  it("an unrecognised own product gets no catalogue match and no invented score", () => {
    const d = discover({ ...demo, products: [{ id: "x", name: "Zzz widget", category: null, description: null }] });
    assert.equal(d.yourProducts[0].entry, null);
    assert.equal(d.yourProducts[0].match, null);
  });
});
