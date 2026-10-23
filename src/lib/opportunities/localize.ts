/**
 * Render-time translation of the sentences the rules engine, the explanation, the classification helper and the trade-evidence
 * module build in English. Those modules keep producing the same English output (tests rely on it); this file turns each sentence
 * back into its template and translates that. A sentence that matches nothing is looked up as it is and otherwise shown in English.
 *
 * Pure and React-free, so node can import it. `t` is the translator from useT() or getT().
 */

export type Translate = (source: string, vars?: Record<string, string | number>) => string;

/** "a, b and c" in the reader's language. Each item is looked up on its own, so process and material names are translated. */
function items(t: Translate, joined: string): string {
  const raw = joined.split(/, | and /);
  const parts = raw.map((p) => t(p));
  // Nothing was translated (English, or names the dictionary does not know): keep the sentence exactly as it was written.
  if (parts.every((p, i) => p === raw[i])) return joined;
  if (parts.length === 1) return parts[0];
  return t("{list} and {last}", { list: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] });
}

/** Items separated by semicolons, as the explanation lists tooling. */
function semi(t: Translate, joined: string): string {
  return joined
    .split("; ")
    .map((p) => t(p))
    .join("; ");
}

/** Join already-separate items for display. */
export function joinItems(t: Translate, list: string[]): string {
  const raw = list.map((p) => t(p));
  if (raw.every((p, i) => p === list[i])) return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return items(t, list.join(", "));
}

/** "a or b" in the reader's language. */
export function joinOr(t: Translate, list: string[]): string {
  const parts = list.map((p) => t(p));
  if (parts.length === 1) return parts[0];
  return t("{list} or {last}", { list: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] });
}

const SUFFIX_LARGE = " Capped because large products need a press and mould sized to the product.";

