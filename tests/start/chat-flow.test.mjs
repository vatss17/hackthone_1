// The pure logic of the chat setup: reading an answer without AI, adding it to the answers without ever removing or overwriting,
// completeness, and the plain sentences the bot says. No React, no network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUESTIONS, FACTORY_SCRIPT, englishSay, describeFactoryDelta, describeMissing, describeProductDelta, factoryMissing, fallbackFactoryRows, firstQuestion, groupMachines,
  isFactoryReady, isProductReady, mergeFactory, mergeProduct, nextQuestion, productAiFromRows, productFollowUp, productMissing, productRows, progress, removeFactoryItem,
  setProductName, sizesIn, splitProductNames, normaliseMaterial,
} from "../../src/lib/start/chat-flow.ts";

const empty = () => ({ processes: [], materials: [], machines: [], products: [] });
const emptyP = () => ({ name: "", desc: "", material: "", use: "", weight: "", size: "" });
const read = (text, q = "make", cur = empty()) => mergeFactory(cur, fallbackFactoryRows(q, text, cur));

describe("question scripts", () => {
  it("asks the four factory questions in order, one at a time", () => {
    assert.deepEqual(FACTORY_SCRIPT, ["make", "materials", "machines", "products"]);
    assert.equal(firstQuestion("factory"), "make");
    assert.equal(nextQuestion("factory", "make"), "materials");
    assert.equal(nextQuestion("factory", "products"), null);
    assert.deepEqual(progress("factory", "materials"), { n: 2, total: 4 });
    assert.equal(QUESTIONS.make.text, "What does your factory make, and how?");
    assert.ok(QUESTIONS.materials.chips.filter((c) => c.kind === "toggle").map((c) => c.value).join() === "PP,HDPE,LDPE,PET,PVC,ABS");
    assert.ok(QUESTIONS.machines.chips.some((c) => c.label === "I'm not sure" && c.kind === "skip"));
  });
  it("asks the product name first, skips it when it is already known, and follows up only on what is missing", () => {
    assert.equal(firstQuestion("product", emptyP()), "name");
    assert.equal(firstQuestion("product", { ...emptyP(), name: "Crate" }), "details");
    assert.equal(nextQuestion("product", "name"), "details");
    assert.equal(nextQuestion("product", "details", { ...emptyP(), name: "Crate", material: "PP", use: "Storage" }), null);
    assert.equal(nextQuestion("product", "details", { ...emptyP(), name: "Crate", material: "PP" }), "follow_use");
    assert.equal(nextQuestion("product", "details", emptyP()), "follow_both");
    assert.equal(productFollowUp({ ...emptyP(), use: "Storage" }), "material");
    assert.equal(nextQuestion("product", "follow_both", emptyP()), null);
  });
});

describe("fallback reading of a factory answer (no AI)", () => {
  const summary = (text) => {
    const { next } = read(text);
    return { p: next.processes, m: next.materials, n: next.machines.length };
  };
  it("English: the brief's example", () => {
    assert.deepEqual(summary("I have three injection moulding machines and use PP and HDPE"), { p: ["injection_moulding"], m: ["PP", "HDPE"], n: 3 });
  });
  it("Hindi", () => {
    assert.deepEqual(summary("मेरे पास तीन इंजेक्शन मोल्डिंग मशीन हैं और पीपी और एचडीपीई इस्तेमाल करते हैं"), { p: ["injection_moulding"], m: ["PP", "HDPE"], n: 3 });
  });
  it("Gujarati", () => {
    assert.deepEqual(summary("મારી પાસે ત્રણ ઇન્જેક્શન મોલ્ડિંગ મશીન છે અને પીપી અને એચડીપીઈ વાપરીએ છીએ"), { p: ["injection_moulding"], m: ["PP", "HDPE"], n: 3 });
  });
  it("Hinglish", () => {
    assert.deepEqual(summary("mere paas teen injection moulding machine hain aur PP HDPE use karte hain"), { p: ["injection_moulding"], m: ["PP", "HDPE"], n: 3 });
  });
  it("reads a size said with a machine, in the units the platform stores", () => {
    assert.deepEqual(sizesIn("two machines of 150 tonnes and an 80 kg/h line"), ["150 tonnes", "80 kg/h"]);
    const { next } = read("2 injection moulding machines, 150 tonnes", "machines");
    assert.deepEqual(next.machines, [{ processCode: "injection_moulding", size: "150 tonnes" }, { processCode: "injection_moulding", size: "150 tonnes" }]);
  });
  it("takes a bare count for the one process already known, and never invents a count", () => {
    const cur = { ...empty(), processes: ["extrusion"] };
    assert.equal(read("3", "machines", cur).next.machines.length, 3);
    assert.equal(read("a few big ones", "machines", cur).next.machines.length, 0);
  });
  it("splits a list of products and says nothing when there is nothing", () => {
    assert.deepEqual(splitProductNames("storage crates, buckets and caps"), ["storage crates", "buckets", "caps"]);
    assert.deepEqual(read("storage crates\nbuckets", "products").next.products, ["storage crates", "buckets"]);
    assert.deepEqual(read("hello there").delta, { processes: [], materials: [], machines: [], products: [] });
  });
});

