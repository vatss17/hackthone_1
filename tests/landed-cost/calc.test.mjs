// Pure unit tests: landed cost, margin, scenarios, persistence and summary wording. No network.
// Every expected number below was worked out by hand (see the arithmetic in the comments).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculate, freightHeadroomPct, round2, sensitivities, validateInputs, totalUnits, cartonCount } from "../../src/lib/landed-cost/calc.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";
import { DEFAULT_SCENARIOS, applyScenario, compareScenarios } from "../../src/lib/landed-cost/scenarios.ts";
import { coerceInputs, newAssessment, parseAssessment } from "../../src/lib/landed-cost/assessment.ts";
import { executiveSummary, missingInformation, nextActions } from "../../src/lib/landed-cost/summary.ts";

const line = (amount, basis, currency = "INR", confirmed = false) => ({ amount, basis, currency, confirmed });

// A worked example with round numbers.
//   10,000 units, 25 per carton -> 400 cartons. FX: 24 INR per AED.
//   goods 10,000 x 100                    = 1,000,000
//   packaging 400 x 40                    =    16,000
//   inland freight                        =    20,000
//   export handling                       =    10,000
//   international freight AED 5,000 x 24  =   120,000
//   insurance 0.5% x (1,000,000+16,000)   =     5,080
//   destination clearing AED 1,000 x 24   =    24,000
//   duty 5% x CIF cost base (1,171,080)   =    58,554
//   total                                 = 1,253,634
const worked = () => ({
  ...sampleInputs(),
  quantity: 10000,
  quantityUnit: "units",
  unitsPerCarton: 25,
  cartonGrossWeightKg: 5,
  cartonLengthMm: 500,
  cartonWidthMm: 400,
  cartonHeightMm: 300,
  unitProductionCostInr: 100,
  lines: {
    packaging: line(40, "per_carton"),
    inlandFreight: line(20000, "per_consignment"),
    exportHandling: line(10000, "per_consignment"),
    internationalFreight: line(5000, "per_consignment", "AED"),
    insurance: line(0.5, "percent_of_goods"),
    destinationClearing: line(1000, "per_consignment", "AED"),
    otherCharges: line(0, "per_consignment"),
    otherDestination: line(0, "per_consignment", "AED"),
  },
  inrPerAed: 24,
  sellingPriceAed: 7,
  duty: { ratePercent: 5, basis: "cif_cost", preferentialRatePercent: 0, applyPreference: false },
  targetMarginPercent: 20,
});

const lineOf = (r, key) => r.lines.find((l) => l.key === key).totalInr;

describe("landed cost: the worked example", () => {
  const r = calculate(worked());

  it("counts units and cartons", () => {
    assert.equal(r.units, 10000);
    assert.equal(r.cartons, 400);
    assert.equal(r.grossWeightKg, 2000); // 400 x 5 kg
    assert.equal(r.volumeCbm, 24); // 0.06 m3 x 400
  });

  it("builds each line exactly once", () => {
    assert.equal(r.goodsInr, 1000000);
    assert.equal(lineOf(r, "packaging"), 16000);
    assert.equal(lineOf(r, "inlandFreight"), 20000);
    assert.equal(lineOf(r, "exportHandling"), 10000);
    assert.equal(lineOf(r, "internationalFreight"), 120000); // AED 5,000 x 24
    assert.equal(lineOf(r, "insurance"), 5080);
    assert.equal(lineOf(r, "destinationClearing"), 24000); // AED 1,000 x 24
    assert.equal(r.dutyBaseInr, 1171080); // goods + packaging + inland + handling + freight + insurance
    assert.equal(r.dutyInr, 58554);
  });

  it("totals, per unit and in both currencies", () => {
    assert.equal(r.totalCostInr, 1253634);
    assert.equal(r.totalCostAed, 52234.75); // 1,253,634 / 24
    assert.equal(r.landedPerUnitInr, 125.36); // 125.3634
    assert.equal(r.landedPerUnitAed, 5.22); // 5.223475
  });

  it("revenue, profit, margin and markup are different things", () => {
    assert.equal(r.revenueInr, 1680000); // 7 x 24 x 10,000
    assert.equal(r.grossProfitInr, 426366);
    assert.equal(r.grossProfitAed, 17765.25);
    assert.equal(r.grossMarginPct, 25.38); // 426,366 / 1,680,000
    assert.equal(r.markupPct, 34.01); // 426,366 / 1,253,634
    assert.notEqual(r.grossMarginPct, r.markupPct);
  });

  it("break-even price and the price for the target margin", () => {
    assert.equal(r.breakEvenPriceInr, 125.36);
    assert.equal(r.breakEvenPriceAed, 5.22);
    assert.equal(r.priceForTargetMarginAed, 6.53); // 125.3634 / 0.8 / 24 = 6.5293
  });

  it("the lines always add up exactly to the total", () => {
    assert.equal(round2(r.lines.reduce((n, l) => n + l.totalInr, 0)), r.totalCostInr);
  });
});

