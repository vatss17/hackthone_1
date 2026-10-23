"use client";

import { VoiceAssist } from "@/components/ai-input/voice-assist";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/auth/notice";
import { StatusBadge } from "@/components/status-badge";
import { importProducts, type ImportResult } from "@/lib/actions/catalogue-import";
import { extractWithAi } from "@/lib/actions/ai";
import type { AiStatus } from "@/lib/ai/provider";
import { DEMO_CATALOGUE, LIMITS, parseCatalogue, parseMaterialField, type ImportIssue, type RejectedValue, type SuggestedProduct } from "@/lib/catalogue/parse";
import { localizeMessage } from "@/lib/catalogue/localize";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Draft = {
  key: number;
  include: boolean;
  name: string;
  description: string;
  category: string;
  intendedUse: string;
  internalCode: string;
  hsCode: string;
  unitWeightG: string;
  materialsText: string;
  specs: { name: string; value: string; unit: string }[];
  source: SuggestedProduct["source"];
  confidence: SuggestedProduct["confidence"];
  notes: string[];
  issues: ImportIssue[];
  /** Invalid values from the file. Each must be corrected or explicitly left out before the product can be saved. */
  rejected: (RejectedValue & { fix: string; omitted: boolean })[];
  confidenceWhy: string;
  duplicate: "catalogue" | "file" | null;
  edited: string[];
  ai: boolean;
};

type Origin = "file" | "paste" | "demo" | "ai";

const positive = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};
/** A rejected value is settled when the person left it out or typed a valid positive replacement. */
const settled = (r: Draft["rejected"][number]) => r.omitted || positive(r.fix) !== null;
const unsettled = (d: Draft) => d.rejected.filter((r) => !settled(r));

const toDraft = (p: SuggestedProduct, existing: Set<string>): Draft => {
  const dup = existing.has(p.name.toLowerCase()) ? "catalogue" : p.duplicateInFile ? "file" : null;
  return {
    key: p.index,
    include: dup === null,
    name: p.name,
    description: p.description ?? "",
    category: p.category ?? "",
    intendedUse: p.intendedUse ?? "",
    internalCode: p.internalCode ?? "",
    hsCode: p.hsCode ?? "",
    unitWeightG: p.unitWeightG === null ? "" : String(p.unitWeightG),
    materialsText: p.materials.map((m) => m.label).join(", "),
    specs: p.specs.map((s) => ({ name: s.name, value: s.value, unit: s.unit ?? "" })),
    source: p.source,
    confidence: p.confidence,
    notes: p.notes,
    issues: p.issues,
    rejected: p.rejected.map((r) => ({ ...r, fix: "", omitted: false })),
    confidenceWhy: p.confidenceWhy,
    duplicate: dup,
    edited: [],
    ai: p.aiSuggested === true,
  };
};

