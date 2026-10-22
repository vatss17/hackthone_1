import { calculate, round2, validateInputs } from "../landed-cost/calc.ts";
import type { Inputs, Result } from "../landed-cost/types.ts";
import type { ChecklistAnswer, DocDetails } from "../workspace/types.ts";

/**
 * Draft export documents. Pure: the same inputs always produce the same draft.
 *
 * What is prefilled: the company name and the factory address (the user's own records), the
 * product name, description, quantities, packing data and the selling price (the user's product
 * record and calculator). What is NEVER invented: buyer details, invoice numbers and dates,
 * certifications, government identifiers, tariff classifications or approvals. Those stay blank
 * and are listed as missing until the person supplies them.
 *
 * Every output is a DRAFT for the exporter to review. Nothing here is submitted anywhere.
 */

export const DRAFT_LABEL = "DRAFT — REVIEW REQUIRED";

export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;

export interface DocContext {
  company: { name: string; legalName: string | null; address: string | null };
  product: { name: string; description: string | null; hsCode: string | null; unitWeightG: number | null } | null;
  inputs: Inputs;
  /** True when the calculator inputs are still the sample values. */
  inputsAreSample: boolean;
  details: Partial<DocDetails>;
}

export type FieldSource = "you" | "prefilled" | "calculator" | "missing";

export interface DocField {
  key: keyof DocDetails | string;
  label: string;
  value: string;
  required: boolean;
  source: FieldSource;
  hint?: string;
}

const EMPTY: DocDetails = {
  sellerName: "", sellerAddress: "", iec: "", gstin: "", buyerName: "", buyerAddress: "", buyerCountry: "", buyerTrn: "", buyerContact: "",
  invoiceNumber: "", invoiceDate: "", incoterm: "", paymentTerms: "", portLoading: "", portDischarge: "", countryOrigin: "", marks: "", currency: "AED",
};

/** What the platform may prefill from the user's own records. Never buyer or identifier data. */
export function prefill(ctx: Pick<DocContext, "company">): Partial<DocDetails> {
  return {
    sellerName: ctx.company.legalName || ctx.company.name,
    sellerAddress: ctx.company.address ?? "",
    buyerCountry: "United Arab Emirates",
    countryOrigin: "India",
    currency: "AED",
  };
}

export function effectiveDetails(ctx: Pick<DocContext, "company" | "details">): { values: DocDetails; sources: Record<keyof DocDetails, FieldSource> } {
  const base = prefill(ctx);
  const values = { ...EMPTY } as DocDetails;
  const sources = {} as Record<keyof DocDetails, FieldSource>;
  for (const k of Object.keys(EMPTY) as (keyof DocDetails)[]) {
    if (k in ctx.details && ctx.details[k] !== undefined) {
      values[k] = (ctx.details[k] ?? "").trim();
      sources[k] = values[k] ? "you" : "missing";
    } else if (base[k]) {
      values[k] = base[k] as string;
      sources[k] = "prefilled";
    } else sources[k] = "missing";
  }
  return { values, sources };
}

