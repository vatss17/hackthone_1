import { LIMITS, parseMaterialField, type SuggestedProduct } from "../catalogue/parse.ts";

/**
 * Validation of AI output. The model is never trusted: whatever it returns is parsed, checked against a
 * schema, checked against the source text it was given, and stripped of anything that could pass as a
 * regulatory finding or a statistic it was not supplied. Anything that fails is dropped, not repaired.
 * Validated output is only ever SHOWN for review. It is never written to the database from here.
 */

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(t.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const inSource = (source: string, s: string) => norm(source).includes(norm(s));

/** Claims an assistant must never make: compliance, approval, certification, guarantees, eligibility. */
export const FORBIDDEN = /\b(compliant|complies|compliance with|approved|approval granted|certified|certification granted|guarantee[ds]?|will qualify|qualifies for|eligible for|is exempt|duty[- ]free|legally (?:required|permitted)|meets (?:the )?(?:standard|requirements))\b/i;

// ---- catalogue extraction ------------------------------------------------------------------------

export interface ExtractionResult {
  products: SuggestedProduct[];
  rejected: { name: string; reason: string }[];
}

export function validateExtraction(raw: Record<string, unknown> | null, source: string): ExtractionResult {
  const out: ExtractionResult = { products: [], rejected: [] };
  const list = raw && Array.isArray(raw.products) ? raw.products.slice(0, LIMITS.products) : [];
  const seen = new Set<string>();
  for (const item of list) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const name = str(o.name, LIMITS.name);
    if (!name || name.length < 2) {
      out.rejected.push({ name: "(unnamed)", reason: "no usable name" });
      continue;
    }
    // Grounding: a product that is not in the text the user supplied is a hallucination.
    if (!inSource(source, name)) {
      out.rejected.push({ name, reason: "the name does not appear in your catalogue text" });
      continue;
    }
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const notes: string[] = [];
    const description = str(o.description, LIMITS.description);
    const category = str(o.category, LIMITS.category);
    const intendedUse = str(o.intendedUse, LIMITS.use);
    const materials = Array.isArray(o.materials) ? parseMaterialField(o.materials.map((m) => str(m, 100) ?? "").filter(Boolean).join(", ")) : [];

    const specs: SuggestedProduct["specs"] = [];
    if (Array.isArray(o.specs)) {
      for (const s of o.specs.slice(0, LIMITS.specs)) {
        const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        const sn = str(so.name, LIMITS.specName);
        const sv = str(typeof so.value === "number" ? String(so.value) : so.value, LIMITS.specValue);
        if (!sn || !sv) continue;
        // Every figure in a specification must be a figure in the source text.
        const digits = sv.match(/\d[\d.,]*/g) ?? [];
        if (digits.some((d) => !source.includes(d.replace(/,$/, "")))) {
          notes.push(`The specification "${sn}" was left out because its value does not appear in your text.`);
          continue;
        }
        specs.push({ name: sn, value: sv, unit: str(so.unit, LIMITS.unit) });
      }
    }

    // A product code is only accepted if it is literally in the text. The model may never supply an HS code.
    const code = str(o.internalCode, LIMITS.code);
    const internalCode = code && source.includes(code) ? code : null;
    if (o.hsCode) notes.push("An HS code suggested by AI was ignored: classification must come from you and a specialist.");
    if (description && FORBIDDEN.test(description)) {
      out.rejected.push({ name, reason: "the description made a compliance or guarantee claim" });
      continue;
    }

    const aiConf = o.confidence === "high" || o.confidence === "medium" ? "medium" : "low"; // AI is never rated "high"
    notes.push("Suggested by AI. Check every field against your own catalogue.");
    const uncertainty = str(o.uncertainty, 300);
    if (uncertainty) notes.push(`AI uncertainty: ${uncertainty}`);
    out.products.push({
      index: out.products.length + 1,
      name,
      description,
      category,
      intendedUse,
      internalCode,
      hsCode: null,
      unitWeightG: null,
      materials,
      specs,
      source: { category: category ? "ai" : undefined, materials: materials.length ? "ai" : undefined },
      confidence: aiConf,
      notes,
      duplicateInFile: false,
      aiSuggested: true,
    } as SuggestedProduct);
  }
  return out;
}

// ---- explanations ----------------------------------------------------------------------------------

export interface Explanation {
  headline: string;
  whyItFits: string[];
  toolingToConfirm: string[];
  uncertainties: string[];
  industries: string[];
  confidence: "low" | "medium";
}

export interface ExplanationResult {
  value: Explanation;
  dropped: { text: string; reason: string }[];
}

export const numbersIn = (s: string): string[] => (s.match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/[,.]+$/, ""));

/** Numbers that appear in the supplied facts. The model may repeat these and nothing else. */
export function allowedNumbers(payload: unknown): Set<string> {
  return new Set(numbersIn(JSON.stringify(payload)));
}

export function validateExplanation(raw: Record<string, unknown> | null, allowed: Set<string>): ExplanationResult {
  const dropped: ExplanationResult["dropped"] = [];
  const clean = (v: unknown, max: number, limit: number): string[] => {
    const out: string[] = [];
    for (const item of Array.isArray(v) ? v.slice(0, limit * 2) : []) {
      const s = str(item, max);
      if (!s) continue;
      if (FORBIDDEN.test(s)) {
        dropped.push({ text: s, reason: "claims compliance, approval or a guarantee" });
        continue;
      }
      const stray = numbersIn(s).filter((n) => !allowed.has(n));
      if (stray.length) {
        dropped.push({ text: s, reason: `contains a figure that was not supplied (${stray[0]})` });
        continue;
      }
      out.push(s);
      if (out.length >= limit) break;
    }
    return out;
  };
  const headline = str(raw?.headline, 220);
  const headlineOk = headline && !FORBIDDEN.test(headline) && numbersIn(headline).every((n) => allowed.has(n));
  if (headline && !headlineOk) dropped.push({ text: headline, reason: "headline failed validation" });
  const value: Explanation = {
    headline: headlineOk ? (headline as string) : "",
    whyItFits: clean(raw?.whyItFits, 300, 5),
    toolingToConfirm: clean(raw?.toolingToConfirm, 300, 5),
    uncertainties: clean(raw?.uncertainties, 300, 6),
    industries: clean(raw?.industries, 120, 6),
    confidence: raw?.confidence === "medium" ? "medium" : "low",
  };
  return { value, dropped };
}

export const isUsable = (e: Explanation) => !!e.headline || e.whyItFits.length + e.uncertainties.length > 0;
