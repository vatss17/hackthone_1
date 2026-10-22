/**
 * Pure validation for the manufacturing-profile forms. Mirrors the database CHECK constraints so
 * people get a clear message first; the database remains the final authority.
 */

export const CAPACITY_UNITS = [
  { value: "kg", label: "kg" },
  { value: "tonnes", label: "tonnes" },
  { value: "pieces", label: "pieces" },
  { value: "metres", label: "metres" },
  { value: "m2", label: "m²" },
] as const;

export const CAPACITY_PERIODS = [
  { value: "day", label: "per day" },
  { value: "month", label: "per month" },
  { value: "year", label: "per year" },
] as const;

export const RATING_UNITS = [
  { value: "tonnes_clamp_force", label: "tonnes clamp force (injection presses)" },
  { value: "g_shot_weight", label: "g shot weight (injection presses)" },
  { value: "kg_per_hour", label: "kg per hour (extruders and others)" },
  { value: "pieces_per_hour", label: "pieces per hour" },
  { value: "mm_screw_diameter", label: "mm screw diameter (extruders)" },
] as const;

const CONTROL = /[\u0000-\u001f\u007f]/;

export function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Multi-line text keeps line breaks but is trimmed. */
export function cleanLong(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

export type Parsed<T> = { ok: true; value: T } | { ok: false };

export function text(value: unknown, opts: { min?: number; max: number; required?: boolean; long?: boolean }): Parsed<string | null> {
  const v = opts.long ? cleanLong(value) : clean(value);
  if (v === "") return opts.required ? { ok: false } : { ok: true, value: null };
  if (!opts.long && CONTROL.test(v)) return { ok: false };
  if (v.length < (opts.min ?? 1) || v.length > opts.max) return { ok: false };
  return { ok: true, value: v };
}

export function positiveNumber(value: unknown, opts: { max: number; integer?: boolean; required?: boolean }): Parsed<number | null> {
  const raw = clean(value).replace(/,/g, "");
  if (raw === "") return opts.required ? { ok: false } : { ok: true, value: null };
  if (!/^\d+(\.\d{1,3})?$/.test(raw)) return { ok: false };
  const n = Number(raw);
  if (!(n > 0) || n > opts.max) return { ok: false };
  if (opts.integer && !Number.isInteger(n)) return { ok: false };
  return { ok: true, value: n };
}

export function oneOf<T extends string>(value: unknown, allowed: readonly { value: T }[]): T | null {
  const v = clean(value);
  return allowed.find((a) => a.value === v)?.value ?? null;
}

export function yearOrNull(value: unknown): Parsed<number | null> {
  const raw = clean(value);
  if (raw === "") return { ok: true, value: null };
  if (!/^\d{4}$/.test(raw)) return { ok: false };
  const n = Number(raw);
  return n >= 1900 && n <= 2100 ? { ok: true, value: n } : { ok: false };
}

/** A specification value is stored as a number when it looks like one, otherwise as text. */
export function specValue(valueRaw: unknown, unitRaw: unknown): Parsed<{ text: string | null; number: number | null; unit: string | null }> {
  const v = clean(valueRaw);
  const u = clean(unitRaw);
  if (v === "" || v.length > 500 || CONTROL.test(v) || u.length > 30 || CONTROL.test(u)) return { ok: false };
  const asNumber = v.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(asNumber) && Math.abs(Number(asNumber)) < 1e11) {
    return { ok: true, value: { text: null, number: Number(asNumber), unit: u || null } };
  }
  if (u) return { ok: false }; // a unit only makes sense beside a number
  return { ok: true, value: { text: v, number: null, unit: null } };
}

export type ErrorCode = "duplicate" | "invalid" | "not_owner" | "frozen" | "failed";

/** Maps a database failure to a safe code. Raw database text is never shown to people. */
export function errorCodeFor(error: { code?: string | null; message?: string | null }): ErrorCode {
  if (error.code === "23505") return "duplicate";
  if (error.code === "23514" || error.code === "23503" || error.code === "22P02" || error.code === "22003") return "invalid";
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) return "not_owner";
  if (error.code === "55000") return "frozen";
  return "failed";
}

export const ERROR_MESSAGES: Record<ErrorCode | "check_values", string> = {
  duplicate: "That is already on the list. Nothing was added.",
  invalid: "Some values were not accepted. Check the fields and try again.",
  check_values: "Some values were not accepted. Check the fields and try again.",
  not_owner: "Only company owners can change the manufacturing profile.",
  frozen: "That record belongs to something archived and can no longer be changed.",
  failed: "We could not save that right now. Nothing was changed. Try again in a moment.",
};

export const NOTICE_MESSAGES: Record<string, string> = {
  process_added: "Process added.",
  process_updated: "Process updated.",
  process_removed: "Process removed.",
  capacity_saved: "Factory-wide capacity saved.",
  capacity_removed: "Factory-wide capacity removed.",
  machine_added: "Machine added.",
  machine_updated: "Machine updated.",
  machine_removed: "Machine removed.",
  material_added: "Material added.",
  material_removed: "Material removed.",
  product_added: "Product added.",
  product_updated: "Product details saved.",
  product_archived: "Product archived. It is no longer in your active list.",
  spec_added: "Specification added.",
  spec_removed: "Specification removed.",
  link_added: "Factory linked to this product.",
  link_removed: "Factory unlinked from this product.",
};