const money = (n: number, cur: string) => `${cur} ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const num = (n: number, d = 2) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: d }).format(n);

function safeResult(inputs: Inputs): Result | null {
  return Object.keys(validateInputs(inputs).errors).length === 0 ? calculate(inputs) : null;
}

// ---- commercial invoice -----------------------------------------------------------------------

export interface InvoiceModel {
  title: string;
  label: string;
  fields: Record<string, DocField>;
  line: { description: string; hsCode: string; quantity: number; unit: string; unitPrice: number; amount: number } | null;
  currency: string;
  totalText: string;
  /** Required items still empty. */
  missing: string[];
  /** Things to look at even though a value exists. */
  review: string[];
  complete: boolean;
  totalFields: number;
}

export function invoiceModel(ctx: DocContext): InvoiceModel {
  const { values, sources } = effectiveDetails(ctx);
  const cur = values.currency === "INR" ? "INR" : "AED";
  const r = safeResult(ctx.inputs);
  const units = r?.units ?? 0;
  const priceAed = ctx.inputs.sellingPriceAed;
  const unitPrice = cur === "AED" ? priceAed : round2(priceAed * ctx.inputs.inrPerAed);
  const f = (key: keyof DocDetails, label: string, required: boolean, hint?: string): DocField => ({ key, label, value: values[key], required, source: sources[key], hint });
  const fields: Record<string, DocField> = {
    sellerName: f("sellerName", "Exporter (seller)", true),
    sellerAddress: f("sellerAddress", "Exporter address", true, "Prefilled from your first factory. Use the registered address if different."),
    iec: f("iec", "Importer-Exporter Code (IEC)", true, "Your own code. The platform cannot look it up or check it."),
    gstin: f("gstin", "GSTIN", false, "Recommended. Your own number."),
    buyerName: f("buyerName", "Buyer (consignee)", true, "Not known to the platform. Enter the buyer you have agreed with."),
    buyerAddress: f("buyerAddress", "Buyer address", true),
    buyerCountry: f("buyerCountry", "Buyer country", true),
    buyerTrn: f("buyerTrn", "Buyer tax registration number", false, "Recommended if the buyer has given one."),
    invoiceNumber: f("invoiceNumber", "Invoice number", true, "Use your own numbering. The platform does not generate one."),
    invoiceDate: f("invoiceDate", "Invoice date", true),
    incoterm: f("incoterm", "Terms of delivery (Incoterm)", true, "Must match what you agreed. The calculator's costs assume you pay to delivery in the UAE."),
    paymentTerms: f("paymentTerms", "Payment terms", true),
    portLoading: f("portLoading", "Port of loading", true),
    portDischarge: f("portDischarge", "Port of discharge", true),
    countryOrigin: f("countryOrigin", "Country of origin of goods (declared by exporter)", true, "As you declare it. Whether goods qualify for CEPA preference is not decided here."),
    marks: f("marks", "Marks and numbers", false),
  };
  const priceOk = ctx.inputs.sellingPriceAed > 0 && units > 0;
  const missing = Object.values(fields).filter((x) => x.required && !x.value).map((x) => x.label);
  if (!priceOk) missing.push("Unit price and quantity (set the selling price and quantity in the landed-cost calculator)");
  const review: string[] = [];
  if (ctx.inputsAreSample) review.push("Quantity and price come from SAMPLE calculator values. Replace them with the real order before using this draft.");
  if (priceOk) review.push("The unit price is your calculator selling price. The invoice price must match the terms you agreed with the buyer.");
  if (!ctx.product?.hsCode) review.push("No HS code is recorded for the product. Classification must be confirmed before an HS code goes on any invoice.");
  else review.push(`HS code ${ctx.product.hsCode} is your own claim and is not verified.`);
  if (values.incoterm === "DDP" || values.incoterm === "") review.push("Check that the stated terms fit who pays freight and duty.");

  const description = ctx.product ? [ctx.product.name, ctx.product.description ? ctx.product.description.split("\n")[0].slice(0, 160) : null].filter(Boolean).join(" — ") : "";
  const line = priceOk
    ? { description: description || "Goods (describe the product)", hsCode: ctx.product?.hsCode ?? "", quantity: units, unit: "pcs", unitPrice, amount: round2(unitPrice * units) }
    : null;
  return {
    title: "Commercial invoice",
    label: DRAFT_LABEL,
    fields,
    line,
    currency: cur,
    totalText: line ? money(line.amount, cur) : "",
    missing,
    review,
    complete: missing.length === 0,
    totalFields: Object.values(fields).filter((x) => x.required).length + 1,
  };
}

// ---- packing list -----------------------------------------------------------------------------

export interface PackingModel {
  title: string;
  label: string;
  fields: Record<string, DocField>;
  line: {
    description: string;
    cartons: number;
    unitsPerCarton: number;
    unitsTotal: number;
    netPerCartonKg: number | null;
    grossPerCartonKg: number | null;
    dims: string | null;
    netTotalKg: number | null;
    grossTotalKg: number | null;
    volumeCbm: number | null;
  } | null;
  missing: string[];
  review: string[];
  complete: boolean;
  totalFields: number;
}

export function packingModel(ctx: DocContext): PackingModel {
  const { values, sources } = effectiveDetails(ctx);
  const r = safeResult(ctx.inputs);
  const i = ctx.inputs;
  const f = (key: keyof DocDetails, label: string, required: boolean, hint?: string): DocField => ({ key, label, value: values[key], required, source: sources[key], hint });
  const fields: Record<string, DocField> = {
    sellerName: f("sellerName", "Exporter (seller)", true),
    sellerAddress: f("sellerAddress", "Exporter address", true),
    buyerName: f("buyerName", "Buyer (consignee)", true),
    buyerAddress: f("buyerAddress", "Buyer address", true),
    invoiceNumber: f("invoiceNumber", "Invoice number (reference)", true, "The same number as the commercial invoice."),
    invoiceDate: f("invoiceDate", "Date", true),
    portLoading: f("portLoading", "Port of loading", true),
    portDischarge: f("portDischarge", "Port of discharge", true),
    marks: f("marks", "Marks and numbers", false),
  };
  const missing = Object.values(fields).filter((x) => x.required && !x.value).map((x) => x.label);
  const review: string[] = [];
  if (!r) {
    missing.push("Quantity and carton data (fix the landed-cost calculator inputs)");
    return { title: "Packing list", label: DRAFT_LABEL, fields, line: null, missing, review, complete: false, totalFields: Object.values(fields).filter((x) => x.required).length + 3 };
  }
  const netPerCarton = ctx.product?.unitWeightG ? round2((ctx.product.unitWeightG * i.unitsPerCarton) / 1000) : null;
  const grossPerCarton = i.cartonGrossWeightKg;
  const dims = i.cartonLengthMm !== null && i.cartonWidthMm !== null && i.cartonHeightMm !== null ? `${num(i.cartonLengthMm, 0)} × ${num(i.cartonWidthMm, 0)} × ${num(i.cartonHeightMm, 0)} mm` : null;
  if (netPerCarton === null) missing.push("Unit weight of the product (add it on the product page) for net weight");
  if (grossPerCarton === null) missing.push("Carton gross weight (landed-cost calculator)");
  if (dims === null) missing.push("Carton dimensions (landed-cost calculator)");
  if (ctx.inputsAreSample) review.push("Quantity and carton data come from SAMPLE calculator values. Replace them with the real shipment.");
  review.push("Weights are calculated from your product and carton data. Weigh a packed carton before shipping.");
  const partial = r.units % i.unitsPerCarton !== 0 && i.quantityUnit === "units";
  if (partial) review.push("The last carton is not full. Describe it separately if the buyer needs exact counts.");
  return {
    title: "Packing list",
    label: DRAFT_LABEL,
    fields,
    line: {
      description: ctx.product?.name ?? "Goods (describe the product)",
      cartons: r.cartons,
      unitsPerCarton: i.unitsPerCarton,
      unitsTotal: r.units,
      netPerCartonKg: netPerCarton,
      grossPerCartonKg: grossPerCarton,
      dims,
      // Total from the exact unit weight, not from the rounded per-carton figure, so rounding never accumulates.
      netTotalKg: ctx.product?.unitWeightG ? round2((ctx.product.unitWeightG * r.units) / 1000) : null,
      grossTotalKg: r.grossWeightKg === null ? null : round2(r.grossWeightKg),
      volumeCbm: r.volumeCbm === null ? null : round2(r.volumeCbm),
    },
    missing,
    review,
    complete: missing.length === 0,
    totalFields: Object.values(fields).filter((x) => x.required).length + 3,
  };
}

// ---- export documentation checklist ------------------------------------------------------------

export interface ChecklistItem {
  id: string;
  title: string;
  why: string;
  who: string;
  /** Which draft the platform can prepare for this item, if any. */
  draft: "invoice" | "packing" | null;
  /** "inferred" = a rule suggests it is commonly asked for. "unknown" = depends on facts not known here. */
  evidence: "inferred" | "unknown";
}

const BASE: ChecklistItem[] = [
  { id: "invoice", title: "Commercial invoice", why: "Commonly requested by customs and buyers. Prepared as a draft here.", who: "You", draft: "invoice", evidence: "inferred" },
  { id: "packing", title: "Packing list", why: "Commonly requested alongside the invoice. Prepared as a draft here.", who: "You", draft: "packing", evidence: "inferred" },
  { id: "transport", title: "Bill of lading or air waybill", why: "The carrier's contract and receipt. Issued by the shipping line, airline or forwarder.", who: "Freight forwarder or carrier", draft: null, evidence: "inferred" },
  { id: "export-declaration", title: "Export declaration (shipping bill)", why: "Filed with Indian customs for the shipment, usually by a customs broker. This platform files nothing.", who: "Customs broker", draft: null, evidence: "inferred" },
  { id: "origin", title: "Certificate of origin", why: "Whether you need a preferential (CEPA) or non-preferential certificate depends on origin rules and the buyer. Not decided here.", who: "Issuing body, with your adviser", draft: null, evidence: "unknown" },
  { id: "insurance", title: "Insurance certificate", why: "Needed if you sell on terms where you insure the cargo, or if the buyer asks.", who: "Insurer or forwarder", draft: null, evidence: "unknown" },
  { id: "tax", title: "GST and export-tax paperwork", why: "How export GST is handled affects cash flow. Confirm with your tax adviser.", who: "Tax adviser", draft: null, evidence: "unknown" },
  { id: "importer", title: "Importer's registration and any import approvals", why: "The importer carries many UAE-side obligations. Ask the buyer what they hold and what they need from you.", who: "Buyer or importer", draft: null, evidence: "unknown" },
  { id: "conformity", title: "Product conformity or registration evidence (UAE/GCC)", why: "Whether the product needs conformity evidence has not been checked. See the compliance screening.", who: "Expert, laboratory or certification body", draft: null, evidence: "unknown" },
];

const FAMILY_EXTRA: Record<string, ChecklistItem[]> = {
  "food-contact": [
    { id: "food-contact", title: "Food-contact test reports and material declarations", why: "Buyers of food-contact products commonly ask for migration test reports and supplier declarations for each grade and colourant.", who: "Laboratory and your resin suppliers", draft: null, evidence: "inferred" },
  ],
  "household-general": [
    { id: "mechanical", title: "Mechanical and ageing test reports", why: "Buyers often ask for load, stacking, impact and UV ageing evidence for their own ranges.", who: "Laboratory", draft: null, evidence: "inferred" },
  ],
  "water-irrigation": [
    { id: "pressure", title: "Pressure-class and long-term strength evidence", why: "Pressure products are normally sold against a stated standard.", who: "Laboratory or certification body", draft: null, evidence: "inferred" },
    { id: "potable", title: "Drinking-water contact approval (if potable use)", why: "Often a hard gate for water-contact products. Whether it applies has not been checked.", who: "Certification body", draft: null, evidence: "unknown" },
  ],
  "electrical-construction": [
    { id: "fire", title: "Fire-behaviour and mechanical test reports", why: "Specified by buyers or projects for conduit and construction products.", who: "Laboratory", draft: null, evidence: "inferred" },
    { id: "approvals", title: "Project or utility material approvals", why: "Some projects approve materials before they may be used.", who: "Buyer, with the project authority", draft: null, evidence: "unknown" },
  ],
};

export function checklistFor(familyId: string | null): ChecklistItem[] {
  return [...BASE.slice(0, 5), ...(familyId ? FAMILY_EXTRA[familyId] ?? [] : []), ...BASE.slice(5)];
}

export interface DocumentStatus {
  invoice: { missing: number; total: number; complete: boolean };
  packing: { missing: number; total: number; complete: boolean };
  checklist: { answered: number; total: number };
}

export function documentStatus(ctx: DocContext, familyId: string | null, answers: Record<string, ChecklistAnswer>): DocumentStatus {
  const inv = invoiceModel(ctx);
  const pack = packingModel(ctx);
  const items = checklistFor(familyId);
  return {
    invoice: { missing: inv.missing.length, total: inv.totalFields, complete: inv.complete },
    packing: { missing: pack.missing.length, total: pack.totalFields, complete: pack.complete },
    checklist: { answered: items.filter((i) => answers[i.id]).length, total: items.length },
  };
}
