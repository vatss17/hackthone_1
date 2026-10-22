"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { DRAFT_LABEL, INCOTERMS, checklistFor, effectiveDetails, invoiceModel, packingModel, type DocField } from "@/lib/documents/generate";
import { formatNumber } from "@/lib/landed-cost/format";
import type { ChecklistAnswer, DocDetails, WorkspaceFacts } from "@/lib/workspace/types";
import type { Inputs } from "@/lib/landed-cost/types";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; keys: (keyof DocDetails)[] }[] = [
  { title: "Exporter", keys: ["sellerName", "sellerAddress", "iec", "gstin"] },
  { title: "Buyer", keys: ["buyerName", "buyerAddress", "buyerCountry", "buyerTrn", "buyerContact"] },
  { title: "Shipment", keys: ["invoiceNumber", "invoiceDate", "incoterm", "paymentTerms", "portLoading", "portDischarge", "countryOrigin", "marks", "currency"] },
];

const LABELS: Record<keyof DocDetails, string> = {
  sellerName: "Exporter (seller)", sellerAddress: "Exporter address", iec: "Importer-Exporter Code (IEC)", gstin: "GSTIN",
  buyerName: "Buyer (consignee)", buyerAddress: "Buyer address", buyerCountry: "Buyer country", buyerTrn: "Buyer tax registration number", buyerContact: "Buyer contact (optional)",
  invoiceNumber: "Invoice number", invoiceDate: "Invoice date", incoterm: "Terms of delivery (Incoterm)", paymentTerms: "Payment terms",
  portLoading: "Port of loading", portDischarge: "Port of discharge", countryOrigin: "Country of origin (declared by exporter)", marks: "Marks and numbers", currency: "Invoice currency",
};

const REQUIRED = new Set<keyof DocDetails>(["sellerName", "sellerAddress", "iec", "buyerName", "buyerAddress", "buyerCountry", "invoiceNumber", "invoiceDate", "incoterm", "paymentTerms", "portLoading", "portDischarge", "countryOrigin"]);

const SOURCE_TEXT = { you: "Entered by you", prefilled: "From your records", calculator: "From the calculator", missing: "Missing" } as const;

/** A value in a printed document: the real value, or a visible gap. Never a made-up one. */
function V({ f }: { f: Pick<DocField, "value" | "label"> }) {
  if (f.value) return <span className="whitespace-pre-line">{f.value}</span>;
  return <span className="missing-mark rounded-sm bg-(--status-estimate-bg) px-1 text-xs italic text-(--status-estimate-fg) print:bg-transparent print:text-neutral-500">[missing: {f.label}]</span>;
}

function DraftBanner({ complete }: { complete: boolean }) {
  return (
    <div className="draft-banner flex flex-wrap items-center justify-between gap-2 border-2 border-dashed border-(--status-missing-fg) px-3 py-2 text-sm font-semibold tracking-wide text-(--status-missing-fg) print:border-black print:text-black">
      <span>{DRAFT_LABEL}</span>
      <span className="text-xs font-normal normal-case tracking-normal">{complete ? "All required fields filled. Still a draft: check every line before use." : "Incomplete. Missing items are marked in the text."}</span>
    </div>
  );
}

