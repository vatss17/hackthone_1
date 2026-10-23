// Confirmed photo and voice values land in the existing forms without conversion or invention.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { labelToMaterial, materialFromText, nameplateToMachine, processFromText, splitQuantity, toProductForm } from "../../src/lib/ai-input/mappings.ts";
import { localExtractFactory } from "../../src/lib/ai-input/local-extract.ts";

const f = (key, value, unit = null) => ({ key, value, unit });

describe("nameplate to machine form", () => {
  it("fills make, model, name, and a clamp rating only when the unit is tonnes", () => {
    const m = nameplateToMachine([f("manufacturer", "TESTCO"), f("model", "TC-150-ADS"), f("clamping_force", "150 T", "T"), f("machine_type", "Injection moulding machine")]);
    assert.deepEqual(m.values, { make: "TESTCO", model: "TC-150-ADS", name: "TESTCO TC-150-ADS", ratingValue: "150", ratingUnit: "tonnes_clamp_force" });
    assert.equal(m.process, "injection_moulding");
  });
  it("never converts units: kN is left for the person", () => {
    const m = nameplateToMachine([f("clamping_force", "1500 kN", "kN")]);
    assert.equal(m.values.ratingValue, undefined);
    assert.match(m.unmapped[0].reason, /does not convert units/);
  });
  it("does not treat the year of manufacture as the year installed", () => {
    const m = nameplateToMachine([f("year", "2019")]);
    assert.equal(m.values.yearInstalled, undefined);
    assert.match(m.unmapped[0].reason, /year of manufacture/);
  });
  it("keeps power and voltage as reference only", () => {
    const m = nameplateToMachine([f("power", "22 kW"), f("voltage", "3 PH 415 V")]);
    assert.deepEqual(m.unmapped.map((u) => u.key), ["power", "voltage"]);
  });
  it("uses a screw diameter rating only in millimetres, and prefers the clamp force", () => {
    assert.equal(nameplateToMachine([f("screw_diameter", "45 mm", "mm")]).values.ratingUnit, "mm_screw_diameter");
    assert.equal(nameplateToMachine([f("screw_diameter", "45 mm", "mm"), f("clamping_force", "90 t", "t")]).values.ratingUnit, "tonnes_clamp_force");
  });
});

describe("label to material", () => {
  it("finds the polymer from a printed name or grade, and keeps the grade for the person", () => {
    const m = labelToMaterial([f("polymer_type", "Polypropylene homopolymer"), f("grade", "PP H110MA")]);
    assert.equal(m.material, "PP");
    assert.deepEqual(m.unmapped.map((u) => u.key), ["grade"]);
  });
  it("picks no polymer from a grade code alone", () => {
    assert.equal(labelToMaterial([f("grade", "H110MA")]).material, null);
    assert.equal(materialFromText("HDPE"), "HDPE");
    assert.equal(materialFromText("LLDPE film grade"), "LLDPE");
    assert.equal(materialFromText("High-density polyethylene"), "HDPE");
    assert.equal(materialFromText("unknown"), null);
  });
});

describe("photo or drawing to product form", () => {
  it("takes weight only in grams, and turns dimensions into spec rows with printed units", () => {
    const p = toProductForm([f("product_name", "Storage bin lid"), f("weight", "180 g"), f("dimension_1", "250 mm"), f("dimension_2", "150", "mm"), f("material", "PP"), f("tolerance_1", "+/- 0.5 mm")]);
    assert.equal(p.values.name, "Storage bin lid");
    assert.equal(p.values.unitWeightG, "180");
    assert.deepEqual(p.specs.map((s) => [s.name, s.value, s.unit]), [["Dimension 1", "250", "mm"], ["Dimension 2", "150", "mm"], ["Material", "PP", ""], ["Tolerance 1", "+/- 0.5 mm", ""]]);
  });
  it("does not convert kilograms to grams", () => {
    const p = toProductForm([f("weight", "1.9 kg")]);
    assert.equal(p.values.unitWeightG, undefined);
    assert.equal(p.specs[0].unit, "kg");
  });
  it("keeps a guessed material labelled as to confirm", () => {
    assert.equal(toProductForm([f("likely_material", "PP")]).specs[0].name, "Material (to confirm)");
  });
  it("caps specification rows at the five the form has", () => {
    const many = Array.from({ length: 9 }, (_, i) => f(`dimension_${i + 1}`, `${i + 1} mm`));
    assert.equal(toProductForm(many).specs.length, 5);
  });
});

describe("helpers", () => {
  it("splits quantities and recognises processes in three languages", () => {
    assert.deepEqual(splitQuantity("150 T", null), { number: "150", unit: "T" });
    assert.deepEqual(splitQuantity("150", "tonnes"), { number: "150", unit: "tonnes" });
    assert.equal(splitQuantity("n/a", null), null);
    assert.equal(processFromText("इंजेक्शन मोल्डिंग मशीन"), "injection_moulding");
    assert.equal(processFromText("એક્સ્ટ્રુડર"), "extrusion");
  });
});

describe("offline field finder (no AI needed)", () => {
  const summary = (s) => localExtractFactory(s).map((r) => `${r.kind}:${r.code ?? r.process}${r.count ? `x${r.count}` : ""}`);
  it("handles the brief's example in English, Hindi, Gujarati and Hinglish", () => {
    const want = ["process:injection_moulding", "machine:injection_mouldingx3", "material:PP", "material:HDPE"];
    assert.deepEqual(summary("I have three injection moulding machines and use PP and HDPE"), want);
    assert.deepEqual(summary("मेरे पास तीन इंजेक्शन मोल्डिंग मशीन हैं और पीपी और एचडीपीई इस्तेमाल करते हैं"), want);
    assert.deepEqual(summary("મારી પાસે ત્રણ ઇન્જેક્શન મોલ્ડિંગ મશીન છે અને PP તથા HDPE વાપરીએ છીએ"), want);
    assert.deepEqual(summary("mere paas teen injection moulding machine hai, PP aur HDPE use karte hain"), want);
  });
  it("matches nothing it does not know", () => {
    assert.deepEqual(summary("We sell furniture and have a nice office"), []);
    assert.deepEqual(summary("pet owners love our shop"), ["material:PET"]); // a known word is a known word: the person reviews and unticks it
  });
});

describe("tonnes written in Hindi or Gujarati", () => {
  it("is read as a clamp rating", async () => {
    const { parseRating } = await import("../../src/lib/start/capability.ts");
    assert.deepEqual(parseRating("150 ટન"), { value: 150, unit: "tonnes_clamp_force" });
    assert.deepEqual(parseRating("90 टन"), { value: 90, unit: "tonnes_clamp_force" });
    assert.deepEqual(parseRating("150 tonnes"), { value: 150, unit: "tonnes_clamp_force" });
  });
});
