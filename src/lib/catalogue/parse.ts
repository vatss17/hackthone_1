import { recognise } from "../opportunities/engine.ts";
import type { MaterialCode } from "../opportunities/types.ts";

/**
 * Deterministic catalogue extraction: CSV and structured text (including text lifted from a PDF)
 * into SUGGESTED products for a person to review. No AI, no network, no storage: the text is
 * parsed in memory and the suggestions are returned to the caller.
 *
 * Nothing here decides anything for the user. Every suggestion is shown for review, and the
 * interface labels it "extracted by rules from your file", never as AI output.
 */

export const LIMITS = { chars: 300_000, products: 100, name: 200, description: 2000, category: 100, use: 500, code: 60, specName: 100, specValue: 500, unit: 30, specs: 25 } as const;

export interface ExtractedSpec {
  name: string;
  value: string;
  unit: string | null;
}

export interface SuggestedProduct {
  /** Position in the file, starting at 1. */
  index: number;
  name: string;
  description: string | null;
  category: string | null;
  intendedUse: string | null;
  internalCode: string | null;
  hsCode: string | null;
  unitWeightG: number | null;
  materials: { code: MaterialCode | null; label: string }[];
  specs: ExtractedSpec[];
  /** Which fields came straight from the file ("file") and which a rule suggested ("rule"). */
  source: Partial<Record<"category" | "materials", "file" | "rule" | "ai">>;
  /** True when an AI model suggested these values (only ever set by validated AI output). */
  aiSuggested?: boolean;
  confidence: "high" | "medium" | "low";
  /** Plain-language notes about things dropped or guessed. */
  notes: string[];
  /** The same name appears earlier in the file. */
  duplicateInFile: boolean;
}

export interface ParseOutcome {
  products: SuggestedProduct[];
  format: "csv" | "text" | "empty";
  warnings: string[];
  skippedBlocks: number;
  truncated: boolean;
}

// ---- small helpers -------------------------------------------------------------------------

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);
const clean = (s: string | undefined | null) => (s ?? "").replace(CONTROL, " ");

export function normaliseKey(h: string): { key: string; unit: string | null } {
  const m = h.match(/\(([^)]{1,20})\)\s*$/);
  const unit = m ? squash(m[1]) : null;
  const key = squash(h.replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, " "));
  return { key, unit };
}

type Field = "name" | "description" | "category" | "materials" | "use" | "code" | "hs" | "weight";
const SYNONYMS: Record<Field, string[]> = {
  name: ["name", "product", "product name", "item", "item name", "title", "product title"],
  description: ["description", "details", "desc", "about", "features", "product description", "overview"],
  category: ["category", "type", "family", "group", "product type", "segment", "range", "product category"],
  materials: ["material", "materials", "resin", "polymer", "raw material", "material grade", "grade"],
  use: ["use", "intended use", "application", "applications", "usage", "used for", "end use"],
  code: ["code", "sku", "item code", "product code", "model", "model no", "part number", "article", "article no", "ref", "reference"],
  hs: ["hs", "hs code", "hsn", "hsn code", "tariff code", "hs code claimed"],
  weight: ["weight", "unit weight", "net weight", "item weight", "weight each", "wt"],
};
const FIELD_OF = new Map<string, Field>(Object.entries(SYNONYMS).flatMap(([f, keys]) => keys.map((k) => [k, f as Field] as const)));

export function fieldFor(key: string): Field | null {
  return FIELD_OF.get(key) ?? null;
}

const VALUE_UNIT = /^(-?\d+(?:[.,]\d+)?)\s*([A-Za-zµ°%/²³][A-Za-zµ°%/²³ .]{0,11})?$/;

/** Splits "750 ml" into a number and a unit. Anything else stays text. */
export function splitValueUnit(raw: string, headerUnit: string | null = null): { value: string; unit: string | null } {
  const v = squash(raw);
  const m = v.match(VALUE_UNIT);
  if (!m) return { value: v, unit: null };
  const num = m[1].replace(",", ".");
  const unit = m[2] ? squash(m[2]) : headerUnit;
  return { value: String(Number(num)), unit: unit ? clip(unit, LIMITS.unit) : null };
}