describe("adding to the answers", () => {
  it("never removes or overwrites what the person already chose", () => {
    const cur = { processes: ["extrusion"], materials: ["PET"], machines: [{ processCode: "extrusion", size: "80 kg/h" }], products: ["Pipes"] };
    const before = JSON.stringify(cur);
    const { next, delta } = read("three injection moulding machines and PP", "make", cur);
    assert.equal(JSON.stringify(cur), before, "the input is not mutated");
    assert.deepEqual(next.processes, ["extrusion", "injection_moulding"]);
    assert.deepEqual(next.materials, ["PET", "PP"]);
    assert.deepEqual(next.machines[0], { processCode: "extrusion", size: "80 kg/h" });
    assert.equal(next.machines.length, 4);
    assert.deepEqual(next.products, ["Pipes"]);
    assert.deepEqual(delta.materials, ["PP"]);
  });
  it("is idempotent: saying the same thing twice adds nothing", () => {
    const once = read("three injection moulding machines and PP and HDPE").next;
    const twice = mergeFactory(once, fallbackFactoryRows("make", "three injection moulding machines and PP and HDPE", once));
    assert.deepEqual(twice.next, once);
    assert.deepEqual(twice.delta, { processes: [], materials: [], machines: [], products: [] });
  });
  it("treats a machine count as a target and fills a blank size later without adding machines", () => {
    const a = read("3 injection moulding machines").next;
    const b = mergeFactory(a, [{ kind: "machine", process: "injection_moulding", count: 3, size: "150 tonnes", quote: null }]);
    assert.equal(b.next.machines.length, 3);
    assert.ok(b.next.machines.every((m) => m.size === "150 tonnes"));
    assert.deepEqual(b.delta.machines, [{ process: "injection_moulding", count: 3, size: "150 tonnes" }]);
    const c = mergeFactory(b.next, [{ kind: "machine", process: "injection_moulding", count: 5, size: "", quote: null }]);
    assert.equal(c.next.machines.length, 5);
  });
  it("de-duplicates products without regard to case and caps the lists", () => {
    const cur = { ...empty(), products: ["Buckets"] };
    const { next } = mergeFactory(cur, [{ kind: "product", name: " buckets ", quote: null }, { kind: "product", name: "Caps", quote: null }]);
    assert.deepEqual(next.products, ["Buckets", "Caps"]);
    const many = mergeFactory(empty(), [{ kind: "machine", process: "extrusion", count: 99, size: "", quote: null }]);
    assert.equal(many.next.machines.length, 30);
  });
  it("lets the person remove a chip, and a process takes its machines with it", () => {
    const a = read("three injection moulding machines and PP and HDPE").next;
    assert.deepEqual(removeFactoryItem(a, { kind: "material", code: "PP" }).materials, ["HDPE"]);
    const r = removeFactoryItem(a, { kind: "process", code: "injection_moulding" });
    assert.deepEqual([r.processes.length, r.machines.length], [0, 0]);
    assert.equal(removeFactoryItem(a, { kind: "machines", process: "injection_moulding", size: "" }).machines.length, 0);
    assert.deepEqual(groupMachines(a.machines), [{ process: "injection_moulding", size: "", count: 3 }]);
  });
});

describe("completeness", () => {
  it("only a process is needed for the first matches", () => {
    assert.equal(isFactoryReady(empty()), false);
    const a = read("we do extrusion").next;
    assert.equal(isFactoryReady(a), true);
    assert.deepEqual(factoryMissing(a), ["materials", "machines"]);
    assert.deepEqual(factoryMissing(read("three injection moulding machines and PP").next), []);
  });
  it("a product needs a name; material, use, weight and size are listed when missing", () => {
    assert.equal(isProductReady(emptyP()), false);
    assert.equal(isProductReady({ ...emptyP(), name: "Crate" }), true);
    assert.deepEqual(productMissing({ ...emptyP(), name: "Crate", material: "PP" }), ["use", "weight", "size"]);
    assert.deepEqual(productMissing({ ...emptyP(), material: "I don't know" }), ["material", "use", "weight", "size"]);
  });
});

