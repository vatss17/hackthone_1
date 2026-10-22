// Pure tests for the UAE trade-evidence module. They use a SYNTHETIC fixture (invented round numbers),
// never the restricted UN Comtrade snapshot, so the test suite contains no third-party data.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_HEADINGS, GENERAL_LIMITATIONS, HEADINGS_FOR_ENTRY, HEADING_LABELS, NOT_LOADED_REASON, SNAPSHOT_FILE, SOURCE, createEvidence, loadSnapshot, parseSnapshot } from "../../src/lib/trade/evidence.ts";
import { fmtTonnes, fmtUsd } from "../../src/lib/trade/format.ts";
import { CATALOGUE } from "../../src/lib/opportunities/catalogue.ts";

const pt = (valueUsd, classification = "H6", netWeightKg = valueUsd / 4) => ({ valueUsd, netWeightKg, classification, isAggregate: false });
const years = (cls) => Object.fromEntries([2019, 2020, 2021, 2022, 2023].map((y, i) => [String(y), pt((i + 1) * 1_000_000, y < 2022 ? "H5" : cls)]));
const fixture = () => ({
  source: { name: "synthetic fixture", publisher: "test", url: "https://example.invalid", retrieved: "2026-01-01", licence: "none" },
  flows: {
    uaeImportsFromWorld: { data: Object.fromEntries(ALL_HEADINGS.map((h) => [h, { ...years("H6"), 2021: pt(3_000_000, "H5", null) }])) },
    indiaExportsToUae: { data: Object.fromEntries(ALL_HEADINGS.map((h) => [h, Object.fromEntries([2022, 2023, 2024].map((y, i) => [String(y), pt((i + 1) * 500_000)]))])) },
  },
});
const ev = createEvidence(parseSnapshot(fixture()));

describe("snapshot validation and opt-in loading", () => {
  it("accepts a well-formed snapshot and rejects malformed ones", () => {
    assert.ok(parseSnapshot(fixture()));
    for (const bad of [null, {}, "x", { source: {}, flows: {} }, { ...fixture(), source: { name: "x", retrieved: "yesterday" } }]) assert.equal(parseSnapshot(bad), null);
    const broken = fixture();
    broken.flows.uaeImportsFromWorld.data["3924"]["2023"].valueUsd = "lots";
    assert.equal(parseSnapshot(broken), null);
  });
  it("loads nothing unless the operator opts in, even when the file exists", () => {
    const read = () => JSON.stringify(fixture());
    assert.equal(loadSnapshot({}, read), null);
    assert.equal(loadSnapshot({ TRADE_SNAPSHOT_DISPLAY: "1" }, read), null);
    assert.equal(loadSnapshot({ TRADE_SNAPSHOT_DISPLAY: "true" }, read), null);
    assert.ok(loadSnapshot({ TRADE_SNAPSHOT_DISPLAY: "internal-demo" }, read));
  });
  it("reads only from the git-ignored restricted folder", () => {
    let asked = "";
    loadSnapshot({ TRADE_SNAPSHOT_DISPLAY: "internal-demo" }, (p) => ((asked = p), "{}"), "/app");
    assert.equal(asked, `/app/${SNAPSHOT_FILE}`);
    assert.match(SNAPSHOT_FILE, /restricted/);
  });
  it("treats a missing or unreadable file as no data, without throwing", () => {
    assert.equal(loadSnapshot({ TRADE_SNAPSHOT_DISPLAY: "internal-demo" }, () => { throw new Error("ENOENT"); }), null);
    assert.equal(loadSnapshot({ TRADE_SNAPSHOT_DISPLAY: "internal-demo" }, () => "not json"), null);
  });
});

describe("the empty state is honest", () => {
  const none = createEvidence(null);
  it("shows no figures and explains why, with no estimate substituted", () => {
    const e = none.evidenceForEntry("irrigation-drip");
    assert.equal(e.loaded, false);
    assert.equal(e.hasData, false);
    assert.deepEqual(e.headings, []);
    assert.equal(e.emptyReason, NOT_LOADED_REASON);
    assert.match(e.emptyReason, /not loaded/);
    assert.equal(none.headingEvidence("3924"), null);
  });
  it("still names the source and its licence position", () => {
    assert.match(SOURCE.name, /UN Comtrade/);
    assert.match(SOURCE.licence, /no permission has been granted/);
  });
});

describe("evidence lookup (synthetic data)", () => {
  it("maps every catalogue product to at least one labelled heading", () => {
    for (const e of CATALOGUE) {
      assert.ok(HEADINGS_FOR_ENTRY[e.id]?.length > 0, `${e.id} has no heading mapping`);
      assert.ok(ev.evidenceForEntry(e.id).hasData, e.id);
    }
    for (const hs of Object.values(HEADINGS_FOR_ENTRY).flat()) assert.ok(HEADING_LABELS[hs], hs);
  });
  it("returns series in year order with positive values", () => {
    const h = ev.headingEvidence("3923");
    const ys = h.uaeImports.map((p) => p.year);
    assert.deepEqual(ys, [...ys].sort((a, b) => a - b));
    assert.equal(h.latestUae.year, 2023);
    assert.equal(h.latestUae.valueUsd, 5_000_000);
  });
  it("keeps the UAE's own report and India's mirror report separate", () => {
    const h = ev.headingEvidence("3917");
    assert.ok(h.uaeImports.length > 0 && h.indiaExports.length > 0);
    assert.notDeepEqual(h.uaeImports, h.indiaExports);
    assert.equal(h.latestIndia.year, 2024);
  });
  it("describes freshness as a static snapshot with the retrieval date", () => {
    const e = ev.evidenceForEntry("irrigation-drip");
    assert.match(e.freshness, /Static, not live/);
    assert.match(e.freshness, /2026-01-01/);
  });
  it("returns an honest empty result for an unknown product", () => {
    const e = ev.evidenceForEntry("something-else");
    assert.equal(e.hasData, false);
    assert.equal(e.loaded, true);
    assert.match(e.emptyReason, /No reported trade data/);
    assert.equal(ev.evidenceForEntry(null).hasData, false);
  });
  it("carries the limitations: not live, not demand, mirror data not comparable, no growth rates, heading unverified", () => {
    const t = GENERAL_LIMITATIONS.join(" ");
    for (const part of [/not a live feed/, /not demand for your product/, /should not be divided or subtracted/, /no growth rates/, /not been verified/]) assert.match(t, part);
  });
  it("warns where a heading overstates the product market, and notes classification changes and missing weights", () => {
    assert.ok(ev.headingEvidence("9403").notes.some((n) => /all furniture/.test(n)));
    assert.ok(ev.headingEvidence("3926").notes.some((n) => /residual/.test(n)));
    assert.ok(ev.headingEvidence("3924").notes.some((n) => /HS 2017 to HS 2022/.test(n)));
    assert.ok(ev.headingEvidence("3924").notes.some((n) => /Net weight is not reported/.test(n)));
    assert.equal(ev.headingEvidence("0000"), null);
  });
});

describe("formatting", () => {
  it("formats values and weights without inventing precision", () => {
    assert.equal(fmtUsd(224_000_000), "USD 224.0 million");
    assert.equal(fmtUsd(1.2e9), "USD 1.20 billion");
    assert.equal(fmtTonnes(61_000_000), "61,000 tonnes");
  });
});