/** Converts a weight to grams when the unit is a plain mass unit. */
export function weightToGrams(raw: string, headerUnit: string | null): number | null {
  const { value, unit } = splitValueUnit(raw, headerUnit);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (unit ?? "").toLowerCase().replace(/\./g, "");
  if (["g", "gm", "gms", "gram", "grams"].includes(u)) return Math.round(n * 1000) / 1000;
  if (["kg", "kgs", "kilogram", "kilograms"].includes(u)) return Math.round(n * 1000 * 1000) / 1000;
  return null;
}

const MATERIAL_NAMES: [RegExp, MaterialCode][] = [
  [/\blinear low[- ]density polyethylene\b/i, "LLDPE"],
  [/\blow[- ]density polyethylene\b/i, "LDPE"],
  [/\bhigh[- ]density polyethylene\b/i, "HDPE"],
  [/\bhigh[- ]impact polystyrene\b/i, "HIPS"],
  [/\bpolyethylene terephthalate\b/i, "PET"],
  [/\bpolypropylene\b/i, "PP"],
  [/\bpolyvinyl chloride\b/i, "PVC"],
  [/\bpolystyrene\b/i, "PS"],
  [/\bacrylonitrile butadiene styrene\b/i, "ABS"],
  [/\bpolycarbonate\b/i, "PC"],
  [/\b(polyamide|nylon)\b/i, "PA"],
  [/\b(pmma|acrylic)\b/i, "PMMA"],
  [/\bthermoplastic polyurethane\b/i, "TPU"],
  [/\bthermoplastic elastomer\b/i, "TPE"],
];
const MATERIAL_CODES: MaterialCode[] = ["PP", "HDPE", "LDPE", "LLDPE", "PET", "PVC", "PS", "HIPS", "ABS", "PC", "PA", "PMMA", "TPE", "TPU"];

/** Material codes named in a piece of text, in order of first appearance. */
export function materialsIn(text: string): MaterialCode[] {
  const found: { code: MaterialCode; at: number }[] = [];
  let rest = text;
  // Longer names first, and blank out what matched so "linear low-density polyethylene" is not also read as LDPE.
  for (const [re, code] of MATERIAL_NAMES) {
    const m = re.exec(rest);
    if (m) {
      found.push({ code, at: m.index });
      rest = rest.slice(0, m.index) + " ".repeat(m[0].length) + rest.slice(m.index + m[0].length);
    }
  }
  for (const code of MATERIAL_CODES) {
    const m = new RegExp(`(^|[^A-Za-z0-9])${code}(?![A-Za-z0-9])`).exec(rest);
    if (m) found.push({ code, at: m.index });
  }
  const seen = new Set<MaterialCode>();
  return found
    .sort((a, b) => a.at - b.at)
    .filter((f) => (seen.has(f.code) ? false : (seen.add(f.code), true)))
    .map((f) => f.code);
}

/** Turns an explicit "Material" cell into reference codes plus any custom names. */
export function parseMaterialField(raw: string): { code: MaterialCode | null; label: string }[] {
  const parts = raw.split(/[,;/+&\n]| and /i).map(squash).filter(Boolean);
  const out: { code: MaterialCode | null; label: string }[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const codes = materialsIn(part);
    const entries = codes.length > 0 ? codes.map((c) => ({ code: c as MaterialCode | null, label: c })) : [{ code: null, label: clip(part, 100) }];
    for (const e of entries) {
      const k = e.label.toLowerCase();
      if (e.label.length >= 2 && !seen.has(k)) {
        seen.add(k);
        out.push(e);
      }
    }
  }
  return out.slice(0, 8);
}

const HS_PATTERN = /^[0-9]{4}([.]?[0-9]{2}){0,3}$/;

// ---- CSV -----------------------------------------------------------------------------------

export function detectDelimiter(text: string): string | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 6);
  if (lines.length < 2) return null;
  let best: { d: string; score: number } | null = null;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => parseCsv(l, d)[0]?.length ?? 1);
    const first = counts[0];
    const consistent = counts.filter((c) => c === first).length / counts.length;
    if (first >= 2 && consistent >= 0.6) {
      const score = first * consistent;
      if (!best || score > best.score) best = { d, score };
    }
  }
  return best?.d ?? null;
}