describe("what the bot says", () => {
  it("summarises what was understood in plain words", () => {
    const { delta } = read("I have three injection moulding machines and use PP and HDPE");
    assert.equal(describeFactoryDelta(delta, englishSay), "Got it: 3 injection moulding machines, PP, HDPE.");
    assert.equal(describeFactoryDelta({ processes: [], materials: [], machines: [], products: [] }, englishSay), null);
    const sized = mergeFactory(empty(), [{ kind: "machine", process: "extrusion", count: 1, size: "80 kg/h", quote: null }]).delta;
    assert.equal(describeFactoryDelta(sized, englishSay), "Got it: 1 extrusion machine of 80 kg/h.");
  });
  it("names what is still missing without blocking", () => {
    const a = read("we do extrusion").next;
    assert.equal(describeMissing("factory", a, emptyP(), englishSay.t), "Still missing: plastics, machines. That is okay, you can add it later.");
    assert.match(describeMissing("factory", empty(), emptyP(), englishSay.t), /at least one process/);
    assert.equal(describeMissing("factory", read("three injection moulding machines and PP").next, emptyP(), englishSay.t), null);
  });
});

describe("product answers (Path A)", () => {
  const text = "PP crate, 1.9 kg, 600 x 400 x 250 mm, storing goods";
  it("reads the brief's example with the deterministic reader and keeps the text", () => {
    const { next, delta } = mergeProduct({ ...emptyP(), name: "Crate" }, { text });
    assert.deepEqual([next.material, next.use, next.weight, next.size], ["PP", "Storage", "1.9", "600 x 400 x 250"]);
    assert.equal(next.desc, text);
    assert.deepEqual(Object.keys(delta).sort(), ["material", "size", "use", "weight"]);
    assert.equal(describeProductDelta(delta, englishSay), "Got it: made of PP, used for Storage, weighs 1.9 kg, size 600 x 400 x 250 mm.");
    assert.equal(productFollowUp(next), null);
  });
  it("sets the name only when empty and never replaces a name or a chosen value", () => {
    assert.equal(setProductName(emptyP(), "  Stackable   crate ").next.name, "Stackable crate");
    assert.deepEqual(setProductName({ ...emptyP(), name: "Crate" }, "Other").delta, {});
    assert.equal(setProductName(emptyP(), "x").next.name, "");
    const cur = { ...emptyP(), name: "Crate", material: "HDPE", weight: "2" };
    const { next } = mergeProduct(cur, { text });
    assert.deepEqual([next.material, next.weight], ["HDPE", "2"]);
    assert.equal(next.size, "600 x 400 x 250");
  });
  it("lets an 'I don't know' material be filled later, and uses a short free answer as the use", () => {
    const a = mergeProduct({ ...emptyP(), name: "Tub", material: "I don't know" }, { text: "made of HDPE" }).next;
    assert.equal(a.material, "HDPE");
    const b = mergeProduct({ ...emptyP(), name: "Widget", material: "PP" }, { text: "storing goods in warehouses", askedUse: true });
    assert.equal(b.next.use, "storing goods in warehouses");
    assert.equal(mergeProduct({ ...emptyP(), name: "Widget", material: "PP" }, { text: "storing goods", askedUse: false }).next.use, "");
  });
  it("uses the AI's fields only to fill what is blank", () => {
    const ai = productAiFromRows([
      { kind: "field", key: "material", label: "Material", value: "PVC", quote: null },
      { kind: "field", key: "intended_use", label: "Intended use", value: "carrying water", quote: null },
      { kind: "field", key: "unit_weight_g", label: "Unit weight (g)", value: "1900", quote: null },
    ]);
    assert.deepEqual(ai, { material: "Another material", use: "carrying water", weightKg: "1.9" });
    const { next } = mergeProduct({ ...emptyP(), name: "Widget", material: "HDPE" }, { text: "a long thing", ai });
    assert.deepEqual([next.material, next.use, next.weight], ["HDPE", "carrying water", "1.9"]);
    assert.equal(normaliseMaterial("pp"), "PP");
    assert.equal(normaliseMaterial("nylon"), "Another material");
  });
  it("builds the rows the review step shows", () => {
    const a = mergeProduct({ ...emptyP(), name: "PP crate" }, { text: "1.9 kg" }).next;
    const rows = productRows(a);
    assert.deepEqual(rows.map((r) => [r.key, r.status]), [["name", "found"], ["material", "found"], ["use", "guess"], ["weightKg", "found"], ["size", "missing"]]);
    assert.equal(rows[3].value, "1.9");
  });
});

describe("a size said on its own", () => {
  it("applies to every unsized machine of the only process, not just one", () => {
    const first = read("We make crates using 3 injection moulding machines").next;
    const second = read("150 tonnes", "machines", first).next;
    assert.equal(second.machines.length, 3);
    assert.ok(second.machines.every((m) => m.size === "150 tonnes"));
  });
});
