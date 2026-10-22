import { HEADING_LABELS, HEADINGS_FOR_ENTRY } from "../trade/headings.ts";

/**
 * "Help me find it": candidate HS headings for a plastic product, found by simple keyword rules.
 *
 * These are CANDIDATES for the manufacturer to check, never a classification. Only 4-digit headings are suggested; the
 * code used in an Indian export is 8 digits and is a matter for the manufacturer's customs broker or the authority.
 * No AI is used. Nothing is saved. Every result carries its rationale, what makes it ambiguous, and what must be confirmed.
 */

interface Rule {
  heading: string;
  terms: string[];
  why: string;
}

const RULES: Rule[] = [
  { heading: "3923", why: "Articles for the conveyance or packing of goods: boxes, crates, bottles, caps, lids and similar.", terms: ["container", "lid", "closure", "cap", "bottle", "crate", "box", "bin", "tub", "jar", "packaging", "pallet", "tray", "basket", "carton"] },
  { heading: "3924", why: "Tableware, kitchenware and other household articles.", terms: ["tableware", "kitchen", "household", "bucket", "mug", "jug", "basin", "laundry", "food storage", "bowl", "tumbler", "plate", "spoon", "dustbin"] },
  { heading: "3917", why: "Tubes, pipes, hoses and their fittings.", terms: ["pipe", "tube", "tubing", "hose", "fitting", "elbow", "conduit", "duct", "coupling", "irrigation"] },
  { heading: "3916", why: "Profile shapes, rods and sticks.", terms: ["profile", "rod", "stick", "trim", "section", "monofilament"] },
  { heading: "3925", why: "Builders' ware: tanks, doors, windows and similar.", terms: ["tank", "cistern", "door", "window", "shutter", "builders"] },
  { heading: "3926", why: "Other articles of plastics, a residual heading.", terms: ["hanger", "clip", "handle", "gasket", "seedling", "nursery", "planter", "organiser", "organizer"] },
  { heading: "9403", why: "Furniture. The heading covers all materials, not only plastic.", terms: ["chair", "table", "stool", "furniture", "bench"] },
];

const PAIR_NOTES: [string, string, string][] = [
  ["3923", "3924", "3923 covers articles used to pack or carry goods, while 3924 covers household and kitchen use. The same box can fall under either depending on how it is mainly used."],
  ["3917", "3926", "Pipes and fittings go under 3917, but an article that merely looks like a tube or clip may be classed as an other article under 3926."],
  ["3925", "3926", "Builders' ware (3925) is specific to construction use. Anything else of that shape tends to fall to the residual 3926."],
];

export interface Candidate {
  heading: string;
  label: string;
  /** Words from the description that pointed here, or "the product type" when it came from the catalogue match. */
  basis: string[];
  rationale: string;
  ambiguity: string;
}

export interface CandidateResult {
  candidates: Candidate[];
  /** What the manufacturer still has to do, always shown. */
  confirm: string;
  /** Why nothing was suggested, when that is the case. */
  none: string;
}

export const CONFIRM_TEXT = "Unverified. These are 4-digit starting points only. The 8-digit HSN used on Indian export documents, and the UAE import code, must be confirmed with your customs broker or the authority.";

const words = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;

export function findCandidates(input: { name?: string | null; category?: string | null; description?: string | null; use?: string | null; extra?: string | null; catalogueId?: string | null }): CandidateResult {
  const text = words([input.name, input.category, input.description, input.use, input.extra].filter(Boolean).join(" "));
  const found = new Map<string, { basis: Set<string>; why: string }>();
  for (const r of RULES) {
    const hit = r.terms.filter((t) => text.includes(` ${t} `) || text.includes(` ${t}s `) || text.includes(` ${t}es `));
    if (hit.length) found.set(r.heading, { basis: new Set(hit), why: r.why });
  }
  if (input.catalogueId) {
    for (const h of HEADINGS_FOR_ENTRY[input.catalogueId] ?? []) {
      const cur = found.get(h) ?? { basis: new Set<string>(), why: RULES.find((r) => r.heading === h)?.why ?? HEADING_LABELS[h] };
      cur.basis.add("the product type");
      found.set(h, cur);
    }
  }
  const ranked = [...found.entries()].sort((a, b) => b[1].basis.size - a[1].basis.size || a[0].localeCompare(b[0])).slice(0, 3);
  const headings = ranked.map(([h]) => h);
  const candidates: Candidate[] = ranked.map(([h, v]) => {
    const others = headings.filter((x) => x !== h);
    const note = PAIR_NOTES.find(([a, b]) => (a === h && others.includes(b)) || (b === h && others.includes(a)));
    return {
      heading: h,
      label: HEADING_LABELS[h],
      basis: [...v.basis],
      rationale: v.why,
      ambiguity: note ? note[2] : others.length ? `Other headings may also fit (${others.join(", ")}). Which one applies depends on the exact product and how it is mainly used.` : "Only one heading came up, but that does not mean it is correct. The exact product and its main use decide.",
    };
  });
  return { candidates, confirm: CONFIRM_TEXT, none: candidates.length ? "" : "Nothing in the description matched a plastic product heading. Add what it is, what it is made of and what it is used for, or ask an expert." };
}
