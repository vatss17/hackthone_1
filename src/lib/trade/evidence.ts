import { readFileSync } from "node:fs";
import { join } from "node:path";
export { fmtTonnes, fmtUsd } from "./format.ts";

/**
 * UAE market evidence from a dated snapshot of public UN Comtrade data.
 *
 * THE DATA IS NOT PART OF THE REPOSITORY. Redistribution of UN Comtrade data has not been authorised
 * for this project (see docs/trade-data-source.md), so the snapshot lives in a git-ignored file and is
 * only used when an operator opts in on that machine with TRADE_SNAPSHOT_DISPLAY=internal-demo. In any
 * other deployment (including a public one) there is no data, and the interface shows an honest empty
 * state with the source details. This module is server-side only: it reads from disk, which also stops
 * a client component from importing it by mistake.
 *
 * What the data is: reported annual trade values and weights for broad HS headings. What it is NOT: live
 * data, demand for a specific product, buyer intent, prices, or sales a manufacturer could win. Nothing is
 * estimated, extrapolated or projected, and there are no growth rates. The mapping from a catalogue
 * product to HS headings is an INFERENCE, shown as a candidate and never as a classification.
 */

export const SNAPSHOT_FLAG = "TRADE_SNAPSHOT_DISPLAY";
export const SNAPSHOT_FLAG_VALUE = "internal-demo";
export const SNAPSHOT_FILE = join("src", "data", "restricted", "uae-trade-comtrade.json");

type Point = { valueUsd: number | null; netWeightKg: number | null; classification: string; isAggregate: boolean };
export interface Snapshot {
  source: { name: string; publisher: string; url: string; retrieved: string; licence: string };
  flows: {
    uaeImportsFromWorld: { data: Record<string, Record<string, Point>> };
    indiaExportsToUae: { data: Record<string, Record<string, Point>> };
  };
}

/** Static description of the source. It is shown even when no data is loaded. */
export const SOURCE = {
  name: "UN Comtrade database (public preview API)",
  publisher: "United Nations Statistics Division",
  url: "https://comtradeplus.un.org/",
  licence:
    "UN Comtrade terms: the licence agreement restricts publication, redistribution and automated download without written permission, while the UN's re-dissemination FAQ says limited displays and free visualizations of small datasets need no licence. Which applies to this project has not been confirmed in writing, and no permission has been granted.",
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function validFlow(f: unknown): f is Snapshot["flows"]["indiaExportsToUae"] {
  if (!isObj(f) || !isObj(f.data)) return false;
  for (const byYear of Object.values(f.data)) {
    if (!isObj(byYear)) return false;
    for (const [year, p] of Object.entries(byYear)) {
      if (!/^\d{4}$/.test(year) || !isObj(p)) return false;
      if (p.valueUsd !== null && (typeof p.valueUsd !== "number" || !Number.isFinite(p.valueUsd))) return false;
      if (p.netWeightKg !== null && (typeof p.netWeightKg !== "number" || !Number.isFinite(p.netWeightKg))) return false;
      if (typeof p.classification !== "string") return false;
    }
  }
  return true;
}

/** Accepts only a well-formed snapshot. Anything else is treated as "no data". */
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (!isObj(raw) || !isObj(raw.source) || !isObj(raw.flows)) return null;
  const s = raw.source;
  if (typeof s.name !== "string" || typeof s.retrieved !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s.retrieved)) return null;
  if (!validFlow(raw.flows.uaeImportsFromWorld) || !validFlow(raw.flows.indiaExportsToUae)) return null;
  return raw as unknown as Snapshot;
}

/** Loads the snapshot only when the operator has opted in AND the local file exists and is well formed. */
export function loadSnapshot(env: Record<string, string | undefined>, read: (path: string) => string = (p) => readFileSync(p, "utf8"), cwd = process.cwd()): Snapshot | null {
  if (env[SNAPSHOT_FLAG] !== SNAPSHOT_FLAG_VALUE) return null;
  try {
    return parseSnapshot(JSON.parse(read(join(cwd, SNAPSHOT_FILE))));
  } catch {
    return null;
  }
}

export const HEADING_LABELS: Record<string, string> = {
  "3916": "Plastic profile shapes, rods and sticks",
  "3917": "Plastic tubes, pipes, hoses and fittings",
  "3923": "Plastic packing articles, lids and caps",
  "3924": "Plastic tableware, kitchenware and household articles",
  "3925": "Plastic builders' ware",
  "3926": "Other plastic articles",
  "9403": "Other furniture (includes plastic furniture)",
};

/** Candidate HS headings per catalogue product. An inference for evidence lookup, not a classification. */
export const HEADINGS_FOR_ENTRY: Record<string, string[]> = {
  "food-storage-containers": ["3924", "3923"],
  "household-storage-boxes": ["3924", "3923"],
  "crates-and-baskets": ["3923"],
  "caps-and-closures": ["3923"],
  "planters-and-nursery": ["3924", "3926"],
  "buckets-and-cleaning-ware": ["3924"],
  "stackable-furniture": ["9403"],
  "hangers-and-laundry": ["3924", "3926"],
  "food-service-ware": ["3924"],
  "irrigation-drip": ["3917"],
  "conduits-and-ducts": ["3917"],
  "pipes-and-fittings": ["3917"],
  "extruded-profiles-and-trims": ["3916"],
  "industrial-pallets": ["3923", "3926"],
  "blow-moulded-bottles": ["3923"],
  "thermoformed-trays": ["3923", "3924"],
  "rotomoulded-tanks": ["3925"],
};

