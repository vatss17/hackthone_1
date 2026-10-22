// Synthetic trade evidence for tests: invented round numbers, never the restricted UN Comtrade snapshot.
import { ALL_HEADINGS, createEvidence, parseSnapshot } from "../../src/lib/trade/evidence.ts";

const pt = (valueUsd) => ({ valueUsd, netWeightKg: valueUsd / 4, classification: "H6", isAggregate: false });
const flow = (ys) => ({ data: Object.fromEntries(ALL_HEADINGS.map((h) => [h, Object.fromEntries(ys.map((y, i) => [String(y), pt((i + 1) * 2_000_000)]))])) });
export const syntheticSnapshot = () =>
  parseSnapshot({
    source: { name: "synthetic fixture", publisher: "test", url: "https://example.invalid", retrieved: "2026-01-01", licence: "none" },
    flows: { uaeImportsFromWorld: flow([2022, 2023]), indiaExportsToUae: flow([2022, 2023, 2024]) },
  });
export const syntheticEvidence = createEvidence(syntheticSnapshot());
export const noEvidence = createEvidence(null);
