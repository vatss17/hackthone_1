import { INCOTERMS, effectiveDetails, invoiceModel, packingModel, type DocContext } from "./generate.ts";
import type { DocReview } from "../workspace/types.ts";

/**
 * Four SEPARATE questions about a draft document. Answering one never answers another.
 *
 *   presence      is each required field filled in?
 *   format        does each value LOOK like what it claims to be (an IEC, a GSTIN, a date, an HS code)?
 *   consistency   do the numbers agree with each other and with the shipment (units, weights, totals, the other document)?
 *   review        has the person looked it over, and is that sign-off still current?
 *
 * None of this says the shipment is ready, the identifiers are real, the classification is right or any rule is met.
 * A format check cannot tell a real IEC from an invented one; only the issuing authority can.
 */

export type Severity = "error" | "warning";

export interface Issue {
  field?: string;
  severity: Severity;
  message: string;
}

export type ReviewState = "not_reviewed" | "reviewed" | "stale";

export interface DocValidation {
  presence: Issue[];
  format: Issue[];
  consistency: Issue[];
  review: ReviewState;
  reviewedBy: string | null;
  reviewedOn: string | null;
  /** Identifies the content that was reviewed. Changing the draft changes it, which makes an earlier review stale. */
  fingerprint: string;
}

const PLACEHOLDER = /^(?:tbd|tba|todo|xx+|x+|n\/?a|none|test|testing|sample|dummy|abc+|asdf+|qwerty|lorem.*|[-_.?]+|0+|1234+|12345.*|to be (?:confirmed|decided|advised)|your (?:name|company|address)|company name|buyer name|name here)$/i;
const IEC = /^[A-Z0-9]{10}$/i;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const TRN = /^\d{15}$/;
const HS = /^\d{4}([.]?\d{2}){0,3}$/;

const looksLikePlaceholder = (v: string) => {
  const t = v.trim();
  return t.length > 0 && (PLACEHOLDER.test(t) || /\b(?:tbd|xxxx+|to be confirmed|lorem ipsum)\b/i.test(t));
};

const realDate = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
};

