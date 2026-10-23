"use client";

import { LoadingBlock } from "@/components/ui/skeleton";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { useT } from "@/lib/i18n/client";
import { tx } from "@/lib/workspace/dynamic-text";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { DRAFT_LABEL, INCOTERMS, checklistFor, effectiveDetails, invoiceModel, packingModel, type DocField } from "@/lib/documents/generate";
import { GROUPS, LABELS, SOURCE_TEXT } from "@/lib/documents/labels";
import { formatNumber } from "@/lib/landed-cost/format";
import { validateInvoice, validatePacking, type DocValidation, type Issue } from "@/lib/documents/validate";
import type { ChecklistAnswer, DocDetails, WorkspaceFacts } from "@/lib/workspace/types";
import type { Inputs } from "@/lib/landed-cost/types";
import { cn } from "@/lib/utils";

const REQUIRED = new Set<keyof DocDetails>(["sellerName", "sellerAddress", "iec", "buyerName", "buyerAddress", "buyerCountry", "invoiceNumber", "invoiceDate", "incoterm", "paymentTerms", "portLoading", "portDischarge", "countryOrigin"]);

/** A value in a printed document: the real value, or a visible gap. Never a made-up one. */
function V({ f }: { f: Pick<DocField, "value" | "label"> }) {
  if (f.value) return <span className="whitespace-pre-line">{f.value}</span>;
  return <span className="missing-mark rounded-sm bg-(--status-estimate-bg) px-1 text-xs italic text-(--status-estimate-fg) print:bg-transparent print:text-neutral-500">[missing: {f.label}]</span>;
}

function DraftBanner({ complete }: { complete: boolean }) {
  return (
    <div className="draft-banner flex flex-wrap items-center justify-between gap-2 border-2 border-dashed border-(--status-missing-fg) px-3 py-2 text-sm font-semibold tracking-wide text-(--status-missing-fg) print:border-black print:text-black">
      <span>{DRAFT_LABEL}</span>
      <span className="text-xs font-normal normal-case tracking-normal">{complete ? "Required fields are present. This does not mean the draft is correct or the shipment is ready." : "Incomplete. Missing items are marked in the text."}</span>
    </div>
  );
}

function IssueList({ issues, empty }: { issues: Issue[]; empty: string }) {
  const t = useT();
  if (issues.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {issues.map((x, idx) => (
        <li key={`${x.field ?? "doc"}-${idx}`} className={x.severity === "error" ? "text-destructive" : "text-(--status-estimate-fg)"}>
          {tx(t, x.message)}
        </li>
      ))}
    </ul>
  );
}

