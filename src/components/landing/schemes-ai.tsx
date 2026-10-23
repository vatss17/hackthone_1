"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { DEMO_DESTINATION, SCHEME_DEMO_FAMILIES } from "@/lib/landing/scheme-demo";

/** The AI scheme finder, explained in three steps with a small deterministic demo. No AI or network call happens here. */
export function SchemesAi() {
  const t = useT();
  const [familyId, setFamilyId] = useState(SCHEME_DEMO_FAMILIES[0].id);
  const family = SCHEME_DEMO_FAMILIES.find((f) => f.id === familyId) ?? SCHEME_DEMO_FAMILIES[0];
  const steps = [
    { n: "1", title: t("Tell us your product"), body: t("Describe it, speak it, or upload a photo. Atlas reads what it is made of and what it is used for.") },
    { n: "2", title: t("Tell us where you want to export"), body: t("Pick the destination market. The schemes and trade-agreement benefits that matter depend on it.") },
    { n: "3", title: t("See the schemes worth checking"), body: t("Indian export schemes and trade-agreement benefits likely to be relevant, with why, what to confirm and the sources.") },
  ];
  return (
    <section id="schemes-ai" aria-labelledby="schemes-ai-h" className="scroll-mt-20 border-t py-16 lg:py-24">
      <div className="max-w-3xl">
        <p className="text-[15px] font-medium text-brand-teal">{t("Schemes & benefits")}</p>
        <h2 id="schemes-ai-h" className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{t("AI reads your product and tells you which government schemes are worth checking")}</h2>
      </div>

      <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="min-w-0 bg-card p-6">
            <span aria-hidden className="tnum text-[13px] font-medium text-brand-teal">{s.n}</span>
            <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 text-lg font-semibold">{t("Try it with a sample product")}</h3>
          <span className="shrink-0 rounded border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1.5 text-xs font-medium text-(--status-estimate-fg)">{t("Sample data")}</span>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="min-w-0">
            <fieldset>
              <legend className="text-[15px] font-semibold">{t("Your product")}</legend>
              <div className="mt-2 flex flex-col gap-2">
                {SCHEME_DEMO_FAMILIES.map((f) => (
                  <button key={f.id} type="button" aria-pressed={f.id === familyId} onClick={() => setFamilyId(f.id)} className={`min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${f.id === familyId ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}>{t(f.name)}</button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="text-[15px] font-semibold">{t("Where to export")}</legend>
              <div className="mt-2 flex flex-col gap-2">
                <button type="button" aria-pressed="true" className="min-h-11 w-full min-w-0 rounded-lg border border-primary bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground">{t("United Arab Emirates (live)")}</button>
                <button type="button" disabled className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-left text-sm font-medium">{t("More countries: not yet")}</button>
              </div>
            </fieldset>
          </div>

          <div className="min-w-0" aria-live="polite">
            <p className="text-[15px] font-semibold">{t(family.name)} · {t(DEMO_DESTINATION)}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("Sample. Not a ruling on eligibility. Rates and rules change: confirm with DGFT, the export promotion council or your adviser.")}</p>
            <ul className="mt-3 divide-y rounded-lg border">
              {family.schemes.map((s) => (
                <li key={s.name} className="min-w-0 p-4">
                  <h4 className="text-[15px] font-semibold">{t(s.name)}</h4>
                  <p className="mt-1 text-sm leading-relaxed">{t(s.why)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{t("To confirm")}: </span>{t(s.confirm)}</p>
                  <p className="mt-2 break-words text-[13px] text-muted-foreground">
                    {s.source ? (
                      <><span>{t("Source")}: </span><a href={s.source.url} target="_blank" rel="noreferrer noopener" lang="en" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">{s.source.label}<ExternalLink aria-hidden className="size-3 shrink-0" /></a></>
                    ) : (
                      <span>{t("No source retrieved yet. Ask DGFT or an adviser.")}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
          <Button asChild size="lg"><Link href="/signup">{t("Run this on my own product")}<ArrowRight aria-hidden /></Link></Button>
          <p className="min-w-0 text-[13px] text-muted-foreground">{t("In the app, Atlas AI reads your own product and gives you this list for it.")}</p>
        </div>
      </div>
    </section>
  );
}
