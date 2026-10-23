import type { AppliedField } from "../../components/ai-input/image-assist.tsx";
import { MATERIAL_CODES, PROCESS_CODES, type MaterialCodeV, type ProcessCodeV } from "./voice.ts";

/**
 * How confirmed photo fields land in the EXISTING forms. These functions only choose which form control each value belongs
 * to; they never convert units or invent a value. When a printed value has no matching control, or its unit is not the one the
 * form stores, it is returned in `unmapped` so the person can type it themselves.
 */

export interface Mapped {
  /** Form control name → value to add. */
  values: Record<string, string>;
  /** Fields with no matching control, or whose unit the form cannot store as printed, with a short reason. */
  unmapped: { key: string; value: string; reason: string }[];
}

type F = Pick<AppliedField, "key" | "value" | "unit">;
const find = (fields: F[], key: string) => fields.find((f) => f.key === key && f.value.trim());

/** "150 T" / ("150", "tonnes") → 150 and the unit text, whichever way it was printed. */
export function splitQuantity(value: string, unit: string | null): { number: string; unit: string } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(value);
  if (!m) return null;
  return { number: m[1].replace(",", "."), unit: (unit ?? m[2] ?? "").trim() || m[2].trim() };
}

const TONNES = /^(?:t|ton|tons|tonne|tonnes|tonnage|mt)\.?$/i;
const KG_H = /^kg\s*(?:\/|per)\s*h(?:r|our)?s?$/i;
const PCS_H = /^(?:pcs|pieces|nos)\s*(?:\/|per)\s*h(?:r|our)?s?$/i;
const MM = /^mm$/i;

export function processFromText(text: string): ProcessCodeV | null {
  const t = text.toLowerCase();
  if (/injection|इंजेक्शन|ઇન્જેક્શન|ઈન્જેક્શન/.test(t)) return "injection_moulding";
  if (/blow|ब्लो|બ્લો/.test(t)) return "blow_moulding";
  if (/extru|एक्सट्रू|એક્સ્ટ્રુ/.test(t)) return "extrusion";
  if (/thermoform/.test(t)) return "thermoforming";
  if (/rotation|roto/.test(t)) return "rotational_moulding";
  if (/compression/.test(t)) return "compression_moulding";
  return PROCESS_CODES.find((c) => c === t.trim()) ?? null;
}

const MATERIAL_ALIASES: [RegExp, MaterialCodeV][] = [
  [/\bhdpe\b|high[- ]density polyethylene/i, "HDPE"],
  [/\bllde?pe\b|linear low/i, "LLDPE"],
  [/\bldpe\b|low[- ]density polyethylene/i, "LDPE"],
  [/\bhips\b|high[- ]impact polystyrene/i, "HIPS"],
  [/\bpolypropylene\b|\bpp\b/i, "PP"],
  [/\bpet\b|terephthalate/i, "PET"],
  [/\bpvc\b|polyvinyl chloride/i, "PVC"],
  [/\babs\b|acrylonitrile/i, "ABS"],
  [/\bpolycarbonate\b|\bpc\b/i, "PC"],
  [/\bpolystyrene\b|\bps\b/i, "PS"],
  [/\bnylon\b|polyamide|\bpa6?6?\b/i, "PA"],
  [/\bpmma\b|acrylic/i, "PMMA"],
  [/\btpe\b/i, "TPE"],
  [/\btpu\b/i, "TPU"],
];

/** The polymer code named in a printed polymer type or grade. Only an explicit name or code counts: a grade alone never decides it. */
export function materialFromText(text: string): MaterialCodeV | null {
  for (const [re, code] of MATERIAL_ALIASES) if (re.test(text)) return code;
  return MATERIAL_CODES.find((c) => c === text.trim().toUpperCase()) ?? null;
}