/** The four checks for one draft, kept apart, with the person's own review sign-off. */
function DocChecks({ v, label, onReview, onUnreview }: { v: DocValidation; label: string; onReview: (by: string) => void; onUnreview: () => void }) {
  const t = useT();
  const errs = (xs: Issue[]) => xs.filter((x) => x.severity === "error").length;
  const reviewText = v.review === "reviewed" ? t("Reviewed by {by} on {on}", { by: v.reviewedBy ?? "", on: v.reviewedOn ?? "" }) : v.review === "stale" ? t("Changed since {by} reviewed it on {on}", { by: v.reviewedBy ?? "", on: v.reviewedOn ?? "" }) : t("Not reviewed");
  return (
    <div className="no-print mt-3 rounded-lg border bg-card p-3 text-sm sm:p-4" role="group" aria-label={t("{doc} checks", { doc: t(label) })}>
      <dl className="grid gap-2 sm:grid-cols-4">
        {(
          [
            [t("Fields present"), v.presence.length === 0 ? t("All required fields") : t("{n} missing", { n: v.presence.length }), v.presence.length === 0],
            [t("Formats"), errs(v.format) === 0 ? t("No format errors") : t("{n} to fix", { n: errs(v.format) }), errs(v.format) === 0],
            [t("Shipment figures"), errs(v.consistency) === 0 ? t("Consistent") : t("{n} mismatch", { n: errs(v.consistency) }), errs(v.consistency) === 0],
            [t("Review"), reviewText, v.review === "reviewed"],
          ] as [string, string, boolean][]
        ).map(([k, val, ok]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={cn("font-medium", !ok && "text-(--status-estimate-fg)")}>{val}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{t("These are four separate checks. A draft can pass one and fail another, and passing all four still does not make a shipment ready or compliant.")}</p>
      <details className="mt-2" open={v.presence.length + errs(v.format) + errs(v.consistency) > 0}>
        <summary className="cursor-pointer font-medium text-primary">{t("See each check")}</summary>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div>
            <h4 className="text-[13px] font-semibold text-muted-foreground">{t("Fields present")}</h4>
            <IssueList issues={v.presence} empty={t("Every required field has a value.")} />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-muted-foreground">{t("Format and placeholders")}</h4>
            <IssueList issues={v.format} empty={t("Nothing looks malformed. A format check cannot tell a real identifier from an invented one.")} />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-muted-foreground">{t("Shipment consistency")}</h4>
            <IssueList issues={v.consistency} empty={t("Rows, totals and the other document agree.")} />
          </div>
        </div>
      </details>
      <ReviewControl v={v} label={label} onReview={onReview} onUnreview={onUnreview} />
    </div>
  );
}

function ReviewControl({ v, label, onReview, onUnreview }: { v: DocValidation; label: string; onReview: (by: string) => void; onUnreview: () => void }) {
  const t = useT();
  const [name, setName] = useState(v.reviewedBy ?? "");
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
      <div className="grid gap-1">
        <Label htmlFor={`rv-${label}`} className="text-xs">
          {t("Your name, to record that you reviewed this draft")}
        </Label>
        <Input id={`rv-${label}`} value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} className="h-9 w-60" />
      </div>
      <Button type="button" variant="outline" size="sm" disabled={!name.trim()} onClick={() => onReview(name.trim())}>
        {v.review === "reviewed" ? t("Review again") : t("Mark as reviewed by me")}
      </Button>
      {v.review !== "not_reviewed" && (
        <Button type="button" variant="ghost" size="sm" onClick={onUnreview}>
          {t("Clear my review")}
        </Button>
      )}
      <p className="basis-full text-xs text-muted-foreground">{t("Your sign-off is a note for yourself. It is not checked by anyone and it goes out of date if the draft changes.")}</p>
    </div>
  );
}

export function DocumentsWorkspace({ scope, facts, defaults, familyId }: { scope: string; facts: WorkspaceFacts; defaults: Inputs; familyId: string | null }) {
  const t = useT();
  const w = useWorkspace({ scope, facts, defaults });
  const { assessment, ctx } = w;
  const { values, sources } = effectiveDetails(ctx);
  const inv = invoiceModel(ctx);
  const pack = packingModel(ctx);
  const vInv = validateInvoice(ctx, assessment.docs.review.invoice);
  const vPack = validatePacking(ctx, assessment.docs.review.packing);
  const setReview = (which: "invoice" | "packing", by: string | null) =>
    w.update((a) => {
      const review = { ...a.docs.review };
      const v = which === "invoice" ? validateInvoice(ctx, undefined) : validatePacking(ctx, undefined);
      if (by) review[which] = { by, on: new Date().toISOString().slice(0, 10), fingerprint: v.fingerprint };
      else delete review[which];
      return { ...a, docs: { ...a.docs, review } };
    });
  const items = checklistFor(familyId);
  const answers = assessment.docs.checklist;

  useEffect(() => {
    const clear = () => document.body.removeAttribute("data-print");
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  const setDetail = (key: keyof DocDetails, value: string) =>
    w.update((a) => ({ ...a, docs: { ...a.docs, details: { ...a.docs.details, [key]: value } } }));
  const setAnswer = (id: string, v: ChecklistAnswer | null) =>
    w.update((a) => {
      const checklist = { ...a.docs.checklist };
      if (v === null) delete checklist[id];
      else checklist[id] = v;
      return { ...a, docs: { ...a.docs, checklist } };
    });
  const print = (which: "invoice" | "packing" | "checklist") => {
    document.body.setAttribute("data-print", which);
    window.print();
  };

  if (!w.hydrated) return <LoadingBlock label={t("Loading your documents…")} />;
  const productLine = facts.product?.name ?? t("your product");

  return (
    <div className="mt-6 space-y-10">
      <div className="no-print rounded-md border border-(--status-estimate-border) bg-(--status-estimate-bg) px-4 py-3 text-sm text-(--status-estimate-fg) sm:px-5">
        <p className="font-medium">{t("These are drafts for you to review, not finished documents.")}</p>
        <p className="mt-0.5">{t("The platform fills in what it knows from your records. It never invents buyer details, invoice numbers, certifications, tariff classifications or approvals, and it submits nothing to customs or any authority. Printing makes a PDF you can edit and send yourself.")}</p>
      </div>

      {/* ---------------- details ---------------- */}
      <section className="no-print" aria-labelledby="dt-h">
        <h2 id="dt-h" className="text-lg font-semibold tracking-tight">
          {t("Details for {product}", { product: productLine })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("Fill the gaps once. The invoice and packing list both use these, and what you type is saved in this browser.")}</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <fieldset key={g.title} className="rounded-lg border bg-card p-4">
              <legend className="px-1 text-sm font-semibold">{t(g.title)}</legend>
              <div className="grid gap-3">
                {g.keys.map((k) => {
                  const id = `doc-${k}`;
                  const common = { id, value: values[k] };
                  return (
                    <div key={k} className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={id} className="text-xs">
                          {t(LABELS[k])}
                          {REQUIRED.has(k) && <span className="text-destructive"> *</span>}
                        </Label>
                        <span className={cn("text-xs", sources[k] === "missing" ? "text-(--status-estimate-fg)" : "text-muted-foreground")}>{t(SOURCE_TEXT[sources[k]])}</span>
                      </div>
                      {k === "incoterm" ? (
                        <select {...common} onChange={(e) => setDetail(k, e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
                          <option value="">{t("Choose…")}</option>
                          {INCOTERMS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : k === "currency" ? (
                        <select {...common} onChange={(e) => setDetail(k, e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
                          <option value="AED">AED</option>
                          <option value="INR">INR</option>
                        </select>
                      ) : k === "sellerAddress" || k === "buyerAddress" ? (
                        <textarea {...common} maxLength={400} onChange={(e) => setDetail(k, e.target.value)} className="min-h-16 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
                      ) : k === "invoiceDate" ? (
                        <div className="flex gap-2">
                          <Input {...common} type="date" onChange={(e) => setDetail(k, e.target.value)} />
                          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setDetail(k, new Date().toISOString().slice(0, 10))}>
                            {t("Today")}
                          </Button>
                        </div>
                      ) : (
                        <Input {...common} maxLength={200} autoComplete="off" onChange={(e) => setDetail(k, e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {(ctx.inputsAreSample ? t("Quantity, price, cartons and weights come from your {link} and product record, and are still SAMPLE values.", { link: "\u0000" }) : t("Quantity, price, cartons and weights come from your {link} and product record.", { link: "\u0000" })).split("\u0000").flatMap((part, i) =>
            i === 0
              ? [part]
              : [
                  <Link key="calc" href={facts.standalone ? "/viability" : `/viability?product=${facts.ref}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {t("landed-cost calculator")}
                  </Link>,
                  part,
                ],
          )}
        </p>
      </section>

      {/* ---------------- invoice ---------------- */}
      <section id="invoice" className="print-doc scroll-mt-20" data-doc="invoice" aria-labelledby="inv-h">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <h2 id="inv-h" className="text-lg font-semibold tracking-tight">
            {t("Commercial invoice")}
          </h2>
          <div className="flex items-center gap-2">
            <StatusBadge kind={inv.complete ? "inferred" : "missing"} />
            <Button type="button" variant="outline" onClick={() => print("invoice")}>
              {t("Print or save as PDF")}
            </Button>
          </div>
        </div>
        <DocChecks v={vInv} label="Invoice" onReview={(by) => setReview("invoice", by)} onUnreview={() => setReview("invoice", null)} />
        <ul className="no-print mt-2 list-disc space-y-0.5 pl-5 text-xs text-(--status-estimate-fg)">
          {inv.review.map((r) => (
            <li key={r}>{tx(t, r)}</li>
          ))}
        </ul>
        <div className="doc-desk mt-4 rounded-lg bg-muted p-2 sm:p-6"><p className="no-print px-1 pb-2 text-[13px] text-muted-foreground sm:hidden">{t("The page scrolls sideways so no column is cut off.")}</p><article tabIndex={0} aria-label="Commercial invoice draft preview" className="doc-sheet mx-auto max-w-[52rem] overflow-x-auto rounded border bg-white p-5 text-[13px] leading-5 text-neutral-900 shadow-sm sm:p-10">
          <DraftBanner complete={inv.complete} />
          <h3 className="mt-5 text-xl font-semibold tracking-tight">COMMERCIAL INVOICE</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Exporter</p>
              <p className="font-medium">
                <V f={inv.fields.sellerName} />
              </p>
              <p>
                <V f={inv.fields.sellerAddress} />
              </p>
              <p>
                IEC: <V f={inv.fields.iec} />
              </p>
              {inv.fields.gstin.value && <p>GSTIN: {inv.fields.gstin.value}</p>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Buyer (consignee)</p>
              <p className="font-medium">
                <V f={inv.fields.buyerName} />
              </p>
              <p>
                <V f={inv.fields.buyerAddress} />
              </p>
              <p>
                <V f={inv.fields.buyerCountry} />
              </p>
              {inv.fields.buyerTrn.value && <p>Tax registration no.: {inv.fields.buyerTrn.value}</p>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-neutral-500">Invoice no.</p>
              <p>
                <V f={inv.fields.invoiceNumber} />
              </p>
              <p className="text-neutral-500">Date</p>
              <p>
                <V f={inv.fields.invoiceDate} />
              </p>
              <p className="text-neutral-500">Terms of delivery</p>
              <p>
                <V f={inv.fields.incoterm} />
              </p>
              <p className="text-neutral-500">Payment terms</p>
              <p>
                <V f={inv.fields.paymentTerms} />
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-neutral-500">Port of loading</p>
              <p>
                <V f={inv.fields.portLoading} />
              </p>
              <p className="text-neutral-500">Port of discharge</p>
              <p>
                <V f={inv.fields.portDischarge} />
              </p>
              <p className="text-neutral-500">Country of origin</p>
              <p>
                <V f={inv.fields.countryOrigin} /> <span className="text-xs text-neutral-500">(declared by exporter)</span>
              </p>
              {inv.fields.marks.value && (
                <>
                  <p className="text-neutral-500">Marks and numbers</p>
                  <p>{inv.fields.marks.value}</p>
                </>
              )}
            </div>
          </div>
          <table className="mt-6 w-full border-collapse text-[13px]">
            <caption className="sr-only">Invoice line: description, HS code, quantity, unit price and amount</caption>
            <thead>
              <tr className="border-y border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th scope="col" className="py-1.5 pr-2 font-medium">Description of goods</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">HS code (exporter&apos;s claim, unverified)</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Quantity</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Unit price ({inv.currency})</th>
                <th scope="col" className="py-1.5 text-right font-medium">Amount ({inv.currency})</th>
              </tr>
            </thead>
            <tbody>
              {inv.line ? (
                <tr className="border-b border-neutral-300 align-top">
                  <td className="py-2 pr-2">{inv.line.description}</td>
                  <td className="py-2 pr-2">{inv.line.hsCode || <span className="text-xs italic text-neutral-500">[not recorded]</span>}</td>
                  <td className="py-2 pr-2 text-right">
                    {formatNumber(inv.line.quantity)} {inv.line.unit}
                  </td>
                  <td className="py-2 pr-2 text-right">{formatNumber(inv.line.unitPrice)}</td>
                  <td className="py-2 text-right">{formatNumber(inv.line.amount)}</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 text-xs italic text-neutral-500">
                    [missing: quantity and unit price. Set them in the landed-cost calculator]
                  </td>
                </tr>
              )}
            </tbody>
            {inv.line && (
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-2 text-right font-semibold">
                    Total ({inv.currency})
                  </td>
                  <td className="pt-2 text-right font-semibold">{inv.totalText.replace(`${inv.currency} `, "")}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <p className="mt-6 text-[11px] text-neutral-500">Prepared from the exporter&apos;s own records using Atlas. Not verified by any authority. Prices, terms and identifiers must be checked by the exporter before use.</p>
        </article></div>
      </section>

      {/* ---------------- packing list ---------------- */}
      <section id="packing" className="print-doc scroll-mt-20" data-doc="packing" aria-labelledby="pk-h">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <h2 id="pk-h" className="text-lg font-semibold tracking-tight">
            {t("Packing list")}
          </h2>
          <div className="flex items-center gap-2">
            <StatusBadge kind={pack.complete ? "inferred" : "missing"} />
            <Button type="button" variant="outline" onClick={() => print("packing")}>
              {t("Print or save as PDF")}
            </Button>
          </div>
        </div>
        <DocChecks v={vPack} label="Packing list" onReview={(by) => setReview("packing", by)} onUnreview={() => setReview("packing", null)} />
        <ul className="no-print mt-2 list-disc space-y-0.5 pl-5 text-xs text-(--status-estimate-fg)">
          {pack.review.map((r) => (
            <li key={r}>{tx(t, r)}</li>
          ))}
        </ul>
        <div className="doc-desk mt-4 rounded-lg bg-muted p-2 sm:p-6"><p className="no-print px-1 pb-2 text-[13px] text-muted-foreground sm:hidden">{t("The page scrolls sideways so no column is cut off.")}</p><article tabIndex={0} aria-label="Packing list draft preview" className="doc-sheet mx-auto max-w-[52rem] overflow-x-auto rounded border bg-white p-5 text-[13px] leading-5 text-neutral-900 shadow-sm sm:p-10">
          <DraftBanner complete={pack.complete} />
          <h3 className="mt-5 text-xl font-semibold tracking-tight">PACKING LIST</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Exporter</p>
              <p className="font-medium">
                <V f={pack.fields.sellerName} />
              </p>
              <p>
                <V f={pack.fields.sellerAddress} />
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Buyer (consignee)</p>
              <p className="font-medium">
                <V f={pack.fields.buyerName} />
              </p>
              <p>
                <V f={pack.fields.buyerAddress} />
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-neutral-500">Invoice reference</p>
              <p>
                <V f={pack.fields.invoiceNumber} />
              </p>
              <p className="text-neutral-500">Date</p>
              <p>
                <V f={pack.fields.invoiceDate} />
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-neutral-500">Port of loading</p>
              <p>
                <V f={pack.fields.portLoading} />
              </p>
              <p className="text-neutral-500">Port of discharge</p>
              <p>
                <V f={pack.fields.portDischarge} />
              </p>
              {pack.fields.marks.value && (
                <>
                  <p className="text-neutral-500">Marks and numbers</p>
                  <p>{pack.fields.marks.value}</p>
                </>
              )}
            </div>
          </div>
          {pack.totals && pack.rows.length > 0 ? (
            <table className="mt-6 w-full border-collapse text-[13px]">
              <caption className="sr-only">Packing rows: full cartons and any partial carton, with units and weights</caption>
              <thead>
                <tr className="border-y border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="py-1.5 pr-2 font-medium">Description</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Cartons</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Units per carton</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Units</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Net kg</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Gross kg</th>
                  <th scope="col" className="py-1.5 font-medium">Carton size</th>
                </tr>
              </thead>
              <tbody>
                {pack.rows.map((row) => (
                  <tr key={row.kind} className="border-b border-neutral-300 align-top">
                    <td className="py-2 pr-2">
                      {row.description}
                      <span className="block text-[11px] text-neutral-500">{row.kind === "full" ? "Full cartons" : "Partial carton"}</span>
                    </td>
                    <td className="py-2 pr-2 text-right">{formatNumber(row.cartons)}</td>
                    <td className="py-2 pr-2 text-right">{formatNumber(row.unitsPerCarton)}</td>
                    <td className="py-2 pr-2 text-right">{formatNumber(row.units)}</td>
                    <td className="py-2 pr-2 text-right">{row.netKg === null ? <span className="text-xs italic text-neutral-500">[missing]</span> : formatNumber(row.netKg)}</td>
                    <td className="py-2 pr-2 text-right">
                      {row.grossKg === null ? <span className="text-xs italic text-neutral-500">[missing]</span> : formatNumber(row.grossKg)}
                      {row.grossBasis === "scaled_estimate" && <span className="block text-[11px] italic text-neutral-500">estimate</span>}
                    </td>
                    <td className="py-2">{pack.dims ?? <span className="text-xs italic text-neutral-500">[missing]</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <th scope="row" className="pt-2 text-left">Totals</th>
                  <td className="pt-2 pr-2 text-right">{formatNumber(pack.totals.cartons)}</td>
                  <td />
                  <td className="pt-2 pr-2 text-right">{formatNumber(pack.totals.units)}</td>
                  <td className="pt-2 pr-2 text-right">{pack.totals.netKg === null ? "[missing]" : formatNumber(pack.totals.netKg)}</td>
                  <td className="pt-2 pr-2 text-right">{pack.totals.grossKg === null ? "[missing]" : formatNumber(pack.totals.grossKg)}</td>
                  <td className="pt-2 text-[11px] font-normal">Volume {pack.totals.volumeCbm === null ? "[missing]" : `${formatNumber(pack.totals.volumeCbm)} m³`}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="mt-6 text-xs italic text-neutral-500">[missing: quantity and carton data. Fix the landed-cost calculator inputs]</p>
          )}
          <p className="mt-6 text-[11px] text-neutral-500">Weights are calculated from the exporter&apos;s product and carton data and must be confirmed by weighing. Not verified by any authority.</p>
        </article></div>
      </section>

      {/* ---------------- checklist ---------------- */}
      <section id="checklist" className="print-doc scroll-mt-20" data-doc="checklist" aria-labelledby="ck-h">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <h2 id="ck-h" className="text-lg font-semibold tracking-tight">
            {t("Export documentation checklist")}
          </h2>
          <Button type="button" variant="outline" onClick={() => print("checklist")}>
            {t("Print or save as PDF")}
          </Button>
        </div>
        <p className="no-print mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("What is commonly asked for, who usually provides it, and where you stand. Which documents are actually required for this product and route has not been verified: treat it as a conversation starter with your forwarder and buyer.")}
        </p>
        <div className="doc-desk mt-4 rounded-lg bg-muted p-2 sm:p-6"><p className="no-print px-1 pb-2 text-[13px] text-muted-foreground sm:hidden">{t("The page scrolls sideways so no column is cut off.")}</p><article tabIndex={0} aria-label="Documentation checklist draft preview" className="doc-sheet mx-auto max-w-[52rem] overflow-x-auto rounded border bg-white p-5 text-[13px] leading-5 text-neutral-900 shadow-sm sm:p-10">
          <DraftBanner complete={false} />
          <h3 className="mt-5 text-xl font-semibold tracking-tight">EXPORT DOCUMENTATION CHECKLIST — {facts.product?.name ?? "standalone assessment"}</h3>
          <ul className="mt-4 divide-y divide-neutral-200">
            {items.map((it) => {
              const ans = answers[it.id];
              return (
                <li key={it.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{t(it.title)}</p>
                      <p className="text-neutral-600">{t(it.why)}</p>
                      <p className="text-xs text-neutral-500">
                        {t("Usually provided by: {who}", { who: t(it.who) })}
                        {it.evidence === "unknown" ? ` · ${t("whether it applies is unknown")}` : ` · ${t("commonly requested (not verified for this product)")}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="hidden text-sm font-medium print:inline">{ans === "have" ? t("Have it") : ans === "need" ? t("Need it") : ans === "na" ? t("Not applicable") : t("Not answered")}</span>
                      <select
                        aria-label={t("Status of {task}", { task: t(it.title) })}
                        value={ans ?? ""}
                        onChange={(e) => setAnswer(it.id, (e.target.value || null) as ChecklistAnswer | null)}
                        className="no-print h-8 rounded-md border border-input bg-white px-2 text-sm"
                      >
                        <option value="">{t("Not answered")}</option>
                        <option value="have">{t("Have it")}</option>
                        <option value="need">{t("Need it")}</option>
                        <option value="na">{t("Not applicable")}</option>
                      </select>
                      {it.draft && (
                        <a href={`#${it.draft === "invoice" ? "invoice" : "packing"}`} className="no-print text-sm font-medium text-primary underline-offset-4 hover:underline">
                          {t("Open the draft")}
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </article></div>
      </section>

      <section className="no-print rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="dn-h">
        <h2 id="dn-h" className="text-base font-semibold tracking-tight">
          {t("Next")}
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/services?topic=documents${facts.standalone ? "" : `&product=${facts.ref}`}`}>{t("Ask an expert to review these documents")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/roadmap?product=${facts.ref}`}>{t("Back to the roadmap")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
