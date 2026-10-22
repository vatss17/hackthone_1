import type { CostLine, Inputs } from "./types.ts";

/**
 * Starting values for the calculator.
 *
 * EVERY NUMBER HERE IS A SAMPLE FOR ILLUSTRATION. None is a market rate, a quote, a tariff or a
 * recommendation. The interface labels them "Sample" until the user edits them. Facts that come
 * from the user's own product record (units per carton, carton weight and size) replace the
 * samples when they exist.
 */

export interface ProductFacts {
  label: string;
  unitsPerCarton: number | null;
  cartonGrossWeightKg: number | null;
  cartonLengthMm: number | null;
  cartonWidthMm: number | null;
  cartonHeightMm: number | null;
}

const line = (amount: number, basis: CostLine["basis"], currency: CostLine["currency"] = "INR"): CostLine => ({ amount, currency, basis, confirmed: false });

export function sampleInputs(facts?: Partial<ProductFacts>): Inputs {
  return {
    productLabel: facts?.label ?? "My product",
    quantity: 20000,
    quantityUnit: "units",
    unitsPerCarton: facts?.unitsPerCarton ?? 24,
    cartonGrossWeightKg: facts?.cartonGrossWeightKg ?? 6.5,
    cartonLengthMm: facts?.cartonLengthMm ?? 600,
    cartonWidthMm: facts?.cartonWidthMm ?? 400,
    cartonHeightMm: facts?.cartonHeightMm ?? 300,
    unitProductionCostInr: 85,
    lines: {
      packaging: line(60, "per_carton"),
      inlandFreight: line(25000, "per_consignment"),
      exportHandling: line(18000, "per_consignment"),
      internationalFreight: line(100000, "per_consignment"),
      insurance: line(0.3, "percent_of_goods"),
      destinationClearing: line(2500, "per_consignment", "AED"),
      otherCharges: line(0, "per_consignment"),
      otherDestination: line(0, "per_consignment", "AED"),
    },
    inrPerAed: 23,
    fxNote: "",
    sellingPriceAed: 6,
    duty: { ratePercent: 5, basis: "cif_cost", preferentialRatePercent: 0, applyPreference: false },
    targetMarginPercent: 20,
  };
}

/** Which fields of the sample hold product facts, so the interface can say where a value came from. */
export function factFields(facts?: Partial<ProductFacts>): string[] {
  const out: string[] = [];
  if (facts?.unitsPerCarton != null) out.push("unitsPerCarton");
  if (facts?.cartonGrossWeightKg != null) out.push("cartonGrossWeightKg");
  if (facts?.cartonLengthMm != null) out.push("cartonLengthMm", "cartonWidthMm", "cartonHeightMm");
  return out;
}