describe("landed cost: duty basis, preference and units", () => {
  it("duty on the selling price: break-even solves with price on both sides", () => {
    const i = { ...worked(), duty: { ...worked().duty, basis: "selling_price" } };
    const r = calculate(i);
    assert.equal(r.dutyBaseInr, 1680000);
    assert.equal(r.dutyInr, 84000);
    assert.equal(r.totalCostInr, 1279080);
    assert.equal(r.grossProfitInr, 400920);
    assert.equal(r.grossMarginPct, 23.86);
    assert.equal(r.breakEvenPriceAed, 5.24); // 1,195,080 / (10,000 x 0.95) / 24 = 5.2416
    // At that price profit is zero (to within rounding of the 2-decimal price)
    const at = calculate({ ...i, sellingPriceAed: 1195080 / (10000 * 0.95) / 24 });
    assert.ok(Math.abs(at.grossProfitInr) < 1, `profit ${at.grossProfitInr}`);
  });

  it("a hypothetical preferential rate is only applied when switched on", () => {
    const base = calculate(worked());
    const pref = calculate({ ...worked(), duty: { ...worked().duty, applyPreference: true } });
    assert.equal(base.dutyInr, 58554);
    assert.equal(pref.dutyInr, 0);
    assert.equal(pref.totalCostInr, 1195080);
    assert.equal(pref.grossMarginPct, 28.86);
  });

  it("quantity in cartons converts to units", () => {
    const i = { ...worked(), quantity: 400, quantityUnit: "cartons" };
    assert.equal(totalUnits(i), 10000);
    assert.equal(cartonCount(i), 400);
    assert.equal(calculate(i).totalCostInr, 1253634);
  });

  it("partial cartons round up for carton-based charges", () => {
    const i = { ...worked(), quantity: 10010 };
    assert.equal(cartonCount(i), 401);
    assert.equal(lineOf(calculate(i), "packaging"), 16040);
  });

  it("per kg and per cubic metre bases use the carton data", () => {
    const i = worked();
    i.lines.inlandFreight = line(10, "per_kg"); // 2,000 kg
    i.lines.exportHandling = line(1000, "per_cbm"); // 24 m3
    const r = calculate(i);
    assert.equal(lineOf(r, "inlandFreight"), 20000);
    assert.equal(lineOf(r, "exportHandling"), 24000);
  });

  it("an AED line is converted with the user's rate, an INR line is not", () => {
    const i = worked();
    i.inrPerAed = 25;
    assert.equal(lineOf(calculate(i), "internationalFreight"), 125000);
    assert.equal(lineOf(calculate(i), "inlandFreight"), 20000);
  });

  it("zero revenue gives no margin instead of a wrong one", () => {
    const r = calculate({ ...worked(), sellingPriceAed: 0 });
    assert.equal(r.grossMarginPct, null);
    assert.ok(r.grossProfitInr < 0);
  });

  it("an unreachable target margin returns null when duty is on the selling price", () => {
    const i = { ...worked(), targetMarginPercent: 96, duty: { ...worked().duty, basis: "selling_price" } };
    assert.equal(calculate(i).priceForTargetMarginAed, null);
  });

  it("confirmed charges are counted separately from estimates", () => {
    const i = worked();
    i.lines.internationalFreight.confirmed = true;
    const r = calculate(i);
    assert.equal(r.confirmedSharePct, round2((120000 / 1253634) * 100)); // 9.57
    assert.ok(!r.lines.find((l) => l.key === "duty").confirmed && !r.lines.find((l) => l.key === "goods").confirmed);
  });
});

