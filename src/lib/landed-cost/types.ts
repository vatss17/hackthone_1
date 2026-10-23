/**
 * Landed-cost model: shared types.
 *
 * Units are explicit everywhere. Money is held per line in the currency the user entered
 * (INR or AED) and converted with ONE user-entered exchange rate stated as INR per 1 AED.
 * Nothing here knows a market rate: the rate, every charge and the duty rate are assumptions
 * unless the user marks them confirmed.
 */

export type Currency = "INR" | "AED";

/**
 * What an amount is multiplied by.
 *  - per_consignment: one charge for the whole shipment
 *  - per_unit / per_carton: times the number of units / cartons
 *  - per_kg: times total gross weight (needs carton gross weight)
 *  - per_cbm: times total volume in cubic metres (needs carton dimensions)
 *  - percent_of_goods: a percentage (the amount) of goods value = production cost plus packaging
 *    (insurance only; the currency is ignored)
 */
export type Basis = "per_consignment" | "per_unit" | "per_carton" | "per_kg" | "per_cbm" | "percent_of_goods";

export interface CostLine {
  amount: number;
  currency: Currency;
  basis: Basis;
  /** True when the user holds a quote or invoice for this charge. Otherwise it is an estimate. */
  confirmed: boolean;
}

export type LineKey =
  | "packaging"
  | "inlandFreight"
  | "exportHandling"
  | "internationalFreight"
  | "insurance"
  | "destinationClearing"
  | "otherCharges"
  | "otherDestination";

export type DutyBasis = "cif_cost" | "selling_price";

export interface Inputs {
  productLabel: string;
  quantity: number;
  quantityUnit: "units" | "cartons";
  unitsPerCarton: number;
  cartonGrossWeightKg: number | null;
  cartonLengthMm: number | null;
  cartonWidthMm: number | null;
  cartonHeightMm: number | null;
  /** Gross weight of the one partial carton, if the person entered it. Otherwise it is an estimate scaled from a full carton. */
  partialCartonGrossKg: number | null;
  /** Ex-factory production cost of ONE unit, in INR. */
  unitProductionCostInr: number;
  lines: Record<LineKey, CostLine>;
  /** User-entered exchange rate: how many INR equal 1 AED. */
  inrPerAed: number;
  /** Optional note of where the rate came from and its date, typed by the user. */
  fxNote: string;
  /** Proposed destination selling price of ONE unit, in AED. */
  sellingPriceAed: number;
  duty: {
    ratePercent: number;
    basis: DutyBasis;
    /** Hypothetical preferential rate. Using it is a scenario, never a finding of eligibility. */
    preferentialRatePercent: number;
    applyPreference: boolean;
  };
  targetMarginPercent: number;
}

export interface LineResult {
  key: LineKey | "goods" | "duty";
  label: string;
  group: "Production" | "Packaging" | "Origin logistics" | "International" | "Destination" | "Duty" | "Other";
  totalInr: number;
  perUnitInr: number;
  /** True for a confirmed charge. Goods and duty are never counted as confirmed. */
  confirmed: boolean;
  note: string;
}

export interface Result {
  units: number;
  cartons: number;
  grossWeightKg: number | null;
  volumeCbm: number | null;
  inrPerAed: number;
  lines: LineResult[];
  goodsInr: number;
  dutyBaseInr: number;
  dutyRateApplied: number;
  dutyInr: number;
  totalCostInr: number;
  totalCostAed: number;
  landedPerUnitInr: number;
  landedPerUnitAed: number;
  revenueInr: number;
  revenueAed: number;
  grossProfitInr: number;
  grossProfitAed: number;
  profitPerUnitAed: number;
  /** Gross profit divided by revenue. Null when revenue is zero. NOT markup. */
  grossMarginPct: number | null;
  /** Gross profit divided by cost. Shown separately and labelled markup. */
  markupPct: number | null;
  breakEvenPriceAed: number;
  breakEvenPriceInr: number;
  /** Selling price needed for the target margin, or null when it cannot be reached. */
  priceForTargetMarginAed: number | null;
  confirmedSharePct: number;
}

export interface Validation {
  errors: Record<string, string>;
  warnings: string[];
}

export interface Scenario {
  id: string;
  name: string;
  kind: "base" | "freight" | "price" | "tariff" | "custom";
  /** Percent change applied to the international freight amount. */
  freightPct: number;
  /** Percent change applied to the selling price. */
  pricePct: number;
  /** Percent change applied to the unit production cost. */
  costPct: number;
  /** Percent change applied to INR per AED. */
  fxPct: number;
  /** Apply the hypothetical preferential duty rate. */
  preferentialDuty: boolean;
}

export type Verdict = "loss" | "below_target" | "meets_target";