export interface YearPoint {
  year: number;
  valueUsd: number;
  netWeightKg: number | null;
  classification: string;
}

export interface HeadingEvidence {
  heading: string;
  label: string;
  /** Imports into the UAE from all countries, as reported by the UAE. */
  uaeImports: YearPoint[];
  /** Exports from India to the UAE, as reported by India (mirror data: not the UAE's own record). */
  indiaExports: YearPoint[];
  latestUae: YearPoint | null;
  latestIndia: YearPoint | null;
  notes: string[];
}

export interface EntryEvidence {
  entryId: string;
  /** True when a snapshot is loaded in this deployment. */
  loaded: boolean;
  headings: HeadingEvidence[];
  hasData: boolean;
  /** Why there is no data, in words for the interface. Empty when data is present. */
  emptyReason: string;
  retrieved: string | null;
  mappingNote: string;
  freshness: string;
  limitations: string[];
}

export const NOT_LOADED_REASON =
  "UAE trade evidence is not loaded in this deployment. It comes from UN Comtrade data whose redistribution has not been authorised for this project, so it is kept out of the code and shown only on a machine where an operator has opted in for an internal demonstration.";

export const GENERAL_LIMITATIONS = [
  "This is a dated snapshot of public UN Comtrade data, not a live feed.",
  "It shows what was reported to have been imported or exported under broad HS headings. It is market evidence, not demand for your product, not buyer intent and not a forecast.",
  "The UAE does not report imports by partner country in this source. India's exports to the UAE are India's own report (mirror data), valued differently (FOB, not CIF) and timed differently, so the two series should not be divided or subtracted.",
  "Values are in US dollars as reported. No prices per unit are derived and no growth rates are shown.",
  "A heading groups many products. Which heading a product falls under has not been verified: see the HS classification step.",
];

export const ALL_HEADINGS = Object.keys(HEADING_LABELS);

const MAPPING_NOTE = "The HS headings are candidates chosen by a simple rule from the product type. They are not a classification and may be wrong for your exact product.";

/** Builds the lookup functions over a snapshot (or over nothing). Pure, so it can be tested with a fixture. */
export function createEvidence(snapshot: Snapshot | null) {
  const series = (flow: Record<string, Record<string, Point>> | undefined, heading: string): YearPoint[] =>
    Object.entries(flow?.[heading] ?? {})
      .filter(([, p]) => typeof p.valueUsd === "number" && p.valueUsd > 0)
      .map(([y, p]) => ({ year: Number(y), valueUsd: p.valueUsd as number, netWeightKg: p.netWeightKg, classification: p.classification }))
      .sort((a, b) => a.year - b.year);

  function headingEvidence(heading: string): HeadingEvidence | null {
    if (!snapshot || !HEADING_LABELS[heading]) return null;
    const u = series(snapshot.flows.uaeImportsFromWorld.data, heading);
    const i = series(snapshot.flows.indiaExportsToUae.data, heading);
    const notes: string[] = [];
    if (new Set([...u, ...i].map((p) => p.classification)).size > 1) notes.push("The classification revision changes within this series (HS 2017 to HS 2022), so year-to-year comparisons across the change need care.");
    if (u.some((p) => p.netWeightKg === null)) notes.push("Net weight is not reported for every year.");
    if (heading === "9403") notes.push("This heading covers all furniture, not only plastic furniture, so it overstates the plastic furniture market.");
    if (heading === "3926") notes.push("This is a residual heading for many different plastic articles.");
    return { heading, label: HEADING_LABELS[heading], uaeImports: u, indiaExports: i, latestUae: u.at(-1) ?? null, latestIndia: i.at(-1) ?? null, notes };
  }

  function evidenceForEntry(entryId: string | null | undefined): EntryEvidence {
    const base = { entryId: entryId ?? "", mappingNote: MAPPING_NOTE, limitations: GENERAL_LIMITATIONS, retrieved: snapshot?.source.retrieved ?? null };
    if (!snapshot) return { ...base, loaded: false, headings: [], hasData: false, emptyReason: NOT_LOADED_REASON, freshness: "No snapshot loaded." };
    const wanted = (entryId && HEADINGS_FOR_ENTRY[entryId]) || [];
    const headings = wanted.map(headingEvidence).filter((h): h is HeadingEvidence => !!h && (h.uaeImports.length > 0 || h.indiaExports.length > 0));
    const uaeYear = Math.max(0, ...headings.map((h) => h.latestUae?.year ?? 0));
    const inYear = Math.max(0, ...headings.map((h) => h.latestIndia?.year ?? 0));
    return {
      ...base,
      loaded: true,
      headings,
      hasData: headings.length > 0,
      emptyReason: headings.length > 0 ? "" : "No reported trade data for this product type in the loaded snapshot.",
      freshness: headings.length ? `UAE-reported imports up to ${uaeYear || "n/a"}; India-reported exports up to ${inYear || "n/a"}. Snapshot retrieved ${snapshot.source.retrieved}. Static, not live.` : "No data for this product type.",
    };
  }

  return { headingEvidence, evidenceForEntry, loaded: snapshot !== null, retrieved: snapshot?.source.retrieved ?? null };
}

let cached: ReturnType<typeof createEvidence> | null = null;
const instance = () => (cached ??= createEvidence(loadSnapshot(process.env)));

export const evidenceForEntry = (entryId: string | null | undefined) => instance().evidenceForEntry(entryId);
export const headingEvidence = (heading: string) => instance().headingEvidence(heading);
export const snapshotLoaded = () => instance().loaded;
export const snapshotRetrieved = () => instance().retrieved;