describe("validation", () => {
  it("rejects nonsense and says which field", () => {
    const bad = { ...worked(), quantity: 0, inrPerAed: -1, sellingPriceAed: NaN };
    const v = validateInputs(bad);
    assert.ok(v.errors.quantity && v.errors.inrPerAed && v.errors.sellingPriceAed);
    assert.throws(() => calculate(bad));
  });
  it("rejects fractional units and carton counts, duty above 100, partial dimensions", () => {
    assert.ok(validateInputs({ ...worked(), quantity: 10.5 }).errors.quantity);
    assert.ok(validateInputs({ ...worked(), unitsPerCarton: 0 }).errors.unitsPerCarton);
    assert.ok(validateInputs({ ...worked(), duty: { ...worked().duty, ratePercent: 101 } }).errors["duty.ratePercent"]);
    assert.ok(validateInputs({ ...worked(), cartonWidthMm: null }).errors.cartonLengthMm);
  });
  it("per kg needs a carton weight; percent of goods is insurance only", () => {
    const i = worked();
    i.cartonGrossWeightKg = null;
    i.lines.inlandFreight = line(10, "per_kg");
    assert.ok(validateInputs(i).errors["lines.inlandFreight.basis"]);
    const j = worked();
    j.lines.packaging = line(1, "percent_of_goods");
    assert.ok(validateInputs(j).errors["lines.packaging.basis"]);
  });
  it("warns, without blocking, about zero duty and applied preference", () => {
    const w = validateInputs({ ...worked(), duty: { ...worked().duty, ratePercent: 0, applyPreference: true } }).warnings.join(" ");
    assert.match(w, /0%/);
    assert.match(w, /not been verified/);
  });
});

describe("sensitivities and freight headroom", () => {
  it("price down 10% is worked out exactly", () => {
    const s = sensitivities(worked()).find((x) => x.key === "price-");
    assert.equal(s.marginPct, 17.09); // revenue 1,512,000, profit 258,366
    assert.equal(s.deltaPp, -8.29);
  });
  it("freight up 10% costs margin; down 10% adds it", () => {
    const all = sensitivities(worked());
    assert.ok(all.find((x) => x.key === "intlFreight+").deltaPp < 0);
    assert.ok(all.find((x) => x.key === "intlFreight-").deltaPp > 0);
  });
  it("freight can rise 338.39% before profit reaches zero", () => {
    // profit 426,366; each +100% of freight costs 120,000 + 5% duty on it = 126,000
    assert.equal(freightHeadroomPct(worked()), 338.39); // 426,366 / 126,000 = 3.38386
  });
  it("headroom is 0 when already loss-making and null with no freight", () => {
    assert.equal(freightHeadroomPct({ ...worked(), sellingPriceAed: 1 }), 0);
    const i = worked();
    i.lines.internationalFreight = line(0, "per_consignment");
    assert.equal(freightHeadroomPct(i), null);
  });
});

describe("scenario comparison", () => {
  const rows = compareScenarios(worked(), DEFAULT_SCENARIOS);
  const byId = (id) => rows.find((r) => r.scenario.id === id);

  it("the base case has zero differences", () => {
    assert.equal(byId("base").delta.marginPp, 0);
    assert.equal(byId("base").delta.profitAed, 0);
    assert.equal(byId("base").result.totalCostInr, 1253634);
  });
  it("higher freight (+30%) adds freight and the duty on it", () => {
    // freight 156,000 (+36,000), duty +1,800 -> total 1,291,434, profit 388,566, margin 23.13%
    const r = byId("freight").result;
    assert.equal(r.totalCostInr, 1291434);
    assert.equal(r.grossMarginPct, 23.13);
    assert.equal(byId("freight").delta.marginPp, -2.25);
  });
  it("a better price (+10%) changes revenue and margin only", () => {
    const r = byId("price").result;
    assert.equal(r.totalCostInr, 1253634);
    assert.equal(r.revenueInr, 1848000);
    assert.equal(r.grossMarginPct, 32.16);
    assert.equal(byId("price").delta.priceAed, 0.7);
  });
  it("the preferential scenario is hypothetical and not applicable without a lower rate", () => {
    assert.equal(byId("tariff").result.dutyInr, 0);
    const none = compareScenarios({ ...worked(), duty: { ...worked().duty, preferentialRatePercent: 5 } }, DEFAULT_SCENARIOS);
    const t = none.find((r) => r.scenario.id === "tariff");
    assert.equal(t.applicable, false);
    assert.match(t.reason, /would change nothing/);
    assert.equal(t.result, null);
  });
  it("verdicts compare against the user's target margin", () => {
    assert.equal(byId("base").verdict, "meets_target"); // 25.38% vs 20%
    const low = compareScenarios({ ...worked(), targetMarginPercent: 30 }, DEFAULT_SCENARIOS);
    assert.equal(low.find((r) => r.scenario.id === "base").verdict, "below_target");
    const loss = compareScenarios({ ...worked(), sellingPriceAed: 4 }, DEFAULT_SCENARIOS);
    assert.equal(loss.find((r) => r.scenario.id === "base").verdict, "loss");
  });
  it("editing the base flows into every scenario without retyping", () => {
    const moved = compareScenarios({ ...worked(), unitProductionCostInr: 110 }, DEFAULT_SCENARIOS);
    assert.ok(moved.find((r) => r.scenario.id === "freight").result.totalCostInr > byId("freight").result.totalCostInr);
  });
  it("applyScenario leaves the base inputs untouched", () => {
    const base = worked();
    applyScenario(base, DEFAULT_SCENARIOS[1]);
    assert.equal(base.lines.internationalFreight.amount, 5000);
  });
});