/** RFC 4180-style parser: quoted cells, doubled quotes, newlines inside quotes, BOM. */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

// ---- building a suggestion ------------------------------------------------------------------

interface Raw {
  name?: string;
  description?: string[];
  category?: string;
  materials?: string;
  use?: string;
  code?: string;
  hs?: string;
  weight?: { raw: string; unit: string | null };
  specs: { name: string; raw: string; unit: string | null }[];
}

function build(raw: Raw, index: number, fromPdf: boolean): SuggestedProduct | null {
  const name = clip(squash(clean(raw.name)), LIMITS.name);
  if (name.length < 2 || !/[\p{L}\p{N}]/u.test(name)) return null;
  const notes: string[] = [];
  const description = clip(clean((raw.description ?? []).join("\n")).replace(/[ \t]+/g, " ").trim(), LIMITS.description) || null;

  let category = raw.category ? clip(squash(clean(raw.category)), LIMITS.category) || null : null;
  const source: SuggestedProduct["source"] = {};
  if (category) source.category = "file";
  else {
    const hit = recognise({ name, category: null, description });
    if (hit) {
      category = hit.group;
      source.category = "rule";
      notes.push("Category suggested by a rule from the product name. Check it.");
    }
  }

  let materials: SuggestedProduct["materials"] = [];
  if (raw.materials && squash(raw.materials)) {
    materials = parseMaterialField(clean(raw.materials));
    source.materials = "file";
  } else {
    const inferred = materialsIn(`${name}\n${description ?? ""}\n${raw.specs.map((s) => `${s.name} ${s.raw}`).join("\n")}`);
    if (inferred.length > 0) {
      materials = inferred.slice(0, 4).map((c) => ({ code: c, label: c }));
      source.materials = "rule";
      notes.push("Materials picked out of the text by a rule. Check them.");
    }
  }

  let hsCode: string | null = null;
  if (raw.hs && squash(raw.hs)) {
    const h = squash(raw.hs).replace(/\s/g, "");
    if (HS_PATTERN.test(h)) hsCode = h;
    else notes.push("The code in the HS column was not a valid 4, 6, 8 or 10 digit HS format, so it was left out.");
  }

  let unitWeightG: number | null = null;
  const specs: ExtractedSpec[] = [];
  if (raw.weight) {
    unitWeightG = weightToGrams(raw.weight.raw, raw.weight.unit);
    if (unitWeightG === null) {
      const s = splitValueUnit(raw.weight.raw, raw.weight.unit);
      specs.push({ name: "Weight", value: clip(s.value, LIMITS.specValue), unit: s.unit });
      notes.push("The weight was not in grams or kilograms, so it was kept as a specification instead.");
    }
  }
  const seenSpec = new Set(specs.map((s) => s.name.toLowerCase()));
  for (const s of raw.specs) {
    const n = clip(squash(clean(s.name)), LIMITS.specName);
    if (!n || !squash(clean(s.raw)) || seenSpec.has(n.toLowerCase())) continue;
    seenSpec.add(n.toLowerCase());
    const v = splitValueUnit(clean(s.raw), s.unit);
    specs.push({ name: n, value: clip(v.value, LIMITS.specValue), unit: v.unit });
    if (specs.length >= LIMITS.specs) break;
  }

  const fromFile = [description, raw.category, raw.materials, raw.use, specs.length > 0 ? "x" : null].filter((x) => x && String(x).trim()).length;
  const confidence: SuggestedProduct["confidence"] = fromPdf ? (fromFile >= 3 ? "medium" : "low") : fromFile >= 3 ? "high" : fromFile >= 2 ? "medium" : "low";
  if (fromPdf) notes.push("Read from a PDF, where layout is lost. Check every field.");

  return {
    index,
    name,
    description,
    category,
    intendedUse: raw.use ? clip(squash(clean(raw.use)), LIMITS.use) || null : null,
    internalCode: raw.code ? clip(squash(clean(raw.code)), LIMITS.code) || null : null,
    hsCode,
    unitWeightG,
    materials,
    specs,
    source,
    confidence,
    notes,
    duplicateInFile: false,
  };
}

