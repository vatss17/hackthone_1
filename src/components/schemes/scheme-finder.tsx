"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CircleAlert, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { ImageAssist, type AppliedField } from "@/components/ai-input/image-assist";
import { useFailureText } from "@/components/ai-input/shared";
import { usePlan } from "@/components/atlas/use-atlas-store";
import { findSchemes, type FinderResponse } from "@/lib/actions/schemes";
import { toProductForm } from "@/lib/ai-input/mappings";
import { addToPlan } from "@/lib/atlas/plan";
import { useI18n } from "@/lib/i18n/client";
import { FINDER_CAVEAT, SCHEMES, candidatesFor, destinationHasAgreement, type FinderInput, type Relevance } from "@/lib/schemes/finder";
import { cn } from "@/lib/utils";

export interface OwnProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  material: string;
}

/** The researched answer behind a scheme (from src/lib/research/answers.ts, English). */
export interface SchemeInfo {
  answer: string;
  keyPoints: string[];
  confidence: "high" | "medium" | "low";
  whatToConfirm: string;
  sources: { title: string; publisher: string; url: string }[];
}

const TONE: Record<Relevance, string> = {
  likely: "bg-(--status-verified-bg) text-(--status-verified-fg)",
  possible: "bg-(--status-estimate-bg) text-(--status-estimate-fg)",
  check: "bg-secondary text-secondary-foreground",
  unlikely: "bg-muted text-muted-foreground",
};

const field = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/**
 * Scheme finder. The person says (or shows) what the product is and where it is going; the AI ranks the schemes Atlas has researched
 * and says why each may or may not matter, or, with no AI, every scheme is listed to check. It never decides eligibility and names
 * no scheme outside the researched list. Nothing is saved except tasks the person approves into their own plan.
 */