describe("properties over many inputs", () => {
  // A small deterministic generator, so a failure is reproducible.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const randomInputs = () => {
    const i = worked();
    i.quantity = 1 + Math.floor(rnd() * 50000);
    i.unitsPerCarton = 1 + Math.floor(rnd() * 100);
    i.unitProductionCostInr = round2(rnd() * 500);
    i.inrPerAed = round2(15 + rnd() * 15);
    i.sellingPriceAed = round2(rnd() * 40);
    i.duty = { ratePercent: round2(rnd() * 30), basis: pick(["cif_cost", "selling_price"]), preferentialRatePercent: 0, applyPreference: rnd() > 0.7 };
    for (const k of Object.keys(i.lines)) i.lines[k] = line(round2(rnd() * 100000), pick(["per_consignment", "per_unit", "per_carton"]), pick(["INR", "AED"]));
    i.lines.insurance = line(round2(rnd() * 2), "percent_of_goods");
    return i;
  };

  it("total = sum of lines, profit = revenue - total, for 300 random inputs", () => {
    for (let n = 0; n < 300; n++) {
      const r = calculate(randomInputs());
      assert.equal(round2(r.lines.reduce((s, l) => s + l.totalInr, 0)), r.totalCostInr);
      assert.equal(round2(r.revenueInr - r.totalCostInr), r.grossProfitInr);
      assert.ok(r.landedPerUnitAed >= 0);
    }
  });

  it("selling at the break-even price gives zero profit, and at the target-margin price gives the target margin", () => {
    for (let n = 0; n < 300; n++) {
      const i = randomInputs();
      const r = calculate(i);
      const tol = r.units * 0.006 * i.inrPerAed + 2; // price is rounded to 2 decimals
      if (Number.isFinite(r.breakEvenPriceAed) && r.breakEvenPriceAed > 0) {
        const at = calculate({ ...i, sellingPriceAed: r.breakEvenPriceAed });
        assert.ok(Math.abs(at.grossProfitInr) <= tol, `case ${n}: profit ${at.grossProfitInr} tol ${tol}`);
      }
      if (r.priceForTargetMarginAed !== null && r.priceForTargetMarginAed > 0) {
        const at = calculate({ ...i, sellingPriceAed: r.priceForTargetMarginAed });
        assert.ok(Math.abs(at.grossMarginPct - i.targetMarginPercent) < 0.5 + 100 / (r.units * i.inrPerAed * r.priceForTargetMarginAed || 1), `case ${n}: margin ${at.grossMarginPct}`);
      }
    }
  });
});