/** Nameplate → the machine form (name, make, model, rating, rating unit). */
export function nameplateToMachine(fields: F[]): Mapped & { process: ProcessCodeV | null } {
  const values: Record<string, string> = {};
  const unmapped: Mapped["unmapped"] = [];
  const make = find(fields, "manufacturer");
  const model = find(fields, "model");
  if (make) values.make = make.value;
  if (model) values.model = model.value;
  if (make || model) values.name = [make?.value, model?.value].filter(Boolean).join(" ");

  const rating = (key: string, test: (u: string) => string | null) => {
    const f = find(fields, key);
    if (!f) return false;
    const q = splitQuantity(f.value, f.unit);
    const unit = q && test(q.unit);
    if (q && unit) {
      values.ratingValue = q.number;
      values.ratingUnit = unit;
      return true;
    }
    unmapped.push({ key, value: f.unit && !f.value.includes(f.unit) ? `${f.value} ${f.unit}` : f.value, reason: "The form stores this rating in a different unit. Atlas does not convert units: enter it yourself if it applies." });
    return false;
  };
  const done =
    rating("clamping_force", (u) => (TONNES.test(u) ? "tonnes_clamp_force" : null)) ||
    rating("rated_capacity", (u) => (KG_H.test(u) ? "kg_per_hour" : PCS_H.test(u) ? "pieces_per_hour" : null)) ||
    rating("screw_diameter", (u) => (MM.test(u) ? "mm_screw_diameter" : null));
  void done;

  for (const f of fields) {
    if (["manufacturer", "model", "clamping_force", "rated_capacity", "screw_diameter"].includes(f.key)) continue;
    if (f.key === "machine_type") continue;
    unmapped.push({ key: f.key, value: f.unit && !f.value.includes(f.unit) ? `${f.value} ${f.unit}` : f.value, reason: f.key === "year" ? "This is the year of manufacture. The form asks for the year it was installed, which may differ." : "The machine form has no field for this." });
  }
  return { values, unmapped, process: processFromText(find(fields, "machine_type")?.value ?? "") };
}

/** Raw-material label → the material form. The polymer must be named; the grade has no field and is kept for the person to note. */
export function labelToMaterial(fields: F[]): Mapped & { material: MaterialCodeV | null } {
  const unmapped: Mapped["unmapped"] = [];
  const poly = find(fields, "polymer_type");
  const grade = find(fields, "grade");
  const material = (poly && materialFromText(poly.value)) || (grade && materialFromText(grade.value)) || null;
  for (const f of fields) {
    if (f.key === "polymer_type" && material) continue;
    unmapped.push({ key: f.key, value: f.unit && !f.value.includes(f.unit) ? `${f.value} ${f.unit}` : f.value, reason: f.key === "grade" ? "The material form has no grade field. Note it in your product specifications." : "The material form has no field for this." });
  }
  return { values: {}, unmapped, material };
}

export interface SpecRow {
  name: string;
  value: string;
  unit: string;
}

/** Photo or drawing → the product form: description, category, weight in grams, and specification rows. */
export function toProductForm(fields: F[]): Mapped & { specs: SpecRow[] } {
  const values: Record<string, string> = {};
  const unmapped: Mapped["unmapped"] = [];
  const specs: SpecRow[] = [];
  const put = (name: string, value: string, unit = "") => specs.push({ name, value, unit });
  for (const f of fields) {
    const v = f.value.trim();
    if (!v) continue;
    if (f.key === "category") values.category = v;
    else if (f.key === "product_name") values.name = v;
    else if (f.key === "description") values.description = v;
    else if (f.key === "visible_features" || f.key === "shape" || f.key === "colour") values.description = [values.description, `${f.key === "colour" ? "Colour" : f.key === "shape" ? "Shape" : "Features"}: ${v}`].filter(Boolean).join(". ");
    else if (f.key === "weight") {
      const q = splitQuantity(v, f.unit);
      if (q && /^g(?:m|ram|rams)?s?$/i.test(q.unit)) values.unitWeightG = q.number;
      else put("Weight", q ? q.number : v, q?.unit ?? f.unit ?? "");
    } else if (f.key === "material" || f.key === "likely_material") put(f.key === "likely_material" ? "Material (to confirm)" : "Material", v);
    else if (/^dimension_\d+$/.test(f.key)) {
      const q = splitQuantity(v, f.unit);
      put(`Dimension ${f.key.split("_")[1]}`, q ? q.number : v, q?.unit ?? f.unit ?? "");
    } else if (/^tolerance_\d+$/.test(f.key)) put(`Tolerance ${f.key.split("_")[1]}`, v, f.unit ?? "");
    else if (f.key === "other_spec") put("Other", v, f.unit ?? "");
    else if (f.key === "needs_confirmation") unmapped.push({ key: f.key, value: v, reason: "Things to confirm yourself before you rely on this product record." });
    else unmapped.push({ key: f.key, value: v, reason: "The product form has no field for this." });
  }
  return { values, unmapped, specs: specs.slice(0, 5) };
}