/** Translates one generated sentence. */
export function tr(t: Translate, s: string): string {
  if (!s) return s;
  const direct = t(s);
  if (direct !== s) return direct;
  if (s.endsWith(SUFFIX_LARGE) && s.length > SUFFIX_LARGE.length) {
    return `${tr(t, s.slice(0, -SUFFIX_LARGE.length))} ${t("Capped because large products need a press and mould sized to the product.")}`;
  }
  let m: RegExpMatchArray | null;

  // ---- engine: processes
  if ((m = s.match(/^All required processes declared: (.+)\.$/))) return t("All required processes declared: {list}.", { list: items(t, m[1]) });
  if ((m = s.match(/^Missing: (.+)\.$/))) return t("Missing: {list}.", { list: items(t, m[1]) });
  if ((m = s.match(/^You declared (.+), which this product needs\.$/))) return t("You declared {list}, which this product needs.", { list: items(t, m[1]) });
  if ((m = s.match(/^You also declared (.+), which helps for the connected parts of this product\.$/))) return t("You also declared {list}, which helps for the connected parts of this product.", { list: items(t, m[1]) });
  if ((m = s.match(/^(.+) is not in your declared processes\. This would be a new capability, so treat it as a stretch\.$/))) return t("{process} is not in your declared processes. This would be a new capability, so treat it as a stretch.", { process: t(m[1]) });
  if ((m = s.match(/^Optional: (.+) is not needed to make this product, but a fuller range may use it\.$/))) return t("Optional: {process} is not needed to make this product, but a fuller range may use it.", { process: t(m[1]) });

  // ---- engine: materials
  if ((m = s.match(/^Preferred material declared: (.+)\.$/))) return t("Preferred material declared: {list}.", { list: items(t, m[1]) });
  if ((m = s.match(/^Preferred materials declared: (.+)\.$/))) return t("Preferred materials declared: {list}.", { list: items(t, m[1]) });
  if ((m = s.match(/^Possible but not the usual material: (.+)\.$/))) return t("Possible but not the usual material: {list}.", { list: items(t, m[1]) });
  if ((m = s.match(/^Your custom materials \((.+)\) cannot be matched automatically\.$/))) return t("Your custom materials ({list}) cannot be matched automatically.", { list: m[1] });
  if ((m = s.match(/^You work with (.+), a usual material for this kind of product\.$/))) return t("You work with {list}, a usual material for this kind of product.", { list: items(t, m[1]) });
  if ((m = s.match(/^You work with (.+), which can be used but is not the usual choice here\.$/))) return t("You work with {list}, which can be used but is not the usual choice here.", { list: items(t, m[1]) });
  if ((m = s.match(/^Alternative grades also used for this product, not required: (.+)\. Confirm which grade suits the application\.$/))) return t("Alternative grades also used for this product, not required: {list}. Confirm which grade suits the application.", { list: items(t, m[1]) });
  if ((m = s.match(/^The usual material for this product is (.+)\. A supplier and trial would be needed\.$/))) return t("The usual material for this product is {list}. A supplier and trial would be needed.", { list: items(t, m[1]) });
  if ((m = s.match(/^The usual material for this product \((.+)\) is not among your declared materials\.$/))) return t("The usual material for this product ({list}) is not among your declared materials.", { list: items(t, m[1]) });

  // ---- engine: machines
  if ((m = s.match(/^(\d+) machine\(s\) declared for this process, with ratings\.$/))) return t("{count} machine(s) declared for this process, with ratings.", { count: m[1] });
  if ((m = s.match(/^Your (.+) is rated (\S+) (.+), which is evidence you can run this process\.$/))) return t("Your {machine} is rated {value} {unit}, which is evidence you can run this process.", { machine: m[1], value: m[2], unit: t(m[3]) });
  if ((m = s.match(/^You declared (.+) but list no machine for them\. Add the machinery to firm up this match\.$/))) return t("You declared {list} but list no machine for them. Add the machinery to firm up this match.", { list: items(t, m[1]) });
  if ((m = s.match(/^You declared (.+) but list no machine for it\. Add the machinery to firm up this match\.$/))) return t("You declared {list} but list no machine for it. Add the machinery to firm up this match.", { list: items(t, m[1]) });
  if ((m = s.match(/^Your largest declared press is (\S+) tonnes\. A large product needs a press sized to its mould: confirm with a toolmaker before committing\.$/))) return t("Your largest declared press is {n} tonnes. A large product needs a press sized to its mould: confirm with a toolmaker before committing.", { n: m[1] });
  if ((m = s.match(/^When you scope the tooling, check mould size against your largest declared press \((\S+) tonnes\)\.$/))) return t("When you scope the tooling, check mould size against your largest declared press ({n} tonnes).", { n: m[1] });

  // ---- engine: capacity and adjacency
  if ((m = s.match(/^Capacity declared for (.+): (.+)\.$/))) return t("Capacity declared for {process}: {capacity}.", { process: t(m[1]), capacity: m[2] });
  if ((m = s.match(/^Factory-wide capacity declared: (.+)\.$/))) return t("Factory-wide capacity declared: {capacity}.", { capacity: m[1] });
  if ((m = s.match(/^You declared (.+) of factory-wide capacity\.$/))) return t("You declared {capacity} of factory-wide capacity.", { capacity: m[1] });
  if ((m = s.match(/^You declared (.+) of (.+) capacity\.$/))) return t("You declared {capacity} of {process} capacity.", { capacity: m[1], process: t(m[2]) });
  if ((m = s.match(/^Same product family as your (.+)\.$/))) return t("Same product family as your {product}.", { product: m[1] });
  if ((m = s.match(/^It sits in the same product family as your (.+), so customers and know-how may carry over\.$/))) return t("It sits in the same product family as your {product}, so customers and know-how may carry over.", { product: m[1] });

  // ---- explanation
  if ((m = s.match(/^(Stretch|Strong|Good|Possible) fit, (\d+)\/100 on capability only$/))) {
    const score = m[2];
    if (m[1] === "Stretch") return t("Stretch fit, {score}/100 on capability only", { score });
    if (m[1] === "Strong") return t("Strong fit, {score}/100 on capability only", { score });
    if (m[1] === "Good") return t("Good fit, {score}/100 on capability only", { score });
    return t("Possible fit, {score}/100 on capability only", { score });
  }
  if ((m = s.match(/^Needs (.+), which you have not declared\.$/))) return t("Needs {list}, which you have not declared.", { list: items(t, m[1]) });
  if ((m = s.match(/^Tooling to confirm: (.+)\.$/))) return t("Tooling to confirm: {tooling}.", { tooling: semi(t, m[1]) });
  if ((m = s.match(/^HS (\d+) \((.+)\): the destination market reported (USD [\d.]+ (?:million|billion)) of imports from all countries in (\d{4})\.$/))) return t("HS {heading} ({label}): the destination market reported {value} of imports from all countries in {year}.", { heading: m[1], label: t(m[2]), value: usd(t, m[3]), year: m[4] });
  if ((m = s.match(/^India reported (USD [\d.]+ (?:million|billion)) of exports to the destination market under HS (\d+) in (\d{4})\.$/))) return t("India reported {value} of exports to the destination market under HS {heading} in {year}.", { value: usd(t, m[1]), heading: m[2], year: m[3] });
  if ((m = s.match(/^Landed cost AED ([\d.]+) per unit against a proposed price of AED ([\d.]+); gross margin (.+) against a (.+)% target\.$/))) return t("Landed cost AED {landed} per unit against a proposed price of AED {price}; gross margin {margin} against a {target}% target.", { landed: m[1], price: m[2], margin: m[3] === "n/a" ? t("n/a") : m[3], target: m[4] });
  if ((m = s.match(/^(\d+) of (\d+) screening questions marked as answered by you\. None has been verified against an official source\.$/))) return t("{done} of {total} screening questions marked as answered by you. None has been verified against an official source.", { done: m[1], total: m[2] });
  if ((m = s.match(/^Your declared (.+) support it\.$/))) return t("Your declared {list} support it.", { list: items(t, m[1]) });
  if ((m = s.match(/^It would put your (.+) capability to work, which none of your current products uses\.$/))) return t("It would put your {list} capability to work, which none of your current products uses.", { list: items(t, m[1]) });
  if ((m = s.match(/^You already work with (.+)\.$/))) return t("You already work with {list}.", { list: items(t, m[1]) });
  // The explanation trims "(hypothesis to test)" from a catalogue sentence. Look the trimmed sentence up through its full form.
  for (const suffix of [" (hypothesis to test).", " (to be assessed)."]) {
    if (s.endsWith(".")) {
      const full = `${s.slice(0, -1)}${suffix}`;
      const found = t(full);
      if (found !== full) return found.replace(/ \([^()]*\)\.?$/, ".");
    }
  }

  // ---- classification helper
  if ((m = s.match(/^Other headings may also fit \((.+)\)\. Which one applies depends on the exact product and how it is mainly used\.$/))) return t("Other headings may also fit ({headings}). Which one applies depends on the exact product and how it is mainly used.", { headings: m[1] });

  // ---- trade evidence
  if ((m = s.match(/^destination-reported imports up to (\S+); India-reported exports up to (\S+)\. Snapshot retrieved (\S+)\. Static, not live\.$/))) return t("destination-reported imports up to {uae}; India-reported exports up to {india}. Snapshot retrieved {date}. Static, not live.", { uae: m[1] === "n/a" ? t("n/a") : m[1], india: m[2] === "n/a" ? t("n/a") : m[2], date: m[3] });
  return s;
}

