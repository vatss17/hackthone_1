import { LOCALE_NAMES, type Locale } from "../i18n/config.ts";

/**
 * Image and document understanding: what may be asked of the model, and the checks every answer passes before a person sees it.
 * The model only READS and DESCRIBES. It never decides a specification, a throughput, a classification or a compliance fact,
 * and nothing it returns is saved: the person reviews each field and applies only what they confirm.
 */

export const VISION_KINDS = ["nameplate", "machine_photo", "material_label", "product_photo", "drawing"] as const;
export type VisionKind = (typeof VISION_KINDS)[number];
export const isVisionKind = (v: unknown): v is VisionKind => typeof v === "string" && (VISION_KINDS as readonly string[]).includes(v);

export type FieldSource = "read" | "inferred" | "unknown";

export interface VisionField {
  key: string;
  /** English label from this table, never from the model. The interface translates it. */
  label: string;
  value: string | null;
  /** The unit exactly as printed, or null. */
  unit: string | null;
  source: FieldSource;
  note: string | null;
}

export interface VisionResult {
  kind: VisionKind;
  fields: VisionField[];
  summary: string;
  warnings: string[];
}

/** Allowed field keys per kind, with the English label shown to the person. Keys ending in * allow a numbered series. */
export const FIELD_TABLE: Record<VisionKind, Record<string, string>> = {
  nameplate: {
    manufacturer: "Manufacturer",
    model: "Model number",
    machine_type: "Machine type",
    clamping_force: "Clamping force",
    rated_capacity: "Rated capacity",
    screw_diameter: "Screw diameter",
    power: "Power",
    voltage: "Voltage",
    frequency: "Frequency",
    year: "Year of manufacture",
    other_spec: "Other printed specification",
  },
  machine_photo: {
    machine_type: "Machine type (from appearance)",
    brand: "Brand (if visible)",
    model: "Model (if visible)",
    visible_components: "Visible components",
    condition_note: "What is visible",
  },
  material_label: {
    manufacturer: "Manufacturer",
    polymer_type: "Polymer type",
    grade: "Grade",
    melt_flow_index: "Melt flow index",
    density: "Density",
    colour: "Colour",
    net_weight: "Net weight",
    other_spec: "Other printed specification",
  },
  product_photo: {
    category: "Product category",
    description: "Description of what is visible",
    colour: "Colour",
    shape: "Shape",
    visible_features: "Visible features",
    likely_material: "Likely material (a guess)",
    needs_confirmation: "To confirm yourself",
  },
  drawing: {
    product_name: "Product name or part number",
    "dimension_*": "Dimension",
    material: "Material (as printed)",
    weight: "Weight",
    "tolerance_*": "Tolerance",
    other_spec: "Other printed specification",
  },
};

/** Never accepted, whatever the model returns: these cannot be known from a picture, or are decisions for others. */
const FORBIDDEN_KEY = /(hs[_ -]?code|hsn|tariff|throughput|output|production[_ -]?rate|capacity[_ -]?per|cycle[_ -]?time|compliance|certif|approved|verified|price|cost)/i;
const THROUGHPUT_VALUE = /\b\d[\d.,]*\s*(?:kg|kgs|units?|pcs|pieces|shots|tonnes?|tons?)\s*(?:\/|per)\s*(?:h|hr|hour|min|minute|day|shift|month)\b/i;
/** From the pictures alone only brand and model can be READ in a photograph; everything else about a machine or product is a guess. */
const PHOTO_READABLE = new Set(["brand", "model"]);
const MAX_FIELDS = 24;

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

const EMPTY = /^(?:unknown|illegible|unreadable|not (?:visible|readable|legible|shown|printed)|n\/a|none|null|-+|\?+)$/i;

export function labelFor(kind: VisionKind, key: string): string | null {
  const table = FIELD_TABLE[kind];
  if (key in table) return table[key];
  const series = /^(dimension|tolerance)_(\d{1,2})$/.exec(key);
  if (series && `${series[1]}_*` in table) return `${table[`${series[1]}_*`]} ${series[2]}`;
  return null;
}