describe("saved assessments are untrusted input", () => {
  const defaults = sampleInputs();
  it("a damaged or hostile file cannot produce an invalid model", () => {
    const hostile = JSON.stringify({
      v: 1,
      inputs: { quantity: -5, inrPerAed: "free", sellingPriceAed: 1e30, productLabel: "x\u0000y", lines: { packaging: { amount: -1, basis: "hack", currency: "USD" } }, duty: { ratePercent: 500 } },
      edited: ["ok", 5, "x".repeat(100)],
      scenarios: [{ kind: "base", freightPct: 9999 }, { name: "n", pricePct: 1e9 }, "junk"],
      checks: { "good.id": true, "bad id!": true, other: "yes" },
    });
    const a = parseAssessment(hostile, "ref", defaults);
    assert.equal(Object.keys(validateInputs(a.inputs).errors).length, 0);
    assert.equal(a.inputs.lines.packaging.basis, defaults.lines.packaging.basis);
    assert.equal(a.inputs.lines.packaging.currency, "INR");
    assert.equal(a.inputs.productLabel, "x y");
    assert.deepEqual(a.edited, ["ok"]);
    assert.deepEqual(Object.keys(a.checks), ["good.id"]);
    assert.equal(a.scenarios[0].kind, "base");
    assert.equal(a.scenarios[0].freightPct, 0, "the base scenario can never be altered");
    assert.ok(a.scenarios.every((s) => s.pricePct <= 500 && s.freightPct <= 500));
    assert.doesNotThrow(() => calculate(a.inputs));
  });
  it("rejects non-JSON, wrong versions and non-objects", () => {
    for (const bad of ["not json", "[]", "null", JSON.stringify({ v: 2 })]) assert.equal(parseAssessment(bad, "r", defaults), null);
  });
  it("round-trips a real assessment", () => {
    const a = newAssessment("r", worked());
    a.edited = ["quantity"];
    a.checks = { "q.one": true };
    const back = parseAssessment(JSON.stringify(a), "r", defaults);
    assert.deepEqual(back.inputs, a.inputs);
    assert.deepEqual(back.checks, a.checks);
  });
  it("coerceInputs keeps valid values and falls back field by field", () => {
    const c = coerceInputs({ quantity: 123, unitsPerCarton: "x" }, defaults);
    assert.equal(c.quantity, 123);
    assert.equal(c.unitsPerCarton, defaults.unitsPerCarton);
  });
});

describe("executive summary wording", () => {
  const fmt = { aed: (n) => `AED ${n}`, pct: (n) => (n === null ? "n/a" : `${n}%`) };
  const userEdited = () => ({ ...newAssessment("r", worked()), edited: ["unitProductionCostInr"] });

  it("matches the promised tone: manufacturing, commercial, then unverified regulation", () => {
    const s = executiveSummary({ fit: "good", assessment: userEdited(), format: fmt });
    assert.equal(s.sentences[0], "Promising manufacturing fit.");
    assert.match(s.sentences[1], /gross margin is 25.38%/);
    assert.match(s.sentences[1], /depends on/);
    assert.equal(s.sentences[2], "UAE regulatory requirements have not yet been verified.");
  });
  it("says the figures are illustrative while inputs are still samples", () => {
    const s = executiveSummary({ fit: "strong", assessment: newAssessment("r", worked()), format: fmt });
    assert.match(s.sentences[1], /illustrative/);
  });
  it("reports a loss plainly and never reads as approval or a guarantee", () => {
    const loss = { ...userEdited(), inputs: { ...worked(), sellingPriceAed: 3 } };
    const s = executiveSummary({ fit: "good", assessment: loss, format: fmt });
    assert.match(s.sentences[1], /loss/);
    assert.equal(s.tone, "caution");
    for (const fitLevel of ["strong", "good", "possible", "stretch", null]) {
      for (const a of [null, userEdited(), newAssessment("r", worked())]) {
        const text = executiveSummary({ fit: fitLevel, assessment: a, format: fmt }).sentences.join(" ");
        assert.ok(!/approved|guarantee|compliant|certified|eligible|will be profitable/i.test(text), text);
        assert.match(text, /regulatory requirements have not yet been verified/);
      }
    }
  });
  it("handles no estimate yet and no fit assessment", () => {
    const s = executiveSummary({ fit: null, assessment: null, format: fmt });
    assert.match(s.sentences[0], /not been assessed/);
    assert.match(s.sentences[1], /not been estimated/);
    assert.equal(s.numbers, null);
  });
});

describe("missing information and next actions", () => {
  it("always lists the unverified regulatory, duty, classification, CEPA and demand questions", () => {
    const ids = missingInformation({ assessment: null, hsClaimed: false, capabilityGaps: 2, ref: "r" }).map((m) => m.id);
    for (const id of ["own-inputs", "duty", "hs", "uae-reqs", "cepa", "demand", "gaps"]) assert.ok(ids.includes(id), id);
  });
  it("drops the sample-input item once the user has edited inputs", () => {
    const a = { ...newAssessment("r", worked()), edited: ["quantity"] };
    assert.ok(!missingInformation({ assessment: a, hsClaimed: true, capabilityGaps: 0, ref: "r" }).some((m) => m.id === "own-inputs"));
  });
  it("next actions point at real pages and track progress", () => {
    const a = { ...newAssessment("r", worked()), edited: ["quantity"] };
    const acts = nextActions({ assessment: a, ref: "r", checksResolved: 2, checksTotal: 5 });
    assert.ok(acts.every((x) => x.href.startsWith("/")));
    assert.equal(acts[0].done, true);
    assert.match(acts[3].note, /2 of 5/);
  });
});