function fromCsv(text: string, delimiter: string, fromPdf: boolean): { products: SuggestedProduct[]; warnings: string[]; skipped: number } {
  const rows = parseCsv(text, delimiter);
  const warnings: string[] = [];
  if (rows.length < 2) return { products: [], warnings: ["The file has a header row but no product rows."], skipped: 0 };
  const header = rows[0].map((h) => normaliseKey(clean(h)));
  const mapped = header.map((h) => fieldFor(h.key));
  if (!mapped.includes("name")) {
    // No recognisable name column: assume the first column holds the product names.
    mapped[0] = "name";
    warnings.push("No column was called Name or Product, so the first column was used for product names.");
  }
  const products: SuggestedProduct[] = [];
  let skipped = 0;
  rows.slice(1).forEach((cells, r) => {
    const raw: Raw = { specs: [] };
    cells.forEach((cell, c) => {
      const v = clean(cell).trim();
      if (!v || c >= header.length) return;
      const f = mapped[c];
      if (f === "description") (raw.description ??= []).push(v);
      else if (f === "weight") raw.weight = { raw: v, unit: header[c].unit };
      else if (f) (raw as unknown as Record<string, unknown>)[f] = v;
      else raw.specs.push({ name: titleCase(header[c].key || `Column ${c + 1}`), raw: v, unit: header[c].unit });
    });
    const p = build(raw, r + 1, fromPdf);
    if (p) products.push(p);
    else skipped++;
  });
  return { products, warnings, skipped };
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// ---- structured text -------------------------------------------------------------------------

const BULLET = /^\s*(?:[-*•▪●◦·]|\d{1,3}[.)])\s+/;
const KEY_VALUE = /^([A-Za-z][A-Za-z0-9 /&%.\-()]{0,40}?)\s*[:=]\s*(.+)$/;
const SEPARATOR = /^\s*([-=_*#~]){3,}\s*$/;

function blocksOf(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) blocks.push(cur);
    cur = [];
  };
  for (const line of lines) {
    if (SEPARATOR.test(line) || line.trim() === "") flush();
    else cur.push(line);
  }
  flush();
  // A lone bare line followed by a block of details (a name, a blank line, then Key: value lines)
  // belongs with that block. A lone line followed by a block that has its own name is a heading.
  const merged: string[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    const bare = b.length === 1 && !KEY_VALUE.test(b[0].replace(BULLET, "")) && !BULLET.test(b[0]);
    if (bare && next) {
      const first = next[0].replace(BULLET, "");
      const kv = first.match(KEY_VALUE);
      const nextHasName = kv ? fieldFor(normaliseKey(kv[1]).key) === "name" : !BULLET.test(next[0]) && next[0].trim().length <= 120 && !kv;
      if (kv && !nextHasName) {
        merged.push([...b, ...next]);
        i++;
        continue;
      }
    }
    merged.push(b);
  }
  return merged;
}

function fromText(text: string, fromPdf: boolean): { products: SuggestedProduct[]; skipped: number } {
  const products: SuggestedProduct[] = [];
  let skipped = 0;
  const finish = (raw: Raw) => {
    // A block that is only a heading (a section title) is not a product.
    const detail = (raw.description?.length ?? 0) + raw.specs.length + [raw.category, raw.materials, raw.use, raw.code, raw.hs, raw.weight].filter(Boolean).length;
    const p = detail > 0 ? build(raw, products.length + skipped + 1, fromPdf) : null;
    if (p) products.push(p);
    else skipped++;
  };
  for (const block of blocksOf(text)) {
    let raw: Raw = { specs: [] };
    let first = true;
    for (const original of block) {
      const line = squash(clean(original).replace(BULLET, ""));
      if (!line) continue;
      const kv = line.match(KEY_VALUE);
      // A "Product:" or "Name:" line always starts a new product, whatever came before it.
      if (kv && fieldFor(normaliseKey(kv[1]).key) === "name" && (raw.name || raw.specs.length || raw.description?.length)) {
        finish(raw);
        raw = { specs: [] };
        first = true;
      }
      if (kv) {
        const { key, unit } = normaliseKey(kv[1]);
        const f = fieldFor(key);
        const value = kv[2].trim();
        if (f === "name") raw.name ??= value;
        else if (f === "description") (raw.description ??= []).push(value);
        else if (f === "weight") raw.weight = { raw: value, unit };
        else if (f) (raw as unknown as Record<string, unknown>)[f] = value;
        else if (key && value.length <= 200) raw.specs.push({ name: titleCase(key), raw: value, unit });
        else (raw.description ??= []).push(line);
      } else if (first && !raw.name && line.length <= 120) {
        raw.name = line.replace(/[:\-–]+$/, "").trim();
      } else {
        (raw.description ??= []).push(line);
      }
      first = false;
    }
    finish(raw);
  }
  return { products, skipped };
}