/** Validates a model answer. Returns null when it is not an object with a usable `fields` list. */
export function validateVision(kind: VisionKind, raw: unknown): VisionResult | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.fields)) return null;
  const warnings: string[] = [];
  const seen = new Set<string>();
  const fields: VisionField[] = [];
  for (const f of r.fields.slice(0, 60)) {
    if (typeof f !== "object" || f === null) continue;
    const o = f as Record<string, unknown>;
    const key = clean(o.key, 40).toLowerCase();
    if (!key || seen.has(key)) continue;
    if (FORBIDDEN_KEY.test(key)) {
      warnings.push(`Ignored "${key}": it cannot be read from a picture or decided here.`);
      continue;
    }
    const label = labelFor(kind, key);
    if (!label) continue;
    let value: string | null = clean(o.value, 160);
    const unit = clean(o.unit, 16) || null;
    if (!value || EMPTY.test(value)) value = null;
    if (value && THROUGHPUT_VALUE.test(`${value} ${unit ?? ""}`)) {
      warnings.push("A production rate was ignored: it cannot be known from a picture.");
      continue;
    }
    let source: FieldSource = o.source === "read" || o.source === "inferred" || o.source === "unknown" ? o.source : value ? "inferred" : "unknown";
    if (value === null) source = "unknown";
    // A photograph of a machine or product can only show brand and model text; every other value is a guess, however sure the model sounds.
    if ((kind === "machine_photo" || kind === "product_photo") && source === "read" && !PHOTO_READABLE.has(key)) source = "inferred";
    if (kind === "product_photo" && key === "likely_material" && source === "read") source = "inferred";
    seen.add(key);
    fields.push({ key, label, value, unit, source, note: clean(o.note, 200) || null });
    if (fields.length >= MAX_FIELDS) break;
  }
  // A printed number with no printed unit stays as it is and is flagged, never converted or guessed.
  for (const f of fields) {
    if (f.value && f.source === "read" && /^\d[\d.,]*$/.test(f.value) && !f.unit && ["clamping_force", "rated_capacity", "power", "voltage", "frequency", "weight", "melt_flow_index", "density"].includes(f.key)) {
      f.note = f.note ?? "No unit was readable next to this number. Check it before you use it.";
      warnings.push(`${f.label}: unit not readable.`);
    }
  }
  for (const w of Array.isArray(r.warnings) ? r.warnings.slice(0, 5) : []) {
    const t = clean(w, 200);
    if (t && !/hs[ -]?code|hsn/i.test(t)) warnings.push(t);
  }
  const summary = clean(r.summary, 400);
  if (fields.length === 0 && !summary) return null;
  return { kind, fields, summary, warnings: [...new Set(warnings)].slice(0, 8) };
}

const COMMON_RULES = [
  "You are reading a photograph or document supplied by an Indian plastics manufacturer. Report only what you can see.",
  "Reply with a single JSON object: {\"fields\":[{\"key\":string,\"value\":string|null,\"unit\":string|null,\"source\":\"read\"|\"inferred\"|\"unknown\",\"note\":string|null}],\"summary\":string,\"warnings\":string[]}.",
  "source=\"read\" ONLY for text or numbers actually printed in the image. source=\"inferred\" for anything you deduce from appearance. If something is unreadable or absent, set value to null and source to \"unknown\". Never guess a number.",
  "Copy printed values and units EXACTLY as written (for example \"150 T\", \"3 PH 415 V\", \"MFI 20 g/10min\"). Do not convert units. If a unit or a digit is ambiguous, say so in note.",
  "Never state production throughput, output rate, cycle time, price, an HS or HSN code, a tariff, or whether anything is certified, compliant or approved.",
  "Do not identify people. If the image is not what was asked for, return an empty fields list and say so in summary.",
];

const KIND_RULES: Record<VisionKind, string[]> = {
  nameplate: [
    "The image is a machine nameplate or data plate. Allowed keys: manufacturer, model, machine_type, clamping_force, rated_capacity, screw_diameter, power, voltage, frequency, year, other_spec (use other_spec once per extra printed line, with the printed label in note).",
    "Return clamping force and capacity exactly as printed with their unit in `unit`.",
  ],
  machine_photo: [
    "The image is a photograph of a machine. Allowed keys: machine_type, brand, model, visible_components, condition_note.",
    "machine_type is an inference from appearance (for example injection moulding machine, extruder, blow moulding machine): mark it inferred. brand and model count as read only if the lettering is legible. Do not estimate tonnage, size, speed or output.",
  ],
  material_label: [
    "The image is a raw-material bag, sack or label. Allowed keys: manufacturer, polymer_type, grade, melt_flow_index, density, colour, net_weight, other_spec.",
    "polymer_type and grade are read only if printed. Do not infer a grade that is not printed.",
  ],
  product_photo: [
    "The image is a photograph of a finished plastic product. Allowed keys: category, description, colour, shape, visible_features, likely_material, needs_confirmation.",
    "Everything here is inferred from appearance. likely_material is a guess and must be marked inferred. Never give dimensions or weight. In needs_confirmation list, in one value, the specifications a person must confirm (material, weight, dimensions, wall thickness, intended use).",
  ],
  drawing: [
    "The image or PDF is a technical drawing or specification sheet. Allowed keys: product_name, dimension_1, dimension_2, … (one per printed dimension, label in note), material, weight, tolerance_1, tolerance_2, … , other_spec.",
    "Copy every printed dimension, tolerance and unit exactly. Do not compute or convert any value.",
  ],
};

export function visionSystem(kind: VisionKind, locale: Locale): string {
  const lang = LOCALE_NAMES[locale].geminiName;
  return [
    ...COMMON_RULES,
    ...KIND_RULES[kind],
    `Write summary, warnings and notes in ${lang}. Keep printed text, numbers, units, brand names, model numbers and polymer grades exactly as they appear (do not translate or transliterate them).`,
  ].join("\n");
}

export const VISION_USER = "Analyse the attached image or document and reply with the JSON object only.";
export const VISION_MAX_TOKENS = 900;
export const VISION_TIMEOUT_MS = 40_000;