export function ImportWorkspace({ factories, existingNames, ai }: { factories: { id: string; name: string }[]; existingNames: string[]; ai: AiStatus }) {
  const { t, locale } = useI18n();
  // Messages from the reader and the server arrive in English with the file's own words inside; they are translated as they are shown.
  const L = (m: string) => localizeMessage(m, t, locale);
  const plural = (n: number, one: string, many: string) => (n === 1 ? t(one, { count: n }) : t(many, { count: n }));
  const [stage, setStage] = useState<"input" | "review" | "done">("input");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [origin, setOrigin] = useState<Origin>("paste");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [factoryIds, setFactoryIds] = useState<string[]>(factories.length === 1 ? [factories[0].id] : []);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));

  const run = async (text: string, o: Origin, pdf: boolean, name: string | null) => {
    const out = parseCatalogue(text, { fromPdf: pdf });
    const notes = [...out.warnings, ...(out.skippedBlocks > 0 ? [out.skippedBlocks === 1 ? `1 block of text did not look like products and was left out.` : `${out.skippedBlocks} blocks of text did not look like products and were left out.`] : [])];
    let products = out.products;
    let origin: Origin = o;
    setAiNote(null);
    setAiMeta(null);

    // Optional AI reading. It only runs if it is switched on, the person asked for it and consented.
    // Whatever it returns was validated on the server and is shown for review, like everything else.
    if (useAi && aiConsent && ai.configured) {
      setBusy(true);
      const r = await extractWithAi(text, true);
      setBusy(false);
      if (r.ok && r.products.length > 0) {
        products = r.products;
        origin = "ai";
        setAiMeta(`${r.provider} · ${r.model}`);
        if (r.rejected.length > 0) notes.push(r.rejected.length === 1 ? `AI named 1 product that could not be checked against your text, so it was discarded.` : `AI named ${r.rejected.length} products that could not be checked against your text, so they were discarded.`);
      } else {
        setAiNote(r.ok ? "AI found no usable products, so the rule-based reading is shown instead." : `${r.error} The rule-based reading is shown instead.`);
      }
    }

    setWarnings(notes);
    setDrafts(products.map((p) => toDraft(p, existing)));
    setOrigin(origin);
    setFileName(name);
    if (products.length === 0) {
      setError(notes[0] ?? "No products could be picked out of that.");
      return;
    }
    setError(null);
    setStage("review");
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".pdf") || f.type === "application/pdf") {
        const { extractPdfText, MAX_PDF_BYTES } = await import("@/lib/catalogue/pdf");
        if (f.size > MAX_PDF_BYTES) throw new Error("That PDF is larger than 8 MB.");
        const { text, truncated } = await extractPdfText(new Uint8Array(await f.arrayBuffer()));
        if (text.trim().length < 20) throw new Error("No readable text was found in that PDF. Scanned pages need text recognition, which is not available yet. Try a CSV or paste the text.");
        await run(text, "file", true, f.name);
        if (truncated) setWarnings((w) => [...w, "Only the first pages of the PDF were read."]);
      } else if (/\.(csv|tsv|txt|md|text)$/.test(lower) || f.type.startsWith("text/") || f.type === "application/vnd.ms-excel") {
        if (f.size > 2 * 1024 * 1024) throw new Error("That file is larger than 2 MB.");
        await run(await f.text(), "file", false, f.name);
      } else {
        throw new Error("That file type is not supported yet. Use CSV, TXT, Markdown or PDF. For a spreadsheet, save it as CSV first.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = (key: number, p: Partial<Draft>, field?: string) =>
    setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...p, edited: field && !d.edited.includes(field) ? [...d.edited, field] : d.edited } : d)));

  const selected = drafts.filter((d) => d.include && d.name.trim().length >= 2);
  const blocked = selected.filter((d) => unsettled(d).length > 0);

  const save = () => {
    const items = selected.map((d) => {
      const fixedWeight = d.rejected.find((r) => r.field === "weight" && !r.omitted && positive(r.fix) !== null);
      const w = fixedWeight ? positive(fixedWeight.fix)! : Number(d.unitWeightG.replace(/,/g, ""));
      const fixedSpecs = d.rejected.filter((r) => r.field.startsWith("spec:") && !r.omitted && positive(r.fix) !== null).map((r) => ({ name: r.name, value: String(positive(r.fix)), unit: r.unit }));
      return {
        name: d.name.trim(),
        description: d.description.trim() || null,
        category: d.category.trim() || null,
        intendedUse: d.intendedUse.trim() || null,
        internalCode: d.internalCode.trim() || null,
        hsCode: d.hsCode.trim() || null,
        unitWeightG: d.unitWeightG.trim() && Number.isFinite(w) && w > 0 ? w : null,
        materials: parseMaterialField(d.materialsText),
        specs: [...d.specs.filter((s) => s.name.trim() && s.value.trim()).map((s) => ({ name: s.name.trim(), value: s.value.trim(), unit: s.unit.trim() || null })), ...fixedSpecs],
      };
    });
    if (blocked.length > 0) {
      setError(blocked.length === 1 ? t("1 product has a value that needs a correction or an explicit “leave it out” before saving.") : t("{count} products have a value that needs a correction or an explicit “leave it out” before saving.", { count: blocked.length }));
      return;
    }
    startSaving(async () => {
      const r = await importProducts(JSON.stringify({ items, factoryIds }));
      setResult(r);
      if (r.ok) setStage("done");
      else setError(r.error);
    });
  };

  const badge = (d: Draft, field: "category" | "materials" | string, filled: boolean) => {
    if (d.edited.includes(field)) return <StatusBadge kind="user" />;
    if (!filled) return null;
    if (d.ai) return <StatusBadge kind="ai" />;
    if ((field === "category" || field === "materials") && d.source[field] === "rule") return <StatusBadge kind="inferred" />;
    return <StatusBadge kind="user" />;
  };

  // ---------------- stage: done ----------------
  if (stage === "done" && result?.ok) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-primary/30 bg-(--status-verified-bg) p-5">
          <h2 className="text-lg font-semibold tracking-tight">
            {plural(result.created.length, "{count} product saved to your catalogue", "{count} products saved to your catalogue")}
          </h2>
          <p className="mt-1 text-sm">{t("They are now part of your factory profile. The platform will use them to find opportunities and check manufacturing fit.")}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {result.created.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-10">
              <Link href="/opportunities">{t("Continue to Export Opportunities")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-10">
              <Link href="/workspace">{t("Open my Export Workspace")}</Link>
            </Button>
            <Button type="button" variant="ghost" size="lg" className="h-10" onClick={() => { setStage("input"); setDrafts([]); setResult(null); setPasted(""); }}>
              {t("Import another file")}
            </Button>
          </div>
        </div>
        {(result.skipped.length > 0 || result.failed.length > 0) && (
          <div className="rounded-lg border bg-card p-4 text-sm">
            <h3 className="font-semibold">{t("Not saved")}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {[...result.skipped, ...result.failed].map((x, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{x.name}</span>: {L(x.reason)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ---------------- stage: review ----------------
  if (stage === "review") {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {plural(drafts.length, "{count} suggestion to review", "{count} suggestions to review")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {origin === "demo" ? t("From the demo sample catalogue.") : fileName ? t("From {file}.", { file: fileName }) : t("From the text you pasted.")}{" "}
              {origin === "ai" ? (
                <>
                  {t("Suggested by AI ({model}) and checked against your text. AI never saves anything: review every field.", { model: aiMeta ?? "" })}
                </>
              ) : (
                <>
                  {t("Picked out by rules, not AI.")}
                </>
              )}{" "}
              {t("Nothing is saved until you press Save.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {origin === "demo" && <StatusBadge kind="demo" />}
            <StatusBadge kind={origin === "ai" ? "ai" : "inferred"} />
          </div>
        </div>
        {aiNote && <Notice tone="info">{L(aiNote)}</Notice>}
        {warnings.length > 0 && (
          <Notice tone="info">
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{L(w)}</li>
              ))}
            </ul>
          </Notice>
        )}

        <ul className="space-y-4">
          {drafts.map((d) => (
            <li key={d.key} className={cn("rounded-lg border bg-card", !d.include && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={d.include} onChange={(e) => patch(d.key, { include: e.target.checked })} aria-label={t("Include {name}", { name: d.name })} />
                  <span className="min-w-0">
                    <span className="block break-words text-[15px] font-semibold">{d.name || t("Untitled")}</span>
                    <span className="block text-xs text-muted-foreground">{d.include ? t("Will be saved") : t("Rejected: will not be saved")}</span>
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground" title={L(d.confidenceWhy)}>{t("Confidence: {level}", { level: t(d.confidence) })}</span>
                  {d.duplicate === "catalogue" && <span className="rounded-sm border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1.5 py-0.5 text-(--status-estimate-fg)">{t("Already in your catalogue")}</span>}
                  {d.duplicate === "file" && <span className="rounded-sm border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1.5 py-0.5 text-(--status-estimate-fg)">{t("Repeated in this file")}</span>}
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`n-${d.key}`}>{t("Product name")}</Label>
                    {badge(d, "name", !!d.name)}
                  </div>
                  <Input id={`n-${d.key}`} value={d.name} maxLength={LIMITS.name} onChange={(e) => patch(d.key, { name: e.target.value }, "name")} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`c-${d.key}`}>{t("Category")}</Label>
                    {badge(d, "category", !!d.category)}
                  </div>
                  <Input id={`c-${d.key}`} value={d.category} maxLength={LIMITS.category} onChange={(e) => patch(d.key, { category: e.target.value }, "category")} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`u-${d.key}`}>{t("Intended use")}</Label>
                    {badge(d, "intendedUse", !!d.intendedUse)}
                  </div>
                  <Input id={`u-${d.key}`} value={d.intendedUse} maxLength={LIMITS.use} onChange={(e) => patch(d.key, { intendedUse: e.target.value }, "intendedUse")} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`m-${d.key}`}>{t("Materials (comma separated)")}</Label>
                    {badge(d, "materials", !!d.materialsText)}
                  </div>
                  <Input id={`m-${d.key}`} value={d.materialsText} onChange={(e) => patch(d.key, { materialsText: e.target.value }, "materials")} />
                  <p className="text-xs text-muted-foreground">
                    {parseMaterialField(d.materialsText)
                      .map((m) => (m.code ? t("{name} (reference list)", { name: m.code }) : t("{name} (custom)", { name: m.label })))
                      .join(" · ") || t("None")}
                  </p>
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`d-${d.key}`}>{t("Description")}</Label>
                    {badge(d, "description", !!d.description)}
                  </div>
                  <VoiceAssist target="text" fieldId={`d-${d.key}`} compact />
                  <textarea
                    id={`d-${d.key}`}
                    value={d.description}
                    maxLength={LIMITS.description}
                    onChange={(e) => patch(d.key, { description: e.target.value }, "description")}
                    className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3 md:col-span-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`w-${d.key}`}>{t("Unit weight (g)")}</Label>
                    <Input id={`w-${d.key}`} inputMode="decimal" value={d.unitWeightG} onChange={(e) => patch(d.key, { unitWeightG: e.target.value }, "unitWeightG")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`k-${d.key}`}>{t("Your product code")}</Label>
                    <Input id={`k-${d.key}`} value={d.internalCode} maxLength={LIMITS.code} onChange={(e) => patch(d.key, { internalCode: e.target.value }, "internalCode")} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`h-${d.key}`}>{t("HS code (claimed, unverified)")}</Label>
                    <Input id={`h-${d.key}`} value={d.hsCode} maxLength={14} onChange={(e) => patch(d.key, { hsCode: e.target.value }, "hsCode")} />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{t("Specifications")}</h3>
                    {d.specs.length > 0 && badge(d, "specs", true)}
                  </div>
                  <ul className="mt-2 space-y-2">
                    {d.specs.map((s, i) => (
                      <li key={i} className="grid grid-cols-[1fr_1fr_5rem_auto] items-center gap-2">
                        <Input aria-label={t("Specification {n} name for {product}", { n: i + 1, product: d.name || t("this product") })} value={s.name} maxLength={LIMITS.specName} onChange={(e) => patch(d.key, { specs: d.specs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }, "specs")} />
                        <Input aria-label={t("Specification {n} value for {product}", { n: i + 1, product: d.name || t("this product") })} value={s.value} maxLength={LIMITS.specValue} onChange={(e) => patch(d.key, { specs: d.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }, "specs")} />
                        <Input aria-label={t("Specification {n} unit for {product}", { n: i + 1, product: d.name || t("this product") })} value={s.unit} maxLength={LIMITS.unit} onChange={(e) => patch(d.key, { specs: d.specs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) }, "specs")} />
                        <Button type="button" variant="ghost" size="sm" aria-label={t("Remove {name}", { name: s.name || t("specification") })} onClick={() => patch(d.key, { specs: d.specs.filter((_, j) => j !== i) }, "specs")}>
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => patch(d.key, { specs: [...d.specs, { name: "", value: "", unit: "" }] }, "specs")}>
                    {t("Add a specification")}
                  </Button>
                </div>
                {d.rejected.length > 0 && (
                  <section className="rounded-md border border-(--status-missing-border) bg-(--status-missing-bg) p-3 md:col-span-2" aria-label={t("Values to correct for {name}", { name: d.name })}>
                    <h3 className="text-sm font-semibold text-(--status-missing-fg)">{t("Needs a correction or an explicit omission")}</h3>
                    <p className="mt-0.5 text-xs text-(--status-missing-fg)">{t("These values from your file are not valid, so they are not saved as they are.")}</p>
                    <ul className="mt-2 space-y-3">
                      {d.rejected.map((r) => {
                        const id = `fix-${d.key}-${r.field.replace(/[^a-z0-9]/gi, "")}`;
                        const rname = r.field === "weight" ? t("weight") : r.name.toLowerCase();
                        const bad = !r.omitted && r.fix.trim() !== "" && positive(r.fix) === null;
                        return (
                          <li key={r.field} className="grid gap-1.5 text-sm">
                            <p>
                              <span className="font-medium">{L(r.reason)}</span>
                              <span className="block text-xs text-muted-foreground">
                                {r.location ? `${L(r.location)}. ` : ""}{r.unit ? t("The file said “{raw}” {unit}.", { raw: r.raw, unit: r.unit }) : t("The file said “{raw}”.", { raw: r.raw })}
                              </span>
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="grid gap-1">
                                <Label htmlFor={id} className="text-xs">
                                  {t("Corrected {name}", { name: rname })}
                                  {r.field === "weight" ? ` ${t("(grams)")}` : r.unit ? ` (${r.unit})` : ""}
                                </Label>
                                <Input id={id} inputMode="decimal" disabled={r.omitted} value={r.fix} aria-invalid={bad || undefined} aria-describedby={bad ? `${id}-e` : undefined} className="h-9 w-40" onChange={(e) => patch(d.key, { rejected: d.rejected.map((x) => (x.field === r.field ? { ...x, fix: e.target.value } : x)) })} />
                              </div>
                              <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" className="size-4 accent-primary" checked={r.omitted} onChange={(e) => patch(d.key, { rejected: d.rejected.map((x) => (x.field === r.field ? { ...x, omitted: e.target.checked } : x)) })} />
                                {t("Leave this {name} out", { name: rname })}
                              </label>
                            </div>
                            {bad && (
                              <p id={`${id}-e`} role="alert" className="text-xs font-medium text-destructive">
                                {t("Enter a positive number, for example 250.")}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {d.issues.filter((x) => x.severity === "warning").length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-(--status-estimate-fg) md:col-span-2">
                    {d.issues.filter((x) => x.severity === "warning").map((x) => (
                      <li key={x.field + x.message}>
                        {L(x.message)}
                        {x.location ? ` (${L(x.location)})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {d.notes.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground md:col-span-2">
                    {d.notes.map((n) => (
                      <li key={n}>{L(n)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border bg-card p-4 sm:p-5">
          {factories.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-semibold">{t("Link accepted products to a factory")}</legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {factories.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={factoryIds.includes(f.id)} onChange={(e) => setFactoryIds((ids) => (e.target.checked ? [...ids, f.id] : ids.filter((x) => x !== f.id)))} />
                    {f.name}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("Linking means “made here”. It lets the platform judge manufacturing fit. You can change it later.")}</p>
            </fieldset>
          ) : (
            <p className="text-sm text-muted-foreground">{t("Register a factory to link products to it. You can still save them now.")}</p>
          )}
          {error && (
            <div className="mt-3">
              <Notice tone="error">{L(error)}</Notice>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" size="lg" className="h-10" disabled={selected.length === 0 || saving || blocked.length > 0} onClick={save} aria-describedby={blocked.length > 0 ? "blocked-note" : undefined}>
              {saving ? t("Saving…") : plural(selected.length, "Save {count} product", "Save {count} products")}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-10" disabled={saving} onClick={() => { setStage("input"); setDrafts([]); }}>
              {t("Start again")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("{count} will not be saved.", { count: drafts.length - selected.length })}</span>
            {blocked.length > 0 && (
              <span id="blocked-note" role="status" className="text-xs font-medium text-(--status-missing-fg)">
                {plural(blocked.length, "{count} product still needs a correction or an explicit omission.", "{count} products still need a correction or an explicit omission.")}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- stage: input ----------------
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-primary/30 bg-(--status-verified-bg) px-4 py-3 text-sm">
        <p className="font-medium">{t("Your file stays on your device.")}</p>
        <p className="mt-0.5">{t("It is read in this browser and is not uploaded or stored. Only the products you accept are saved, and only after you review them.")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="flex flex-col rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="up-h">
          <h2 id="up-h" className="text-base font-semibold">
            {t("1. Upload a file")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("CSV or tab-separated text, plain text or Markdown, or a PDF with selectable text.")}</p>
          <div className="mt-auto pt-4">
            <input ref={fileRef} id="catalogue-file" type="file" accept=".csv,.tsv,.txt,.md,.text,.pdf,text/*,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? t("Reading…") : t("Choose a file")}
            </Button>
          </div>
        </section>
        <section className="flex flex-col rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="demo-h">
          <div className="flex items-start justify-between gap-2">
            <h2 id="demo-h" className="text-base font-semibold">
              {t("2. Try the demo sample")}
            </h2>
            <StatusBadge kind="demo" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("A short fictional catalogue for the presentation. It is read by the same rules as your own files, and it is not live AI.")}</p>
          <div className="mt-auto pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run(DEMO_CATALOGUE, "demo", false, null)}>
              {t("Load the demo catalogue")}
            </Button>
          </div>
        </section>
        <section className="flex flex-col rounded-md border border-dashed border-input/60 bg-card p-4 sm:p-5" aria-labelledby="ai-h">
          <div className="flex items-start justify-between gap-2">
            <h2 id="ai-h" className="text-base font-semibold">
              {t("3. AI-assisted reading")}
            </h2>
            <StatusBadge kind={ai.configured ? "ai" : "off"} />
          </div>
          {ai.configured ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{t("Optional. AI can read less tidy catalogues and suggest descriptions and materials. It only sees what you send, and every suggestion is checked and shown for review.")}</p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
                <span>{t("Also read my catalogue with AI")}</span>
              </label>
              {useAi && (
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
                  <span>
                    {t("I agree that the catalogue text I choose is sent to {provider} ({model}) for this.", { provider: ai.provider ?? "", model: ai.model ?? "" })}
                  </span>
                </label>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{t("If AI fails or is off, the rule-based reading is used.")}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{t("Not switched on. Until it is, every suggestion comes from simple rules and is labelled that way.")}</p>
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">{t("What the operator needs to set")}</summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {ai.missing.map((m) => (
                    <li key={m} className="font-mono">
                      {m}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">{t("Server settings only. Keys are never entered in the app.")}</p>
              </details>
            </>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4 sm:p-5" aria-labelledby="paste-h">
        <h2 id="paste-h" className="text-base font-semibold">
          {t("Or paste catalogue text")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Works best with one product per block and lines such as “Material: PP”, or a CSV with a header row (Name, Description, Category, Material, Weight (g)…).")}
        </p>
        <label htmlFor="paste" className="sr-only">
          {t("Catalogue text")}
        </label>
        <VoiceAssist target="text" fieldId="paste" className="mt-3" />
        <textarea
          id="paste"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"Product: Round Container 750ml\nMaterial: PP\nUse: Food storage\nCapacity: 750 ml"}
          className="mt-3 min-h-40 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <div className="mt-3">
          <Button type="button" disabled={busy || pasted.trim().length < 3 || (useAi && !aiConsent)} onClick={() => void run(pasted, "paste", false, null)}>
            {t("Find the products")}
          </Button>
        </div>
      </section>

      {error && <Notice tone="error">{L(error)}</Notice>}
    </div>
  );
}