export function SchemeFinder({ scope, products, state, info, aiOn }: { scope: string; products: OwnProduct[]; state: string; info: Record<string, SchemeInfo>; aiOn: boolean }) {
  const { t, locale } = useI18n();
  const failure = useFailureText();
  const [, setPlan] = usePlan(scope);
  const [pending, start] = useTransition();
  const [ref, setRef] = useState<string>(products[0]?.id ?? "");
  const first = products[0];
  const [name, setName] = useState(first?.name ?? "");
  const [category, setCategory] = useState(first?.category ?? "");
  const [description, setDescription] = useState(first?.description ?? "");
  const [material, setMaterial] = useState(first?.material ?? "");
  const [imports, setImports] = useState<FinderInput["importsInputs"]>("unknown");
  const [destination, setDestination] = useState("United Arab Emirates");
  const [consent, setConsent] = useState(false);
  const [out, setOut] = useState<Extract<FinderResponse, { ok: true }> | null>(null);
  const [asked, setAsked] = useState<FinderInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<"approved" | "declined" | "asking" | null>(null);

  const LABEL: Record<Relevance, string> = { likely: t("Likely relevant"), possible: t("Possibly relevant"), check: t("To check"), unlikely: t("Probably not relevant") };

  function pick(id: string) {
    setRef(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setName(p.name);
      setCategory(p.category);
      setDescription(p.description);
      setMaterial(p.material);
    }
    setOut(null);
  }

  // A photo or a spoken description is ADDED to what is already written, never replacing it.
  function fromPhoto(fields: AppliedField[]): number {
    const m = toProductForm(fields);
    let n = 0;
    if (m.values.name && !name.trim()) {
      setName(m.values.name);
      n++;
    }
    if (m.values.category && !category.trim()) {
      setCategory(m.values.category);
      n++;
    }
    const extra = [m.values.description, ...m.specs.map((s) => `${s.name}: ${s.value}${s.unit ? ` ${s.unit}` : ""}`)].filter(Boolean).join(". ");
    if (extra) {
      setDescription((d) => (d.trim() ? `${d.trim()}\n${extra}` : extra));
      n++;
    }
    const mat = m.specs.find((s) => s.name.startsWith("Material"));
    if (mat && !material.trim()) setMaterial(mat.value);
    return n;
  }

  function run() {
    setError(null);
    setAdded(null);
    const input: FinderInput = { productName: name, category, description, material, destination, state, importsInputs: imports };
    setAsked(input);
    start(async () => {
      try {
        const r = await findSchemes(input, consent);
        if (!r.ok) return setError(t("Add a product name and a destination first."));
        setOut(r);
      } catch {
        setError(failure("network"));
      }
    });
  }

  const candidates = candidatesFor(destination);
  const agreement = destinationHasAgreement(destination);
  const rows = out?.result.rows ?? [];

  function approve() {
    if (!ref || !out) return;
    const items = out.result.rows
      .filter((r) => r.relevance !== "unlikely")
      .map((r) => {
        const s = SCHEMES.find((x) => x.id === r.id)!;
        return { id: `scheme:finder:${s.id}`, title: `Check eligibility: ${s.name}`, why: info[s.researchIds[0]]?.whatToConfirm ?? s.blurb, href: `/schemes?product=${ref}`, taskId: null };
      });
    setPlan((plan) => addToPlan(plan, ref, items, new Date().toISOString()));
    setAdded("approved");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <form
        className="flex flex-col gap-4 rounded-lg border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <h2 className="text-[15px] font-semibold">{t("1. Your product")}</h2>
        {products.length > 0 && (
          <label className="block text-sm">
            <span className="font-medium">{t("Pick one of your products")}</span>
            <select value={ref} onChange={(e) => pick(e.target.value)} className={field}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="">{t("Another product (describe it below)")}</option>
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="font-medium">{t("Product name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t("What is it, what is it made of, how is it used?")}</span>
          <textarea id="finder-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500} rows={4} className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm" />
        </label>
        <div className="flex flex-wrap items-start gap-2">
          <VoiceAssist target="text" fieldId="finder-desc" />
          <ImageAssist kind="product_photo" onApply={fromPhoto} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">{t("Main material")}</span>
            <input value={material} onChange={(e) => setMaterial(e.target.value)} maxLength={100} placeholder={t("e.g. PP, HDPE")} className={field} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t("Category")}</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} className={field} />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">{t("Do you import the raw material or other inputs?")}</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-sm">
            {([["yes", t("Yes")], ["no", t("No")], ["unknown", t("Not sure")]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="imports" checked={imports === v} onChange={() => setImports(v)} className="accent-(--brand-teal)" /> {l}
              </label>
            ))}
          </div>
        </fieldset>

        <h2 className="mt-2 text-[15px] font-semibold">{t("2. Where do you want to export it?")}</h2>
        <label className="block text-sm">
          <span className="font-medium">{t("Destination country")}</span>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={80} className={field} />
        </label>
        <p className="text-xs text-muted-foreground">{agreement ? t("The United Arab Emirates is live: its trade-agreement benefit is included.") : t("Atlas has trade-agreement rules for the United Arab Emirates only. For other countries you see the India-side schemes.")}</p>
        {state && <p className="text-xs text-muted-foreground">{t("Your factory's state: {state}", { state })}</p>}

        {aiOn ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-(--brand-teal)" />
            <span>{t("My product details may be sent to an outside AI service (the one this server is set up with) to be understood. Untick to get the plain rule-based list.")}</span>
          </label>
        ) : (
          <p className="rounded-md bg-muted p-3 text-xs">{t("The AI service is off, so you get the plain rule-based list.")}</p>
        )}
        <Button type="submit" disabled={pending || name.trim().length < 2 || destination.trim().length < 2}>
          {pending ? <><Loader2 aria-hidden className="animate-spin" /> {t("Finding schemes…")}</> : <><Sparkles aria-hidden /> {t("Find schemes")}</>}
        </Button>
        {error && <p role="alert" className="text-sm text-(--status-missing-fg)">{error}</p>}
      </form>

      <section aria-labelledby="finder-out" aria-live="polite" className="flex flex-col gap-4">
        <h2 id="finder-out" className="text-[15px] font-semibold">{t("3. Schemes worth checking")}</h2>
        {!out && (
          <div className="rounded-lg border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">
            <p>{t("Tell Atlas about your product and where it is going. It lists the researched schemes that may matter, says why, and shows what to confirm and the sources.")}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {candidates.map((c) => (
                <li key={c.id}>{t(c.name)}</li>
              ))}
            </ul>
          </div>
        )}
        {out && (
          <>
            {out.failure && (
              <p role="status" className="flex gap-2 rounded-md border border-(--status-estimate-border) bg-(--status-estimate-bg) p-3 text-sm text-(--status-estimate-fg)">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{out.failure === "provider_error" ? failure("provider_error") : failure(out.failure as never)} {t("Showing the rule-based list instead.")}</span>
              </p>
            )}
            {out.result.understood && <p className="text-sm">{out.result.understood}</p>}
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("rounded px-2 py-0.5 font-medium", out.result.mode === "ai" ? "bg-(--status-ai-bg) text-(--status-ai-fg)" : "bg-secondary text-secondary-foreground")}>{out.result.mode === "ai" ? t("AI draft") : t("Rule-based")}</span>
              {asked && <span>{t("For {product} to {destination}", { product: asked.productName, destination: asked.destination })}</span>}
            </p>
            <ul className="flex flex-col gap-3">
              {rows.map((r) => {
                const s = SCHEMES.find((x) => x.id === r.id)!;
                const i = info[s.researchIds[0]];
                return (
                  <li key={r.id} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[15px] font-semibold">{t(s.name)}</h3>
                      <span className={cn("rounded px-2 py-0.5 text-[11px] font-medium", TONE[r.relevance])}>{LABEL[r.relevance]}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{t(s.blurb)}</p>
                    <p className="mt-2 text-sm">{r.reason || t("Not enough was given to say how this applies to your product. Check it.")}</p>
                    <p className="mt-2 text-[13px]">
                      <span className="font-medium">{t("Confirm: ")}</span>
                      {r.confirm || (i ? i.whatToConfirm : t("Check the current rules with the authority or your adviser."))}
                    </p>
                    {i && (
                      <details className="mt-2 text-[13px]">
                        <summary className="cursor-pointer font-medium text-link">{t("Researched answer and sources")}</summary>
                        <p lang="en" className="mt-2 text-muted-foreground">{i.answer}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("Researched in English. Confidence: {level}.", { level: t(i.confidence) })}</p>
                        <ul className="mt-2 space-y-1">
                          {i.sources.map((src) => (
                            <li key={src.url}>
                              <a href={src.url} target="_blank" rel="noreferrer noopener" className="text-link underline-offset-2 hover:underline">
                                {src.title} <span className="text-muted-foreground">· {src.publisher}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">{t(FINDER_CAVEAT)}</p>
            <div className="rounded-md border border-(--brand-teal)/40 bg-selected p-3">
              {added === "approved" ? (
                <p role="status" className="text-sm font-medium">
                  {t("Added to your plan.")}{" "}
                  <Link href={`/mission/${ref}`} className="text-link underline underline-offset-2">{t("Open Mission Control")}</Link>
                </p>
              ) : added === "asking" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm">{t("Add a check-eligibility task for each scheme above to your plan for this product? Saved in this browser only.")}</p>
                  <Button size="sm" onClick={approve}>{t("Approve and add")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setAdded(null)}>{t("Not now")}</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => setAdded("asking")} disabled={!ref}>{t("Add these steps to my plan")}</Button>
                  {!ref && <span className="text-xs text-muted-foreground">{t("Pick one of your own products to add steps to its plan.")}</span>}
                  {ref && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/schemes?product=${ref}`}>{t("Open Benefits Studio")}</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
