/**
 * Counts with correct plurals, in one place, so a count never renders as "process es" or "factor y" and one unit never reads "1 processes".
 * Regular rules plus the irregular nouns this product uses.
 */

const IRREGULAR: Record<string, string> = { process: "processes", factory: "factories", match: "matches", specification: "specifications", gap: "gaps", assumption: "assumptions", capability: "capabilities", opportunity: "opportunities", category: "categories", family: "families", mismatch: "mismatches", box: "boxes", status: "statuses" };

export function pluralOf(noun: string): string {
  const lower = noun.toLowerCase();
  if (IRREGULAR[lower]) return noun[0] === noun[0].toUpperCase() && noun.length > 1 ? IRREGULAR[lower][0].toUpperCase() + IRREGULAR[lower].slice(1) : IRREGULAR[lower];
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

/** "1 process", "2 processes", "0 processes". */
export function count(n: number, noun: string, plural?: string): string {
  return `${n} ${n === 1 ? noun : (plural ?? pluralOf(noun))}`;
}

/** Just the right word for a count: "machine" or "machines". */
export const noun = (n: number, singular: string, plural?: string): string => (n === 1 ? singular : (plural ?? pluralOf(singular)));
