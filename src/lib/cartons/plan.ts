/**
 * Splits a consignment into full cartons and one partial carton, so every document row and every total reconcile.
 *
 * Example: 1,000 units at 24 per carton and 250 g each is 41 full cartons holding 984 units, plus ONE partial carton holding 16 units.
 * Net weight is 984 x 250 g = 246 kg and 16 x 250 g = 4 kg, which is 250 kg in total.
 *
 * Gross weight of the partial carton is an ASSUMPTION unless the person enters it: by default the full-carton gross weight is scaled
 * by how full the partial carton is. It is labelled as such everywhere it is shown. Nothing here is a measurement.
 */

export type GrossBasis = "entered" | "scaled_estimate" | "unknown";

export interface CartonRow {
  kind: "full" | "partial";
  cartons: number;
  unitsPerCarton: number;
  units: number;
  /** Net weight of the units in this row, or null when the unit weight is not known. */
  netKg: number | null;
  /** Gross weight of all cartons in this row, or null when carton weight is not known. */
  grossKg: number | null;
  /** Where the gross weight of this row comes from. Full rows are the entered carton weight. */
  grossBasis: GrossBasis;
}

export interface CartonPlan {
  rows: CartonRow[];
  totals: { cartons: number; units: number; netKg: number | null; grossKg: number | null };
  hasPartial: boolean;
}

export interface CartonPlanInput {
  units: number;
  unitsPerCarton: number;
  /** Net weight of one unit in grams, or null. */
  unitWeightG: number | null;
  /** Gross weight of one full carton in kg, or null. */
  cartonGrossKg: number | null;
  /** Gross weight of the partial carton in kg, if the person entered it. */
  partialGrossKg?: number | null;
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function cartonPlan(i: CartonPlanInput): CartonPlan {
  const { units, unitsPerCarton: upc } = i;
  if (!Number.isInteger(units) || units < 1 || !Number.isInteger(upc) || upc < 1) return { rows: [], totals: { cartons: 0, units: 0, netKg: null, grossKg: null }, hasPartial: false };
  const full = Math.floor(units / upc);
  const rest = units - full * upc;
  const net = (u: number) => (i.unitWeightG && i.unitWeightG > 0 ? r3((u * i.unitWeightG) / 1000) : null);
  const rows: CartonRow[] = [];
  if (full > 0) {
    rows.push({ kind: "full", cartons: full, unitsPerCarton: upc, units: full * upc, netKg: net(full * upc), grossKg: i.cartonGrossKg === null ? null : r2(i.cartonGrossKg * full), grossBasis: i.cartonGrossKg === null ? "unknown" : "entered" });
  }
  if (rest > 0) {
    let gross: number | null = null;
    let basis: GrossBasis = "unknown";
    if (i.partialGrossKg !== null && i.partialGrossKg !== undefined && i.partialGrossKg > 0) {
      gross = r2(i.partialGrossKg);
      basis = "entered";
    } else if (i.cartonGrossKg !== null) {
      gross = r2((i.cartonGrossKg * rest) / upc);
      basis = "scaled_estimate";
    }
    rows.push({ kind: "partial", cartons: 1, unitsPerCarton: rest, units: rest, netKg: net(rest), grossKg: gross, grossBasis: basis });
  }
  const sum = (f: (r: CartonRow) => number | null, round: (n: number) => number) => (rows.some((r) => f(r) === null) ? null : round(rows.reduce((n, r) => n + (f(r) as number), 0)));
  return {
    rows,
    totals: { cartons: rows.reduce((n, r) => n + r.cartons, 0), units: rows.reduce((n, r) => n + r.units, 0), netKg: sum((r) => r.netKg, r3), grossKg: sum((r) => r.grossKg, r2) },
    hasPartial: rest > 0,
  };
}