export function DocumentsWorkspace({ scope, facts, defaults, familyId }: { scope: string; facts: WorkspaceFacts; defaults: Inputs; familyId: string | null }) {
  const w = useWorkspace({ scope, facts, defaults });
  const { assessment, ctx } = w;
  const { values, sources } = effectiveDetails(ctx);
  const inv = invoiceModel(ctx);
  const pack = packingModel(ctx);
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

  if (!w.hydrated) return <p className="mt-8 text-sm text-muted-foreground">Loading your documents…</p>;
  const productLine = facts.product?.name ?? "your product";

  return (
    <div className="mt-6 space-y-10">
      <div className="no-print rounded-md border border-(--status-estimate-border) bg-(--status-estimate-bg) px-4 py-3 text-sm text-(--status-estimate-fg) sm:px-5">
        <p className="font-medium">These are drafts for you to review, not finished documents.</p>
        <p className="mt-0.5">The platform fills in what it knows from your records. It never invents buyer details, invoice numbers, certifications, tariff classifications or approvals, and it submits nothing to customs or any authority. Printing makes a PDF you can edit and send yourself.</p>
      </div>

      {/* ---------------- details ---------------- */}
      <section className="no-print" aria-labelledby="dt-h">
        <h2 id="dt-h" className="text-lg font-semibold tracking-tight">
          Details for {productLine}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Fill the gaps once. The invoice and packing list both use these, and what you type is saved in this browser.</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <fieldset key={g.title} className="rounded-md border bg-card p-4">
              <legend className="px-1 text-sm font-semibold">{g.title}</legend>
              <div className="grid gap-3">
                {g.keys.map((k) => {
                  const id = `doc-${k}`;
                  const common = { id, value: values[k] };
                  return (
                    <div key={k} className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={id} className="text-xs">
                          {LABELS[k]}
                          {REQUIRED.has(k) && <span className="text-destructive"> *</span>}
                        </Label>
                        <span className={cn("text-[10px] uppercase tracking-wide", sources[k] === "missing" ? "text-(--status-estimate-fg)" : "text-muted-foreground")}>{SOURCE_TEXT[sources[k]]}</span>
                      </div>
                      {k === "incoterm" ? (
                        <select {...common} onChange={(e) => setDetail(k, e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
                          <option value="">Choose…</option>
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
                            Today
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
          Quantity, price, cartons and weights come from your{" "}
          <Link href={facts.standalone ? "/viability" : `/viability?product=${facts.ref}`} className="font-medium text-primary underline-offset-4 hover:underline">
            landed-cost calculator
          </Link>{" "}
          and product record{ctx.inputsAreSample ? ", and are still SAMPLE values" : ""}.
        </p>
      </section>

      {/* ---------------- invoice ---------------- */}
      <section id="invoice" className="print-doc scroll-mt-20" data-doc="invoice" aria-labelledby="inv-h">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <h2 id="inv-h" className="text-lg font-semibold tracking-tight">
            Commercial invoice
          </h2>
          <div className="flex items-center gap-2">
            <StatusBadge kind={inv.complete ? "inferred" : "missing"} />
            <Button type="button" variant="outline" onClick={() => print("invoice")}>
              Print or save as PDF
            </Button>
          </div>
        </div>
        <div className="no-print mt-2 text-sm">
          {inv.missing.length > 0 ? (
            <div>
              <p className="font-medium">Still missing before this draft is complete ({inv.missing.length}):</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {inv.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">All required fields are filled. It is still a draft: review every line.</p>
          )}
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-(--status-estimate-fg)">
            {inv.review.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <article className="doc-sheet mt-4 overflow-x-auto rounded-md border bg-white p-6 text-[13px] leading-5 text-neutral-900 sm:p-8">
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
            <thead>
              <tr className="border-y border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="py-1.5 pr-2 font-medium">Description of goods</th>
                <th className="py-1.5 pr-2 font-medium">HS code (exporter&apos;s claim, unverified)</th>
                <th className="py-1.5 pr-2 text-right font-medium">Quantity</th>
                <th className="py-1.5 pr-2 text-right font-medium">Unit price ({inv.currency})</th>
                <th className="py-1.5 text-right font-medium">Amount ({inv.currency})</th>
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
          <p className="mt-6 text-[11px] text-neutral-500">Prepared from the exporter&apos;s own records using the Export Enablement Platform. Not verified by any authority. Prices, terms and identifiers must be checked by the exporter before use.</p>
        </article>
      </section>

      {/* ---------------- packing list ---------------- */}
      <section id="packing" className="print-doc scroll-mt-20" data-doc="packing" aria-labelledby="pk-h">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <h2 id="pk-h" className="text-lg font-semibold tracking-tight">
            Packing list
          </h2>
          <div className="flex items-center gap-2">
            <StatusBadge kind={pack.complete ? "inferred" : "missing"} />
            <Button type="button" variant="outline" onClick={() => print("packing")}>
              Print or save as PDF
            </Button>
          </div>
        </div>
        <div className="no-print mt-2 text-sm">
          {pack.missing.length > 0 ? (
            <div>
              <p className="font-medium">Still missing ({pack.missing.length}):</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {pack.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">All required fields are filled. It is still a draft: weigh a packed carton before shipping.</p>
          )}
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-(--status-estimate-fg)">
            {pack.review.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <article className="doc-sheet mt-4 overflow-x-auto rounded-md border bg-white p-6 text-[13px] leading-5 text-neutral-900 sm:p-8">
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
          {pack.line ? (
            <table className="mt-6 w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-y border-neutral-400 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="py-1.5 pr-2 font-medium">Description</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Cartons</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Units per carton</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Total units</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Net kg / carton</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Gross kg / carton</th>
                  <th className="py-1.5 font-medium">Carton size</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-300 align-top">
                  <td className="py-2 pr-2">{pack.line.description}</td>
                  <td className="py-2 pr-2 text-right">{formatNumber(pack.line.cartons)}</td>
                  <td className="py-2 pr-2 text-right">{formatNumber(pack.line.unitsPerCarton)}</td>
                  <td className="py-2 pr-2 text-right">{formatNumber(pack.line.unitsTotal)}</td>
                  <td className="py-2 pr-2 text-right">{pack.line.netPerCartonKg === null ? <span className="text-xs italic text-neutral-500">[missing]</span> : formatNumber(pack.line.netPerCartonKg)}</td>
                  <td className="py-2 pr-2 text-right">{pack.line.grossPerCartonKg === null ? <span className="text-xs italic text-neutral-500">[missing]</span> : formatNumber(pack.line.grossPerCartonKg)}</td>
                  <td className="py-2">{pack.line.dims ?? <span className="text-xs italic text-neutral-500">[missing]</span>}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-2">Totals</td>
                  <td className="pt-2 text-right">{formatNumber(pack.line.cartons)}</td>
                  <td />
                  <td className="pt-2 text-right">{formatNumber(pack.line.unitsTotal)}</td>
                  <td colSpan={3} className="pt-2 text-right font-normal">
                    Net {pack.line.netTotalKg === null ? "[missing]" : `${formatNumber(pack.line.netTotalKg)} kg`} · Gross {pack.line.grossTotalKg === null ? "[missing]" : `${formatNumber(pack.line.grossTotalKg)} kg`} · Volume {pack.line.volumeCbm === null ? "[missing]" : `${formatNumber(pack.line.volumeCbm)} m³`}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="mt-6 text-xs italic text-neutral-500">[missing: quantity and carton data. Fix the landed-cost calculator inputs]</p>
          )}
          <p className="mt-6 text-[11px] text-neutral-500">Weights are calculated from the exporter&apos;s product and carton data and must be confirmed by weighing. Not verified by any authority.</p>
        </article>
      </section>

      {/* ---------------- checklist ---------------- */}
      <section id="checklist" className="print-doc scroll-mt-20" data-doc="checklist" aria-labelledby="ck-h">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <h2 id="ck-h" className="text-lg font-semibold tracking-tight">
            Export documentation checklist
          </h2>
          <Button type="button" variant="outline" onClick={() => print("checklist")}>
            Print or save as PDF
          </Button>
        </div>
        <p className="no-print mt-1 max-w-2xl text-sm text-muted-foreground">
          What is commonly asked for, who usually provides it, and where you stand. Which documents are actually required for this product and route has <span className="font-medium">not been verified</span>: treat it as a conversation starter with your forwarder and buyer.
        </p>
        <article className="doc-sheet mt-4 overflow-x-auto rounded-md border bg-white p-6 text-[13px] leading-5 text-neutral-900 sm:p-8">
          <DraftBanner complete={false} />
          <h3 className="mt-5 text-xl font-semibold tracking-tight">EXPORT DOCUMENTATION CHECKLIST — {facts.product?.name ?? "standalone assessment"}</h3>
          <ul className="mt-4 divide-y divide-neutral-200">
            {items.map((it) => {
              const ans = answers[it.id];
              return (
                <li key={it.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{it.title}</p>
                      <p className="text-neutral-600">{it.why}</p>
                      <p className="text-xs text-neutral-500">
                        Usually provided by: {it.who}
                        {it.evidence === "unknown" ? " · whether it applies is unknown" : " · commonly requested (not verified for this product)"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="hidden text-sm font-medium print:inline">{ans === "have" ? "Have it" : ans === "need" ? "Need it" : ans === "na" ? "Not applicable" : "Not answered"}</span>
                      <select
                        aria-label={`Status of ${it.title}`}
                        value={ans ?? ""}
                        onChange={(e) => setAnswer(it.id, (e.target.value || null) as ChecklistAnswer | null)}
                        className="no-print h-8 rounded-md border border-input bg-white px-2 text-sm"
                      >
                        <option value="">Not answered</option>
                        <option value="have">Have it</option>
                        <option value="need">Need it</option>
                        <option value="na">Not applicable</option>
                      </select>
                      {it.draft && (
                        <a href={`#${it.draft === "invoice" ? "invoice" : "packing"}`} className="no-print text-sm font-medium text-primary underline-offset-4 hover:underline">
                          Open the draft
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      <section className="no-print rounded-md border bg-card p-4 sm:p-5" aria-labelledby="dn-h">
        <h2 id="dn-h" className="text-base font-semibold tracking-tight">
          Next
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/services?topic=documents${facts.standalone ? "" : `&product=${facts.ref}`}`}>Ask an expert to review these documents</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/roadmap?product=${facts.ref}`}>Back to the roadmap</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
