/**
 * How the proposed selling price compares with a REQUIRED price (the price that gives a target margin, or break-even).
 *
 *   gap % = (proposed price - required price) / required price x 100
 *
 * The reference is always the REQUIRED price. A positive gap means the proposed price is ABOVE what is required (comfortably
 * clear of it); a negative gap means it is BELOW (it falls short). Zero, negative, missing and non-finite values never divide.
 */

export interface PriceGap {
  /** Signed percentage of the required price, rounded to one decimal, or null when it cannot be worked out. */
  pct: number | null;
  direction: "above" | "below" | "equal" | "unavailable";
  /** A full sentence. Always names the direction and the reference. */
  text: string;
  /** A short form for tables: "5.0% above" / "12.3% below" / "same as" / "not available". */
  short: string;
}

export function priceGap(proposed: number | null | undefined, required: number | null | undefined): PriceGap {
  const bad = (n: unknown): n is null | undefined => typeof n !== "number" || !Number.isFinite(n);
  if (bad(proposed) || bad(required) || required <= 0) {
    const why = bad(required) || required <= 0 ? "There is no required price to compare with." : "There is no proposed price to compare.";
    return { pct: null, direction: "unavailable", text: why, short: "not available" };
  }
  if (proposed < 0) return { pct: null, direction: "unavailable", text: "The proposed price is below zero, so it cannot be compared.", short: "not available" };
  const pct = Math.round(((proposed - required) / required) * 1000) / 10;
  if (pct === 0) return { pct: 0, direction: "equal", text: "Your price is the same as the required price.", short: "same as" };
  const direction = pct > 0 ? "above" : "below";
  const abs = Math.abs(pct).toFixed(1);
  return { pct, direction, text: `Your price is ${abs}% ${direction} the required price.`, short: `${abs}% ${direction}` };
}
