/**
 * Text that lib code builds at run time ("3 of 4 record parts present.", "Missing: Buyer address") cannot be wrapped in t() where
 * it is written, because the lib code is plain TypeScript with no language. Instead each sentence shape is listed here once as a
 * TEMPLATE (the English with {placeholders}); `tx` recognises a built sentence by its shape, translates the template and puts the
 * values back. Anything that matches no template is looked up as a plain string, and falls back to English when it has no
 * translation. Every template needs a Hindi and a Gujarati entry in messages/workspace.ts (tests/i18n/workspace-data.test.mjs checks).
 *
 * This module has no React in it so node tests can import it.
 */

type T = (source: string, vars?: Record<string, string | number>) => string;

export const TEMPLATES: string[] = [
  // Roadmap: why
  "{count} thing to firm up in your profile for this product. None stops you making it.",
  "{count} things to firm up in your profile for this product. None stops you making it.",
  "{why} Your own numbers show a problem here, so it comes before everything else.",
  "{why} It blocks a sound decision and nothing earlier is blocking you.",
  "{why} It is the earliest open high-priority step, in phase {phase}: {title}.",
  "{why} It is the earliest open medium-priority step, in phase {phase}: {title}.",
  "{why} It is the earliest open low-priority step, in phase {phase}: {title}.",
  'You chose this as your focus. The platform would recommend "{title}" first.',
  // Roadmap: what backs the status
  "{parts} of 4 record parts present.",
  "Linked to {names}.",
  "Rule-based fit: {score}/100 (strong). Inferred from what you declared.",
  "Rule-based fit: {score}/100 (good). Inferred from what you declared.",
  "Rule-based fit: {score}/100 (possible). Inferred from what you declared.",
  "Rule-based fit: {score}/100 (stretch). Inferred from what you declared.",
  "{done} of {total} machine types rated.",
  "{left} of {total} assumptions are still sample values. Replace each, confirm it with a quote, or accept it as it is.",
  "You claim {hs}. It is unverified.",
  "{n} of {total} marked resolved by you. The platform has verified none of them.",
  "{n} of {total} marked resolved by you. Eligibility is not determined here.",
  "{n} of {total} marked resolved by you.",
  "The calculator uses {rate}% as an assumption.",
  "At your numbers this export loses money: gross margin is {m}%.",
  "Gross margin {m}% is below your {target}% target at your assumptions.",
  "Gross margin {m}% meets your {target}% target, but {n} assumptions are still samples, so this is not settled.",
  "Gross margin {m}% meets your {target}% target at your assumptions. The selling price is not tested against the market.",
  "{n} required item missing.",
  "{n} required items missing.",
  "Fields are present, but {a} format error and {b} figure mismatch need fixing.",
  "Fields are present, but {a} format errors and {b} figure mismatch need fixing.",
  "Fields are present, but {a} format error and {b} figure mismatches need fixing.",
  "Fields are present, but {a} format errors and {b} figure mismatches need fixing.",
  "Fields are present and nothing looks malformed. {review} It is still a draft: {what}",
  "{done} of {total} items answered. Which documents are required is not verified.",
  "No expert brief saved yet. Requests are local to your browser: nothing is sent to anyone by the platform.",
  "{n} brief saved. You record whether you sent it.",
  "{n} briefs saved. You record whether you sent it.",
  "{n} of {total} charges confirmed by a quote.",
  "Marked completed by you. Nothing in your saved data can show this.",
  "Marked completed by you. Your saved data does not show it yet.",
  "Status set by you. {note}",
  // Documents: checks
  "Missing: {item}",
  "The invoice quantity ({a}) does not match the packing list units ({b}).",
  "HS code {hs} is your own claim. It has not been verified.",
  "The rows hold {a} units but the shipment is {b}.",
  "The rows use {a} cartons but the shipment is {b}.",
  // Backup file
  "That workspace file was made by a newer version ({version}). Update the app, then try again. Nothing was changed.",
  "The saved assessment for one product ({ref}…) could not be read and was skipped.",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One regex per template, longest literal text first so the most specific shape wins. */
const MATCHERS = TEMPLATES.map((tpl) => {
  const names: string[] = [];
  const body = tpl
    .split(/(\{\w+\})/)
    .map((part) => {
      const m = /^\{(\w+)\}$/.exec(part);
      if (!m) return escape(part);
      names.push(m[1]);
      return "([\\s\\S]+?)";
    })
    .join("");
  return { tpl, names, re: new RegExp(`^${body}$`), weight: tpl.replace(/\{\w+\}/g, "").length };
}).sort((x, y) => y.weight - x.weight);

/** A value that went into a sentence: translate it too if it is itself a known string (a phase title is lower-cased in English). */
function value(t: T, v: string): string {
  const cap = v.charAt(0).toUpperCase() + v.slice(1);
  const asCap = cap !== v ? t(cap) : cap;
  return asCap !== cap ? asCap : t(v);
}

/** Translate a sentence that lib code built at run time, or a plain string. English in, English out when there is no translation. */
export function tx(t: T, text: string): string {
  for (const m of MATCHERS) {
    const hit = m.re.exec(text);
    if (!hit) continue;
    const vars: Record<string, string> = {};
    m.names.forEach((n, i) => {
      const raw = hit[i + 1];
      vars[n] = n === "why" || n === "note" || n === "what" || n === "review" || n === "item" ? tx(t, raw) : value(t, raw);
    });
    return t(m.tpl, vars);
  }
  return t(text);
}

/** Fill a template with sample values and return the English sentence, for tests. */
export function sample(tpl: string, vars: Record<string, string> = {}): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "3");
}
