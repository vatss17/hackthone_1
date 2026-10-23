import type { Vars } from "../i18n/translate.ts";
import type { PriceGap } from "./price-gap.ts";

/**
 * Translation of the display text that the calculation code builds as English with numbers in it. The calculation keeps producing
 * English (tests and saved files depend on it); the screens call these helpers to say the same thing in the selected language.
 * Pure and free of React, so node can import it. `t` is the translator from useT() or getT().
 */
export type Tr = (source: string, vars?: Vars) => string;

const BASIS: Record<string, (t: Tr) => string> = {
  consignment: (t) => t("per consignment"),
  unit: (t) => t("per unit"),
  carton: (t) => t("per carton"),
  kg: (t) => t("per kg"),
  cbm: (t) => t("per cbm"),
};

/** The small note under each cost line in the results table. Anything unrecognised is returned unchanged. */
export function lineNote(t: Tr, note: string): string {
  let m = note.match(/^(\S+) units x INR (\S+)$/);
  if (m) return t("{units} units x INR {cost}", { units: m[1], cost: m[2] });
  m = note.match(/^(\S+)% of goods value$/);
  if (m) return t("{amount}% of goods value", { amount: m[1] });
  m = note.match(/^(\S+) (INR|AED) per (consignment|unit|carton|kg|cbm)$/);
  if (m) return `${m[1]} ${m[2]} ${BASIS[m[3]](t)}`;
  m = note.match(/^(\S+)% of (selling price \(invoice value\)|goods plus costs to the destination port)$/);
  if (m) {
    const base = m[2] === "goods plus costs to the destination port" ? t("goods plus costs to the destination port") : t("selling price (invoice value)");
    return t("{rate}% of {base}", { rate: m[1], base });
  }
  return t(note);
}

/** "5.0% above" / "12.3% below" / "same as" / "not available", in the selected language. */
export function priceGapShort(t: Tr, g: PriceGap): string {
  if (g.direction === "above" && g.pct !== null) return t("{pct}% above", { pct: Math.abs(g.pct).toFixed(1) });
  if (g.direction === "below" && g.pct !== null) return t("{pct}% below", { pct: Math.abs(g.pct).toFixed(1) });
  if (g.direction === "equal") return t("same as");
  return t("not available");
}

/** The full sentence form of a price gap. */
export function priceGapText(t: Tr, g: PriceGap): string {
  if (g.direction === "above" && g.pct !== null) return t("Your price is {pct}% above the required price.", { pct: Math.abs(g.pct).toFixed(1) });
  if (g.direction === "below" && g.pct !== null) return t("Your price is {pct}% below the required price.", { pct: Math.abs(g.pct).toFixed(1) });
  return t(g.text);
}
