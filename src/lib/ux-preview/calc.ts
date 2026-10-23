/**
 * Deterministic landed-cost arithmetic for the UX wireframes.
 * Every rate below is a labelled SAMPLE assumption, not a market or tariff fact.
 */
export type SampleCalcInput = {
  /** Ex-factory price per unit, INR. */
  price: number;
  /** Sea freight for one 40 ft container, INR. */
  freight: number;
  /** Illustrative selling price in AED the importer might need. A placeholder, not destination data. */
  reference: number;
};

export const SAMPLE_ASSUMPTIONS = {
  unitsPerContainer: 5000,
  inrToAed: 0.044,
  insuranceRate: 0.005,
  dutyRate: 0.05,
  clearanceAedPerContainer: 1200,
} as const;

export const DEFAULT_CALC: SampleCalcInput = { price: 140, freight: 180000, reference: 10.5 };

export type SampleCalcResult = {
  ok: boolean;
  problem?: string;
  parts: { label: string; aed: number }[];
  landedAed: number;
  marginAed: number;
  marginPct: number;
  verdict: "healthy" | "thin" | "loss";
};

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function sampleCalc(input: SampleCalcInput): SampleCalcResult {
  const empty: SampleCalcResult = { ok: false, parts: [], landedAed: 0, marginAed: 0, marginPct: 0, verdict: "loss" };
  const { price, freight, reference } = input;
  if (![price, freight, reference].every(Number.isFinite)) return { ...empty, problem: "Enter numbers only." };
  if (price <= 0) return { ...empty, problem: "Price per unit must be more than zero." };
  if (freight < 0) return { ...empty, problem: "Freight cannot be negative." };
  if (reference <= 0) return { ...empty, problem: "Selling price must be more than zero." };

  const a = SAMPLE_ASSUMPTIONS;
  const product = price * a.inrToAed;
  const freightUnit = (freight * a.inrToAed) / a.unitsPerContainer;
  const insurance = product * a.insuranceRate;
  const duty = (product + freightUnit + insurance) * a.dutyRate;
  const clearance = a.clearanceAedPerContainer / a.unitsPerContainer;
  const parts = [
    { label: "Product at factory gate", aed: round(product) },
    { label: "Sea freight share", aed: round(freightUnit) },
    { label: "Insurance (sample rate)", aed: round(insurance) },
    { label: "Import duty (sample rate)", aed: round(duty) },
    { label: "Port clearance share", aed: round(clearance) },
  ];
  const landed = round(product + freightUnit + insurance + duty + clearance);
  const margin = round(reference - landed);
  const pct = round((margin / reference) * 100, 1);
  return {
    ok: true,
    parts,
    landedAed: landed,
    marginAed: margin,
    marginPct: pct,
    verdict: margin < 0 ? "loss" : pct < 10 ? "thin" : "healthy",
  };
}