/** "USD 12.3 million" in the reader's language. The currency code stays, the magnitude word is translated. */
function usd(t: Translate, s: string): string {
  const m = s.match(/^USD ([\d.]+) (million|billion)$/);
  if (!m) return s;
  return m[2] === "million" ? t("USD {n} million", { n: m[1] }) : t("USD {n} billion", { n: m[1] });
}

/** A formatted USD amount from lib/trade/format (for example "USD 3.4 million"). */
export const trUsd = usd;

/** "12 tonnes" from lib/trade/format. The unit stays as it is. */
export const trTonnes = (_t: Translate, s: string): string => s;

// ---- counts with a singular and a plural form, as separate keys so each language can phrase them
export const nProcesses = (t: Translate, n: number) => (n === 1 ? t("{n} process", { n }) : t("{n} processes", { n }));
export const nMachines = (t: Translate, n: number) => (n === 1 ? t("{n} machine", { n }) : t("{n} machines", { n }));
export const nMaterials = (t: Translate, n: number) => (n === 1 ? t("{n} material", { n }) : t("{n} materials", { n }));
export const nFactories = (t: Translate, n: number) => (n === 1 ? t("{n} factory", { n }) : t("{n} factories", { n }));
export const nSuggestions = (t: Translate, n: number) => (n === 1 ? t("{n} suggestion", { n }) : t("{n} suggestions", { n }));
export const nAssumptions = (t: Translate, n: number) => (n === 1 ? t("{n} assumption", { n }) : t("{n} assumptions", { n }));