// ---- entry point ------------------------------------------------------------------------------

export function parseCatalogue(input: string, opts: { fromPdf?: boolean } = {}): ParseOutcome {
  const fromPdf = opts.fromPdf === true;
  const warnings: string[] = [];
  let text = input.replace(/^﻿/, "");
  let truncated = false;
  if (text.length > LIMITS.chars) {
    text = text.slice(0, LIMITS.chars);
    truncated = true;
    warnings.push(`The file is very long, so only the first ${LIMITS.chars.toLocaleString("en-IN")} characters were read.`);
  }
  if (text.trim() === "") return { products: [], format: "empty", warnings: ["There is no text to read."], skippedBlocks: 0, truncated };

  // CSV only when it clearly is one: a consistent delimiter AND not mostly "Key: value" lines.
  const delimiter = fromPdf ? null : detectDelimiter(text);
  const kvLines = text.split(/\r?\n/).filter((l) => KEY_VALUE.test(l.replace(BULLET, "")));
  const looksStructuredText = kvLines.length >= 3;

  let products: SuggestedProduct[];
  let skipped = 0;
  let format: ParseOutcome["format"];
  if (delimiter && !looksStructuredText) {
    const r = fromCsv(text, delimiter, fromPdf);
    products = r.products;
    skipped = r.skipped;
    warnings.push(...r.warnings);
    format = "csv";
  } else {
    const r = fromText(text, fromPdf);
    products = r.products;
    skipped = r.skipped;
    format = "text";
  }

  if (products.length > LIMITS.products) {
    products = products.slice(0, LIMITS.products);
    truncated = true;
    warnings.push(`Only the first ${LIMITS.products} products are shown. Import the rest in a second file.`);
  }
  const seen = new Set<string>();
  for (const p of products) {
    const k = p.name.toLowerCase();
    p.duplicateInFile = seen.has(k);
    seen.add(k);
  }
  if (products.length === 0) warnings.push("No products could be picked out. Try a CSV with a Name column, or text with a line per product and Key: value details.");
  return { products, format, warnings, skippedBlocks: skipped, truncated };
}

/** A sample catalogue for the presentation. It is fictional and always labelled as a demo. */
export const DEMO_CATALOGUE = `DEMO SAMPLE CATALOGUE (fictional, for demonstration only)

Product: Stackable Storage Crate 40L
Category: Household storage
Material: HDPE
Use: Home, garage and small-business storage
Description: Ventilated stackable crate with reinforced handles. Available in grey and blue.
Capacity: 40 litres
Weight: 1.1 kg
Colour: Grey, blue
Code: SC-40

Product: Seedling Tray 24 Cell
Category: Garden and horticulture
Material: Polypropylene
Use: Raising seedlings in nurseries and gardens
Description: Lightweight reusable tray with drainage holes in every cell.
Cells: 24
Weight: 85 g
Code: ST-24

Product: Laundry Hanger Set of 12
Material: PP
Use: Wardrobe and laundry use
Description: Non-slip hangers with a swivel hook, sold in sets of twelve.
Pieces per set: 12
Weight: 0.45 kg

Product: Drip Irrigation Tubing 16mm
Category: Water and irrigation
Material: LLDPE
Use: Garden and farm drip irrigation lines
Description: Flexible 16 mm tubing supplied in 100 metre coils.
Diameter (mm): 16
Length (m): 100
`;