/** A short, stable hash of text. Not security: it only detects that a draft changed after it was reviewed. */
export function fingerprint(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function formatIssues(ctx: DocContext, now: Date, fields: string[]): Issue[] {
  const { values } = effectiveDetails(ctx);
  const out: Issue[] = [];
  const err = (field: string, message: string) => out.push({ field, severity: "error", message });
  const warn = (field: string, message: string) => out.push({ field, severity: "warning", message });
  for (const f of fields) {
    const v = (values as unknown as Record<string, string>)[f] ?? "";
    if (v && looksLikePlaceholder(v)) err(f, "This looks like a placeholder, not a real value.");
  }
  if (fields.includes("iec") && values.iec && !looksLikePlaceholder(values.iec) && !IEC.test(values.iec)) err("iec", "An Importer-Exporter Code has 10 letters or digits. This is not in that format.");
  if (fields.includes("gstin") && values.gstin && !looksLikePlaceholder(values.gstin) && !GSTIN.test(values.gstin)) err("gstin", "A GSTIN has 15 characters in a fixed pattern (for example 22AAAAA0000A1Z5). This is not in that format.");
  if (fields.includes("buyerTrn") && values.buyerTrn && !looksLikePlaceholder(values.buyerTrn) && !TRN.test(values.buyerTrn.replace(/\s/g, ""))) err("buyerTrn", "A tax registration number has 15 digits. This is not in that format.");
  if (fields.includes("invoiceNumber") && values.invoiceNumber && !looksLikePlaceholder(values.invoiceNumber) && values.invoiceNumber.trim().length < 3) err("invoiceNumber", "An invoice number is normally at least 3 characters.");
  if (fields.includes("invoiceDate") && values.invoiceDate) {
    const d = realDate(values.invoiceDate);
    if (!d) err("invoiceDate", "Use a real date in the form YYYY-MM-DD.");
    else {
      const days = (d.getTime() - now.getTime()) / 86_400_000;
      if (days > 1) warn("invoiceDate", "This date is in the future. Check it.");
      else if (days < -730) warn("invoiceDate", "This date is more than two years ago. Check it.");
    }
  }
  if (fields.includes("incoterm") && values.incoterm && !(INCOTERMS as readonly string[]).includes(values.incoterm)) err("incoterm", "That is not one of the standard Incoterms.");
  for (const f of ["portLoading", "portDischarge", "buyerName", "sellerName"]) {
    if (fields.includes(f)) {
      const v = (values as unknown as Record<string, string>)[f];
      if (v && !looksLikePlaceholder(v) && v.trim().length < 3) err(f, "This is too short to be a real name.");
    }
  }
  return out;
}

function hsIssues(ctx: DocContext): Issue[] {
  const hs = ctx.product?.hsCode;
  if (!hs) return [{ field: "hsCode", severity: "warning", message: "No classification is recorded. An HS code goes on an invoice only after it has been confirmed; the platform cannot supply one." }];
  if (!HS.test(hs.replace(/\s/g, ""))) return [{ field: "hsCode", severity: "error", message: "The HS code is not in a valid format (4 to 10 digits)." }];
  return [{ field: "hsCode", severity: "warning", message: `HS code ${hs} is your own claim. It has not been verified.` }];
}

export function validateInvoice(ctx: DocContext, review?: DocReview, now: Date = new Date()): DocValidation {
  const inv = invoiceModel(ctx);
  const presence: Issue[] = inv.missing.map((m) => ({ severity: "error", message: `Missing: ${m}` }));
  const format = [...formatIssues(ctx, now, ["iec", "gstin", "buyerTrn", "invoiceNumber", "invoiceDate", "incoterm", "portLoading", "portDischarge", "buyerName", "sellerName"]), ...hsIssues(ctx)];
  const consistency: Issue[] = [];
  const pack = packingModel(ctx);
  if (inv.line) {
    const expected = Math.round(inv.line.unitPrice * inv.line.quantity * 100) / 100;
    if (Math.abs(expected - inv.line.amount) > 0.005) consistency.push({ severity: "error", message: "The line amount does not equal unit price times quantity." });
    if (pack.totals && pack.totals.units !== inv.line.quantity) consistency.push({ severity: "error", message: `The invoice quantity (${inv.line.quantity}) does not match the packing list units (${pack.totals.units}).` });
  }
  if (ctx.inputsAreSample) consistency.push({ severity: "warning", message: "Quantity and price come from sample calculator values, not a real order." });
  const fp = fingerprint(JSON.stringify({ t: "inv", f: inv.fields, l: inv.line, c: inv.currency }));
  return finish(presence, format, consistency, fp, review);
}

export function validatePacking(ctx: DocContext, review?: DocReview, now: Date = new Date()): DocValidation {
  const pack = packingModel(ctx);
  const presence: Issue[] = pack.missing.map((m) => ({ severity: "error", message: `Missing: ${m}` }));
  const format = formatIssues(ctx, now, ["invoiceNumber", "invoiceDate", "portLoading", "portDischarge", "buyerName", "sellerName"]);
  const consistency: Issue[] = [...pack.consistency];
  if (ctx.inputsAreSample) consistency.push({ severity: "warning", message: "Quantities and carton data come from sample calculator values, not a real shipment." });
  const fp = fingerprint(JSON.stringify({ t: "pack", f: pack.fields, r: pack.rows, c: pack.totals }));
  return finish(presence, format, consistency, fp, review);
}

function finish(presence: Issue[], format: Issue[], consistency: Issue[], fp: string, review?: DocReview): DocValidation {
  const state: ReviewState = !review ? "not_reviewed" : review.fingerprint === fp ? "reviewed" : "stale";
  return { presence, format, consistency, review: state, reviewedBy: review?.by ?? null, reviewedOn: review?.on ?? null, fingerprint: fp };
}

export const errorsOf = (issues: Issue[]) => issues.filter((i) => i.severity === "error");
